package game

import (
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

	DefaultMaxSeats = 8
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
}

type Room struct {
	Code        string
	PIN         string
	MaxSeats    int
	players     map[int]*Player
	playerToken map[string]*Player
	playerClass map[int]*Player
	screens     map[string]*GameScreen
}

type Player struct {
	Seat      int    `json:"seat"`
	DeviceID  string `json:"deviceId"`
	Token     string `json:"-"`
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
	ClassID        *int
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
}

type AdminRoomSnapshot struct {
	RoomSnapshot
	PIN string `json:"pin"`
}

type PlayerSnapshot struct {
	Seat      int    `json:"seat"`
	DeviceID  string `json:"deviceId"`
	ClassID   *int   `json:"classId,omitempty"`
	Connected bool   `json:"connected"`
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
		Code:        code,
		PIN:         pin,
		MaxSeats:    maxSeats,
		players:     make(map[int]*Player),
		playerToken: make(map[string]*Player),
		playerClass: make(map[int]*Player),
		screens:     make(map[string]*GameScreen),
	}
	m.rooms[code] = room

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

	if roomCode == "" || pin == "" || sender == nil {
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
	if room.PIN != pin {
		m.mu.Unlock()
		return JoinResult{}, ErrInvalidPIN
	}

	result, err := m.joinLocked(room, role, strings.TrimSpace(req.ReconnectToken), req.ClassID, sender)
	if err != nil {
		m.mu.Unlock()
		return JoinResult{}, err
	}

	m.sessions[result.Session.ID] = result.Session
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
			if player := room.players[*session.Seat]; player != nil && player.Token == session.ReconnectToken {
				if player.sender != session.sender {
					break
				}
				room.releasePlayer(player)
			}
		}
	case RoleGameScreen:
		if screen := room.screens[session.ReconnectToken]; screen != nil {
			if screen.sender != session.sender {
				break
			}
			screen.Connected = false
			screen.sender = nil
		}
	}

	senders := room.senders()
	event := RoomEvent{Type: "room_state", Room: room.snapshot()}
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
			if player := room.players[*session.Seat]; player != nil && player.Token == session.ReconnectToken {
				room.releasePlayer(player)
			}
		}
	case RoleGameScreen:
		delete(room.screens, session.ReconnectToken)
	}

	senders := room.senders()
	event := RoomEvent{Type: "room_state", Room: room.snapshot()}
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
	player := room.players[*session.Seat]
	if player == nil || player.Token != session.ReconnectToken {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidJoin
	}
	if existing := room.playerClass[classID]; existing != nil && existing != player {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrClassTaken
	}

	if player.ClassID != nil {
		delete(room.playerClass, *player.ClassID)
	}
	classCopy := classID
	player.ClassID = &classCopy
	session.ClassID = &classCopy
	room.playerClass[classID] = player

	snapshot := room.snapshot()
	senders := room.senders()
	m.mu.Unlock()

	broadcast(senders, RoomEvent{Type: "room_state", Room: snapshot})
	return snapshot, nil
}

func (m *Manager) joinLocked(room *Room, role string, reconnectToken string, classID *int, sender Sender) (JoinResult, error) {
	switch role {
	case RolePlayer:
		return room.joinPlayer(reconnectToken, classID, sender)
	case RoleGameScreen:
		return room.joinGameScreen(reconnectToken, sender)
	default:
		return JoinResult{}, ErrInvalidRole
	}
}

func (r *Room) joinPlayer(reconnectToken string, classID *int, sender Sender) (JoinResult, error) {
	reconnected := false
	var player *Player
	if classID != nil {
		if *classID < 0 {
			return JoinResult{}, ErrInvalidClass
		}
		player = r.playerClass[*classID]
	}
	if player == nil {
		player = r.playerToken[reconnectToken]
	}
	if reconnectToken != "" && player == nil {
		return JoinResult{}, ErrReconnectNotFound
	}

	if player == nil {
		seat, ok := r.nextSeat()
		if !ok {
			return JoinResult{}, ErrRoomFull
		}

		token, err := randomToken()
		if err != nil {
			return JoinResult{}, err
		}
		deviceID, err := randomID("dev")
		if err != nil {
			return JoinResult{}, err
		}

		player = &Player{
			Seat:     seat,
			Token:    token,
			DeviceID: deviceID,
		}
		if classID != nil {
			classCopy := *classID
			player.ClassID = &classCopy
			r.playerClass[classCopy] = player
		}
		r.players[seat] = player
		r.playerToken[token] = player
	} else {
		reconnected = true
	}

	replaced := player.sender
	player.Connected = true
	player.sender = sender

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
	screen := r.screens[reconnectToken]
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
		r.screens[token] = screen
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
	delete(r.players, player.Seat)
	delete(r.playerToken, player.Token)
	if player.ClassID != nil {
		delete(r.playerClass, *player.ClassID)
	}
}

func (r *Room) nextSeat() (int, bool) {
	for seat := 0; seat < r.MaxSeats; seat++ {
		if _, ok := r.players[seat]; !ok {
			return seat, true
		}
	}
	return 0, false
}

func (r *Room) snapshot() RoomSnapshot {
	players := make([]PlayerSnapshot, 0, len(r.players))
	for seat := 0; seat < r.MaxSeats; seat++ {
		player := r.players[seat]
		if player == nil {
			continue
		}
		players = append(players, PlayerSnapshot{
			Seat:      player.Seat,
			DeviceID:  player.DeviceID,
			ClassID:   copyInt(player.ClassID),
			Connected: player.Connected,
		})
	}

	gameScreens := 0
	for _, screen := range r.screens {
		if screen.Connected {
			gameScreens++
		}
	}

	return RoomSnapshot{
		Code:        r.Code,
		MaxSeats:    r.MaxSeats,
		Players:     players,
		GameScreens: gameScreens,
	}
}

func (r *Room) adminSnapshot() AdminRoomSnapshot {
	return AdminRoomSnapshot{
		RoomSnapshot: r.snapshot(),
		PIN:          r.PIN,
	}
}

func (r *Room) senders() []Sender {
	senders := make([]Sender, 0, len(r.players)+len(r.screens))
	for _, player := range r.players {
		if player.Connected && player.sender != nil {
			senders = append(senders, player.sender)
		}
	}
	for _, screen := range r.screens {
		if screen.Connected && screen.sender != nil {
			senders = append(senders, screen.sender)
		}
	}
	return senders
}

func (r *Room) sendersExcept(excluded Sender) []Sender {
	senders := make([]Sender, 0, len(r.players)+len(r.screens))
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

func randomID(prefix string) (string, error) {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(buf)), nil
}
