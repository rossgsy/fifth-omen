package game

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"sync"
)

const (
	RoleGameScreen = "gamescreen"
	RolePlayer     = "player"

	DefaultMaxSeats = 6
	MaxSeatsLimit   = 6
	RoomCodeLength  = 5
	PINLength       = 6
)

type Sender interface {
	Send(v any) bool
	Close(reason string)
}

type Manager struct {
	mu       sync.Mutex
	rooms    map[string]*Room
	sessions map[string]*Session
	store    RoomStore
}

type Room struct {
	Code     string
	PIN      string
	MaxSeats int
	state    roomState
}

// roomState is the single mutable state for a room. Keeping all session and
// game data here makes room transitions atomic under Manager.mu.
type roomState struct {
	Global      GlobalState
	players     map[int]*Player
	playerToken map[string]*Player
	playerClass map[int]*Player
	screens     map[string]*GameScreen
}

type GlobalState struct {
	Doom int `json:"doom"`
	Ward int `json:"ward"`
}

type GlobalStateUpdate struct {
	Doom *int `json:"doom,omitempty"`
	Ward *int `json:"ward,omitempty"`
}

type Player struct {
	Seat      int    `json:"seat"`
	DeviceID  string `json:"deviceId"`
	Token     string `json:"-"`
	Name      string `json:"name"`
	ClassID   *int   `json:"classId,omitempty"`
	Connected bool   `json:"connected"`
	sender    Sender
}

type GameScreen struct {
	DeviceID  string
	Token     string
	Connected bool
	sender    Sender
}

type Session struct {
	ID             string `json:"sessionId"`
	RoomCode       string `json:"roomCode"`
	Role           string `json:"role"`
	DeviceID       string `json:"deviceId"`
	Seat           *int   `json:"seat,omitempty"`
	ClassID        *int   `json:"classId,omitempty"`
	ReconnectToken string `json:"reconnectToken"`
	PlayerName     string `json:"playerName,omitempty"`
	sender         Sender
}

type CreateRoomRequest struct {
	Code     string `json:"code"`
	PIN      string `json:"pin"`
	MaxSeats int    `json:"maxSeats"`
}

type CreateRoomResult struct {
	Room RoomSnapshot `json:"room"`
	PIN  string       `json:"pin"`
}

type JoinRequest struct {
	RoomCode       string
	PIN            string
	Role           string
	ReconnectToken string
	PlayerName     string
	ClassID        *int
	Seat           *int
}

type JoinResult struct {
	Session     *Session     `json:"session"`
	Room        RoomSnapshot `json:"room"`
	Reconnected bool         `json:"reconnected"`
	replaced    Sender
}

type RoomSnapshot struct {
	Code        string           `json:"code"`
	MaxSeats    int              `json:"maxSeats"`
	Players     []PlayerSnapshot `json:"players"`
	GameScreens int              `json:"gameScreens"`
	Global      GlobalState      `json:"global"`
}

type AdminRoomSnapshot struct {
	RoomSnapshot
	PIN string `json:"pin"`
}

type PlayerSnapshot struct {
	Seat       int    `json:"seat"`
	DeviceID   string `json:"deviceId"`
	Name       string `json:"name"`
	ClassID    *int   `json:"classId,omitempty"`
	PlaybookID *int   `json:"playbookId,omitempty"`
	Connected  bool   `json:"connected"`
}

type RoomEvent struct {
	Type string       `json:"type"`
	Room RoomSnapshot `json:"room"`
}

func NewManager() *Manager {
	return &Manager{
		rooms:    make(map[string]*Room),
		sessions: make(map[string]*Session),
	}
}

func NewManagerWithStore(ctx context.Context, store RoomStore) (*Manager, error) {
	manager := NewManager()
	manager.store = store
	if store == nil {
		return manager, nil
	}

	rooms, err := store.LoadRooms(ctx)
	if err != nil {
		return nil, err
	}
	for _, storedRoom := range rooms {
		room, err := roomFromStored(storedRoom)
		if err != nil {
			return nil, err
		}
		manager.rooms[room.Code] = room
	}
	return manager, nil
}

