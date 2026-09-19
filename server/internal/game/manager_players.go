package game

import "strings"

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
