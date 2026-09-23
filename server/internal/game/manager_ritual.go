package game

func (m *Manager) BeginGame(sessionID string) (RoomSnapshot, error) {
	m.mu.Lock()
	session := m.sessions[sessionID]
	if session == nil || session.Role != RolePlayer || session.Seat == nil || *session.Seat != 0 {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidJoin
	}
	room := m.rooms[session.RoomCode]
	if room == nil {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrRoomNotFound
	}
	if room.state.phase() != GamePhaseSetup {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidGameState
	}
	player := room.state.players[0]
	if player == nil || player.Token != session.ReconnectToken || !player.Connected {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidJoin
	}

	firstSeat := 0
	room.state.Phase = GamePhasePlaying
	room.state.Ritual = newRitualState(&firstSeat)
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

func (m *Manager) RevealRitualCard(sessionID string, tarotNumber int) (RoomSnapshot, error) {
	if tarotNumber < 0 || tarotNumber > MaxTarotCard {
		return RoomSnapshot{}, ErrInvalidGameState
	}

	m.mu.Lock()
	session := m.sessions[sessionID]
	if session == nil {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidJoin
	}
	room := m.rooms[session.RoomCode]
	if room == nil {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrRoomNotFound
	}
	if room.state.phase() != GamePhasePlaying {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidGameState
	}
	room.state.Ritual = room.state.Ritual.normalized()
	if room.state.Ritual.Phase != RitualPhaseRitual || room.state.Ritual.CurrentStep >= len(ritualSteps) {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidGameState
	}
	if !canControlRitual(session, room) {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidJoin
	}
	entity, err := room.state.Ritual.Reveal(tarotNumber, room.state.SharedGameState)
	if err != nil {
		m.mu.Unlock()
		return RoomSnapshot{}, err
	}
	room.state.Entity = entity

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

func (m *Manager) ResolveRitualPhase(sessionID string) (RoomSnapshot, error) {
	m.mu.Lock()
	session := m.sessions[sessionID]
	if session == nil {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidJoin
	}
	room := m.rooms[session.RoomCode]
	if room == nil {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrRoomNotFound
	}
	if room.state.phase() != GamePhasePlaying {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidGameState
	}
	room.state.Ritual = room.state.Ritual.normalized()
	if room.state.Ritual.Phase != RitualPhaseEntity && room.state.Ritual.Phase != RitualPhaseEncounter {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidGameState
	}
	if room.state.Ritual.Phase == RitualPhaseEntity {
		if !canControlEntity(session, room) {
			m.mu.Unlock()
			return RoomSnapshot{}, ErrInvalidJoin
		}
	} else if !canControlRitual(session, room) {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidJoin
	}

	if err := room.state.Ritual.Resolve(room.state.SharedGameState, room.state.Entity); err != nil {
		m.mu.Unlock()
		return RoomSnapshot{}, err
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

func (m *Manager) DraftEntityDie(sessionID string, dieValue int) (RoomSnapshot, error) {
	return m.transitionEntity(sessionID, func(entity *EntityMachine, seat int) error {
		return entity.Draft(seat, dieValue)
	})
}

func (m *Manager) DraftEntityDieForEntity(sessionID string, dieValue int) (RoomSnapshot, error) {
	return m.transitionEntity(sessionID, func(entity *EntityMachine, seat int) error {
		return entity.DraftEntity(seat, dieValue)
	})
}

func (m *Manager) ResolveEntityPlayerAction(sessionID string, presenceDamage int) (RoomSnapshot, error) {
	return m.transitionEntity(sessionID, func(entity *EntityMachine, seat int) error {
		return entity.ResolvePlayerAction(seat, presenceDamage)
	})
}

func (m *Manager) ResolveEntityAction(sessionID string) (RoomSnapshot, error) {
	return m.transitionEntity(sessionID, func(entity *EntityMachine, seat int) error {
		return entity.ResolveEntityAction(seat)
	})
}

func (m *Manager) transitionEntity(sessionID string, transition func(*EntityMachine, int) error) (RoomSnapshot, error) {
	m.mu.Lock()
	session := m.sessions[sessionID]
	if session == nil {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidJoin
	}
	room := m.rooms[session.RoomCode]
	if room == nil {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrRoomNotFound
	}
	if room.state.phase() != GamePhasePlaying || room.state.Ritual.Phase != RitualPhaseEntity || !canControlEntity(session, room) {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidGameState
	}
	if err := transition(room.state.Entity, *session.Seat); err != nil {
		m.mu.Unlock()
		return RoomSnapshot{}, err
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

// UpdateGlobalState applies one atomic room-state transition. Only a connected
// player device may change shared trackers, and omitted fields retain their
// values.
func (m *Manager) UpdateGlobalState(sessionID string, update GlobalStateUpdate) (RoomSnapshot, error) {
	if (update.Doom == nil && update.Ward == nil) || !validTracker(update.Doom) || !validTracker(update.Ward) {
		return RoomSnapshot{}, ErrInvalidGameState
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
	if player == nil || player.Token != session.ReconnectToken || !player.Connected {
		m.mu.Unlock()
		return RoomSnapshot{}, ErrInvalidJoin
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