func (m *Manager) CreateRoom(req CreateRoomRequest) (CreateRoomResult, error) {
	code := normalizeRoomCode(req.Code)
	generatedCode := code == ""
	if code == "" {
		var err error
		code, err = randomCode(RoomCodeLength)
		if err != nil {
			return CreateRoomResult{}, err
		}
	} else if !validRoomCode(code) {
		return CreateRoomResult{}, ErrInvalidRoomCode
	}

	pin := strings.TrimSpace(req.PIN)
	if pin == "" {
		var err error
		pin, err = randomDigits(PINLength)
		if err != nil {
			return CreateRoomResult{}, err
		}
	} else if !validPIN(pin) {
		return CreateRoomResult{}, ErrInvalidPIN
	}

	maxSeats := req.MaxSeats
	if maxSeats <= 0 {
		maxSeats = DefaultMaxSeats
	} else if maxSeats > MaxSeatsLimit {
		maxSeats = MaxSeatsLimit
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.rooms[code]; ok {
		if !generatedCode {
			return CreateRoomResult{}, ErrRoomExists
		}
		var err error
		code, err = m.unusedRoomCodeLocked()
		if err != nil {
			return CreateRoomResult{}, err
		}
	}

	room := &Room{
		Code:     code,
		PIN:      pin,
		MaxSeats: maxSeats,
		state: roomState{
			players:     make(map[int]*Player),
			playerToken: make(map[string]*Player),
			playerClass: make(map[int]*Player),
			screens:     make(map[string]*GameScreen),
		},
	}
	m.rooms[code] = room
	if err := m.saveRoomLocked(room); err != nil {
		delete(m.rooms, code)
		return CreateRoomResult{}, err
	}

	return CreateRoomResult{
		Room: room.snapshot(),
		PIN:  room.PIN,
	}, nil
}

func (m *Manager) unusedRoomCodeLocked() (string, error) {
	for range 16 {
		code, err := randomCode(RoomCodeLength)
		if err != nil {
			return "", err
		}
		if _, ok := m.rooms[code]; !ok {
			return code, nil
		}
	}
	return "", ErrRoomExists
}

func (m *Manager) Join(req JoinRequest, sender Sender) (JoinResult, error) {
	roomCode := normalizeRoomCode(req.RoomCode)
	role := strings.ToLower(strings.TrimSpace(req.Role))
	pin := strings.TrimSpace(req.PIN)

	if roomCode == "" || sender == nil {
		return JoinResult{}, ErrInvalidJoin
	}
	if role != RoleGameScreen && role != RolePlayer {
		return JoinResult{}, ErrInvalidRole
	}

	var replaced Sender

	m.mu.Lock()
	room, ok := m.rooms[roomCode]
	if !ok {
		m.mu.Unlock()
		return JoinResult{}, ErrRoomNotFound
	}
	if pin == "" {
		reconnectToken := strings.TrimSpace(req.ReconnectToken)
		validPlayerReconnect := role == RolePlayer && reconnectToken != "" && room.state.playerToken[reconnectToken] != nil
		validGameScreenReconnect := role == RoleGameScreen && reconnectToken != "" && room.state.screens[reconnectToken] != nil
		if !validPlayerReconnect && !validGameScreenReconnect {
			m.mu.Unlock()
			return JoinResult{}, ErrInvalidPIN
		}
	} else if room.PIN != pin {
		m.mu.Unlock()
		return JoinResult{}, ErrInvalidPIN
	}

	result, err := m.joinLocked(room, role, strings.TrimSpace(req.ReconnectToken), strings.TrimSpace(req.PlayerName), req.ClassID, req.Seat, sender)
	if err != nil {
		m.mu.Unlock()
		return JoinResult{}, err
	}

	m.sessions[result.Session.ID] = result.Session
	if err := m.saveRoomLocked(room); err != nil {
		delete(m.sessions, result.Session.ID)
		m.mu.Unlock()
		return JoinResult{}, err
	}
	replaced = result.replaced
	senders := room.sendersExcept(sender)
	event := RoomEvent{Type: "room_state", Room: room.snapshot()}
	m.mu.Unlock()

	if replaced != nil {
		replaced.Close("connection replaced by reconnect")
	}
	broadcast(senders, event)

	return result, nil
}

func (m *Manager) Leave(sessionID string) {
	m.mu.Lock()
	session, ok := m.sessions[sessionID]
	if !ok {
		m.mu.Unlock()
		return
	}
	delete(m.sessions, sessionID)

	room := m.rooms[session.RoomCode]
	if room == nil {
		m.mu.Unlock()
		return
	}

	switch session.Role {
	case RolePlayer:
		if session.Seat != nil {
			if player := room.state.players[*session.Seat]; player != nil && player.Token == session.ReconnectToken {
				if player.sender != session.sender {
					break
				}
				player.Connected = false
				player.sender = nil
			}
		}
	case RoleGameScreen:
		if screen := room.state.screens[session.ReconnectToken]; screen != nil {
			if screen.sender != session.sender {
				break
			}
			screen.Connected = false
			screen.sender = nil
		}
	}

	senders := room.senders()
	event := RoomEvent{Type: "room_state", Room: room.snapshot()}
	_ = m.saveRoomLocked(room)
	m.mu.Unlock()

	broadcast(senders, event)
}

func (m *Manager) ReleaseSession(sessionID string) {
	m.mu.Lock()
	session, ok := m.sessions[sessionID]
	if !ok {
		m.mu.Unlock()
		return
	}
	delete(m.sessions, sessionID)

	room := m.rooms[session.RoomCode]
	if room == nil {
		m.mu.Unlock()
		return
	}

	switch session.Role {
	case RolePlayer:
		if session.Seat != nil {
			if player := room.state.players[*session.Seat]; player != nil && player.Token == session.ReconnectToken {
				room.releasePlayer(player)
			}
		}
	case RoleGameScreen:
		delete(room.state.screens, session.ReconnectToken)
	}

	senders := room.senders()
	event := RoomEvent{Type: "room_state", Room: room.snapshot()}
	_ = m.saveRoomLocked(room)
	m.mu.Unlock()

	broadcast(senders, event)
}

func (m *Manager) Snapshot(roomCode string) (RoomSnapshot, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	room := m.rooms[normalizeRoomCode(roomCode)]
	if room == nil {
		return RoomSnapshot{}, ErrRoomNotFound
	}
	return room.snapshot(), nil
}

func (m *Manager) SessionReconnectToken(sessionID string) string {
	m.mu.Lock()
	defer m.mu.Unlock()

	session := m.sessions[sessionID]
	if session == nil {
		return ""
	}
	return session.ReconnectToken
}

func (m *Manager) AdminSnapshot(roomCode string) (AdminRoomSnapshot, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	room := m.rooms[normalizeRoomCode(roomCode)]
	if room == nil {
		return AdminRoomSnapshot{}, ErrRoomNotFound
	}
	return room.adminSnapshot(), nil
}

func (m *Manager) ListAdminRooms() []AdminRoomSnapshot {
	m.mu.Lock()
	defer m.mu.Unlock()

	codes := make([]string, 0, len(m.rooms))
	for code := range m.rooms {
		codes = append(codes, code)
	}
	sort.Strings(codes)

	rooms := make([]AdminRoomSnapshot, 0, len(codes))
	for _, code := range codes {
		rooms = append(rooms, m.rooms[code].adminSnapshot())
	}
	return rooms
}

func (m *Manager) DeleteRoom(roomCode string) error {
	m.mu.Lock()
	room := m.rooms[normalizeRoomCode(roomCode)]
	if room == nil {
		m.mu.Unlock()
		return ErrRoomNotFound
	}

	if err := m.deleteRoomLocked(room.Code); err != nil {
		m.mu.Unlock()
		return err
	}
	delete(m.rooms, room.Code)
	for sessionID, session := range m.sessions {
		if session.RoomCode == room.Code {
			delete(m.sessions, sessionID)
		}
	}
	senders := room.senders()
	m.mu.Unlock()

	for _, sender := range senders {
		sender.Close("room deleted")
	}

	return nil
}

func (m *Manager) ClaimClass(sessionID string, classID int) (RoomSnapshot, error) {
	if classID < 0 {
		return RoomSnapshot{}, ErrInvalidClass
	}

	m.mu.Lock()
	session := m.sessions[sessionID]
	if session == nil || session.Role != RolePlayer || session.Seat == nil {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidJoin
	}
	room := m.rooms[session.RoomCode]
	if room == nil {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrRoomNotFound
	}
	player := room.state.players[*session.Seat]
	if player == nil || player.Token != session.ReconnectToken {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidJoin
	}
	if player.ClassID != nil && *player.ClassID != classID {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrClassTaken
	}
	if existing := room.state.playerClass[classID]; existing != nil && existing != player {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrClassTaken
	}
	if player.ClassID != nil {
		snapshot := room.snapshot()
		m.mu.Unlock()
		return snapshot, nil
	}

	classCopy := classID
	player.ClassID = &classCopy
	session.ClassID = &classCopy
	room.state.playerClass[classID] = player

	snapshot := room.snapshot()
	senders := room.senders()
	if err := m.saveRoomLocked(room); err != nil {
		m.mu.Unlock()
		return RoomSnapshot{}, err
	}
	m.mu.Unlock()

	broadcast(senders, RoomEvent{Type: "room_state", Room: snapshot})
	return snapshot, nil
}

func (m *Manager) ClaimSeat(sessionID string, seat int) (RoomSnapshot, error) {
	if seat < 0 || seat >= MaxSeatsLimit {
		return RoomSnapshot{}, ErrInvalidSeat
	}

	m.mu.Lock()
	session := m.sessions[sessionID]
	if session == nil || session.Role != RolePlayer {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidJoin
	}
	room := m.rooms[session.RoomCode]
	if room == nil {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrRoomNotFound
	}
	if seat >= room.MaxSeats {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidSeat
	}

	player := room.state.players[seat]
	if player != nil && player.Connected && player.Token != session.ReconnectToken {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrSeatOccupied
	}

	if session.Seat != nil && *session.Seat != seat {
		if current := room.state.players[*session.Seat]; current != nil && current.Token == session.ReconnectToken {
			current.Connected = false
			current.sender = nil
		}
	}

	if player == nil {
		token, err := playerReconnectToken(strings.TrimSpace(session.PlayerName), &seat)
		if err != nil {
			m.mu.Unlock()
			return RoomSnapshot{}, err
		}
		session.ReconnectToken = token
		player = &Player{
			Seat:     seat,
			Token:    token,
			DeviceID: session.DeviceID,
			Name:     strings.TrimSpace(session.PlayerName),
		}
		room.state.players[seat] = player
	} else {
		delete(room.state.playerToken, player.Token)
		player.DeviceID = session.DeviceID
		if name := strings.TrimSpace(session.PlayerName); name != "" {
			player.Name = name
		}
		token, err := playerReconnectToken(player.Name, &seat)
		if err != nil {
			m.mu.Unlock()
			return RoomSnapshot{}, err
		}
		session.ReconnectToken = token
		player.Token = token
	}
	room.state.playerToken[player.Token] = player
	player.Connected = true
	player.sender = session.sender

	seatCopy := seat
	session.Seat = &seatCopy
	session.ClassID = copyInt(player.ClassID)

	snapshot := room.snapshot()
	senders := room.senders()
	if err := m.saveRoomLocked(room); err != nil {
		m.mu.Unlock()
		return RoomSnapshot{}, err
	}
	m.mu.Unlock()

	broadcast(senders, RoomEvent{Type: "room_state", Room: snapshot})
	return snapshot, nil
}

// UpdateGlobalState applies one atomic room-state transition. Only a game
// screen may change shared trackers, and omitted fields retain their values.
func (m *Manager) UpdateGlobalState(sessionID string, update GlobalStateUpdate) (RoomSnapshot, error) {
	if (update.Doom == nil && update.Ward == nil) || !validTracker(update.Doom) || !validTracker(update.Ward) {
		return RoomSnapshot{}, ErrInvalidGameState
	}

	m.mu.Lock()
	session := m.sessions[sessionID]
	if session == nil || session.Role != RoleGameScreen {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidJoin
	}
	room := m.rooms[session.RoomCode]
	if room == nil {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrRoomNotFound
	}
	if update.Doom != nil {
		room.state.Global.Doom = *update.Doom
	}
	if update.Ward != nil {
		room.state.Global.Ward = *update.Ward
	}

	snapshot := room.snapshot()
	senders := room.senders()
	if err := m.saveRoomLocked(room); err != nil {
		m.mu.Unlock()
		return RoomSnapshot{}, err
	}
	m.mu.Unlock()

	broadcast(senders, RoomEvent{Type: "room_state", Room: snapshot})
	return snapshot, nil
}

func (m *Manager) saveRoomLocked(room *Room) error {
	if m.store == nil {
		return nil
	}
	return m.store.SaveRoom(context.Background(), room.stored())
}

func (m *Manager) deleteRoomLocked(code string) error {
	if m.store == nil {
		return nil
	}
	return m.store.DeleteRoom(context.Background(), code)
}

func (m *Manager) joinLocked(room *Room, role string, reconnectToken string, playerName string, classID *int, seat *int, sender Sender) (JoinResult, error) {
	switch role {
	case RolePlayer:
		return room.joinPlayer(reconnectToken, playerName, classID, seat, sender)
	case RoleGameScreen:
		return room.joinGameScreen(reconnectToken, sender)
	default:
		return JoinResult{}, ErrInvalidRole
	}
}

func (r *Room) joinPlayer(reconnectToken string, playerName string, classID *int, seat *int, sender Sender) (JoinResult, error) {
	reconnected := false
	var player *Player
	if reconnectToken != "" {
		player = r.state.playerToken[reconnectToken]
	}
	if player != nil && player.Connected {
		player = nil
	}

	sessionToken := reconnectToken
	if sessionToken == "" || player == nil {
		token, err := playerReconnectToken(playerName, seat)
		if err != nil {
			return JoinResult{}, err
		}
		sessionToken = token
	}

	deviceID, err := randomID("dev")
	if err != nil {
		return JoinResult{}, err
	}

	if player == nil && seat != nil {
		if *seat < 0 || *seat >= r.MaxSeats {
			return JoinResult{}, ErrInvalidSeat
		}
		target := r.state.players[*seat]
		if target != nil && target.Connected {
			return JoinResult{}, ErrSeatOccupied
		}
		player = target
	}

	if player != nil {
		reconnected = reconnectToken != "" && player.Token == reconnectToken
		replaced := player.sender
		delete(r.state.playerToken, player.Token)
		player.Token = sessionToken
		player.DeviceID = deviceID
		if playerName != "" {
			player.Name = playerName
		}
		player.Connected = true
		player.sender = sender
		r.state.playerToken[player.Token] = player
		return r.joinSeatedPlayer(player, reconnected, replaced, sender)
	} else if seat != nil {
		if classID != nil && *classID < 0 {
			return JoinResult{}, ErrInvalidClass
		}
		player = &Player{
			Seat:     *seat,
			Token:    sessionToken,
			DeviceID: deviceID,
			Name:     playerName,
		}
		if classID != nil {
			if existing := r.state.playerClass[*classID]; existing != nil {
				return JoinResult{}, ErrClassTaken
			}
			classCopy := *classID
			player.ClassID = &classCopy
			r.state.playerClass[classCopy] = player
		}
		player.Connected = true
		player.sender = sender
		r.state.players[player.Seat] = player
		r.state.playerToken[player.Token] = player
		return r.joinSeatedPlayer(player, reconnected, nil, sender)
	}

	if player == nil {
		sessionID, err := randomID("sess")
		if err != nil {
			return JoinResult{}, err
		}
		session := &Session{
			ID:             sessionID,
			RoomCode:       r.Code,
			Role:           RolePlayer,
			DeviceID:       deviceID,
			ReconnectToken: sessionToken,
			PlayerName:     playerName,
			sender:         sender,
		}
		return JoinResult{
			Session:     session,
			Room:        r.snapshot(),
			Reconnected: false,
		}, nil
	}

	return r.joinSeatedPlayer(player, reconnected, nil, sender)
}

func (r *Room) joinSeatedPlayer(player *Player, reconnected bool, replaced Sender, sender Sender) (JoinResult, error) {
	sessionID, err := randomID("sess")
	if err != nil {
		return JoinResult{}, err
	}
	seat := player.Seat
	session := &Session{
		ID:             sessionID,
		RoomCode:       r.Code,
		Role:           RolePlayer,
		DeviceID:       player.DeviceID,
		Seat:           &seat,
		ClassID:        copyInt(player.ClassID),
		ReconnectToken: player.Token,
		PlayerName:     player.Name,
		sender:         sender,
	}

	return JoinResult{
		Session:     session,
		Room:        r.snapshot(),
		Reconnected: reconnected,
		replaced:    replaced,
	}, nil
}

func (r *Room) joinGameScreen(reconnectToken string, sender Sender) (JoinResult, error) {
	reconnected := false
	screen := r.state.screens[reconnectToken]
	if reconnectToken != "" && screen == nil {
		return JoinResult{}, ErrReconnectNotFound
	}

	if screen == nil {
		token, err := randomToken()
		if err != nil {
			return JoinResult{}, err
		}
		deviceID, err := randomID("screen")
		if err != nil {
			return JoinResult{}, err
		}
		screen = &GameScreen{
			Token:    token,
			DeviceID: deviceID,
		}
		r.state.screens[token] = screen
	} else {
		reconnected = true
	}

	replaced := screen.sender
	screen.Connected = true
	screen.sender = sender

	sessionID, err := randomID("sess")
	if err != nil {
		return JoinResult{}, err
	}
	session := &Session{
		ID:             sessionID,
		RoomCode:       r.Code,
		Role:           RoleGameScreen,
		DeviceID:       screen.DeviceID,
		ReconnectToken: screen.Token,
		sender:         sender,
	}

	return JoinResult{
		Session:     session,
		Room:        r.snapshot(),
		Reconnected: reconnected,
		replaced:    replaced,
	}, nil
}

func (r *Room) releasePlayer(player *Player) {
	delete(r.state.players, player.Seat)
	delete(r.state.playerToken, player.Token)
	if player.ClassID != nil {
		delete(r.state.playerClass, *player.ClassID)
	}
}

func (r *Room) snapshot() RoomSnapshot {
	players := make([]PlayerSnapshot, 0, len(r.state.players))
	for seat := 0; seat < r.MaxSeats; seat++ {
		player := r.state.players[seat]
		if player == nil {
			continue
		}
		players = append(players, PlayerSnapshot{
			Seat:       player.Seat,
			DeviceID:   player.DeviceID,
			Name:       player.Name,
			ClassID:    copyInt(player.ClassID),
			PlaybookID: copyInt(player.ClassID),
			Connected:  player.Connected,
		})
	}

	gameScreens := 0
	for _, screen := range r.state.screens {
		if screen.Connected {
			gameScreens++
		}
	}

	return RoomSnapshot{
		Code:        r.Code,
		MaxSeats:    r.MaxSeats,
		Players:     players,
		GameScreens: gameScreens,
		Global:      r.state.Global,
	}
}

func (r *Room) adminSnapshot() AdminRoomSnapshot {
	return AdminRoomSnapshot{
		RoomSnapshot: r.snapshot(),
		PIN:          r.PIN,
	}
}

func (r *Room) senders() []Sender {
	senders := make([]Sender, 0, len(r.state.players)+len(r.state.screens))
	for _, player := range r.state.players {
		if player.Connected && player.sender != nil {
			senders = append(senders, player.sender)
		}
	}
	for _, screen := range r.state.screens {
		if screen.Connected && screen.sender != nil {
			senders = append(senders, screen.sender)
		}
	}
	return senders
}

func (r *Room) sendersExcept(excluded Sender) []Sender {
	senders := make([]Sender, 0, len(r.state.players)+len(r.state.screens))
	for _, sender := range r.senders() {
		if sender != excluded {
			senders = append(senders, sender)
		}
	}
	return senders
}

func broadcast(senders []Sender, event RoomEvent) {
	for _, sender := range senders {
		sender.Send(event)
	}
}

func copyInt(value *int) *int {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func validTracker(value *int) bool {
	return value == nil || (*value >= 0 && *value <= 10)
}

func normalizeRoomCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func validRoomCode(code string) bool {
	if len(code) != RoomCodeLength {
		return false
	}
	for _, ch := range code {
		if (ch < 'A' || ch > 'Z') && (ch < '0' || ch > '9') {
			return false
		}
	}
	return true
}

func validPIN(pin string) bool {
	if len(pin) != PINLength {
		return false
	}
	for _, ch := range pin {
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return true
}

func randomCode(length int) (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	for i := range buf {
		buf[i] = alphabet[int(buf[i])%len(alphabet)]
	}
	return string(buf), nil
}

func randomDigits(length int) (string, error) {
	const digits = "0123456789"
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	for i := range buf {
		buf[i] = digits[int(buf[i])%len(digits)]
	}
	return string(buf), nil
}

func randomToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func playerReconnectToken(playerName string, seat *int) (string, error) {
	token, err := randomToken()
	if err != nil {
		return "", err
	}
	seatPart := "seat-open"
	if seat != nil {
		seatPart = fmt.Sprintf("seat-%d", *seat+1)
	}
	return fmt.Sprintf("%s-%s-%s", tokenSlug(playerName), seatPart, token), nil
}

func tokenSlug(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return "player"
	}
	var builder strings.Builder
	for _, ch := range value {
		switch {
		case ch >= 'a' && ch <= 'z':
			builder.WriteRune(ch)
		case ch >= '0' && ch <= '9':
			builder.WriteRune(ch)
		case builder.Len() > 0:
			last := builder.String()[builder.Len()-1]
			if last != '-' {
				builder.WriteByte('-')
			}
		}
		if builder.Len() >= 24 {
			break
		}
	}
	slug := strings.Trim(builder.String(), "-")
	if slug == "" {
		return "player"
	}
	return slug
}

func randomID(prefix string) (string, error) {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(buf)), nil
}
