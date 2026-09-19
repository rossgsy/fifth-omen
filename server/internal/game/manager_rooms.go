package game

import (
	"sort"
	"strings"
)

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
			Phase:       GamePhaseSetup,
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
