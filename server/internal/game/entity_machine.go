package game

// Draft records the face of the physical die the current player chose.
func (m *EntityMachine) Draft(seat, value int) error {
	if m == nil || m.Complete || m.Phase != EntityPhaseDrafting || m.DraftingEntity || m.CurrentPlayerSeat == nil || *m.CurrentPlayerSeat != seat || value < 1 || value > 6 {
		return ErrInvalidGameState
	}

	for index := range m.Hands {
		if m.Hands[index].Seat == nil || *m.Hands[index].Seat != seat {
			continue
		}
		if m.DraftPass == 1 {
			m.Hands[index].Left = copyInt(&value)
		} else {
			m.Hands[index].Right = copyInt(&value)
		}
		break
	}

	currentIndex := m.currentSeatIndex()
	if currentIndex < len(m.TurnOrder)-1 {
		next := m.TurnOrder[currentIndex+1]
		m.CurrentPlayerSeat = copyInt(&next)
		return nil
	}
	// The last player reports the entity's physical die after making their own
	// pick, preserving the table's drafting order.
	m.DraftingEntity = true
	return nil
}

// DraftEntity records the entity die chosen by the final player in order.
func (m *EntityMachine) DraftEntity(seat, value int) error {
	if m == nil || m.Complete || m.Phase != EntityPhaseDrafting || !m.DraftingEntity || m.CurrentPlayerSeat == nil || *m.CurrentPlayerSeat != seat || value < 1 || value > 6 {
		return ErrInvalidGameState
	}
	m.DraftingEntity = false
	if m.DraftPass == 1 {
		m.EntityHand.Left = copyInt(&value)
		m.DraftPass = 2
		first := m.TurnOrder[0]
		m.CurrentPlayerSeat = copyInt(&first)
		return nil
	}

	m.EntityHand.Right = copyInt(&value)
	m.Phase = EntityPhaseActions
	first := m.TurnOrder[0]
	m.CurrentPlayerSeat = copyInt(&first)
	return nil
}

// ResolvePlayerAction records a player action. Effects are table-adjudicated:
// rules are prose, so the acting player reports only the presence damage that
// action actually dealt. A zero value is a valid non-damaging action.
func (m *EntityMachine) ResolvePlayerAction(seat, presenceDamage int) error {
	if m == nil || m.Complete || m.Phase != EntityPhaseActions || m.CurrentPlayerSeat == nil || *m.CurrentPlayerSeat != seat || presenceDamage < 0 || presenceDamage > m.Presence {
		return ErrInvalidGameState
	}
	m.Presence -= presenceDamage
	m.History = append(m.History, EntityTurn{Seat: seat, Type: "player_action", PresenceDamage: presenceDamage})
	if m.Presence == 0 {
		m.Complete = true
		m.Phase = EntityPhaseComplete
		m.CurrentPlayerSeat = copyInt(m.FirstPlayerSeat)
		return nil
	}

	currentIndex := m.currentSeatIndex()
	if currentIndex < len(m.TurnOrder)-1 {
		next := m.TurnOrder[currentIndex+1]
		m.CurrentPlayerSeat = copyInt(&next)
		return nil
	}
	m.Phase = EntityPhaseEntity
	m.CurrentPlayerSeat = copyInt(m.FirstPlayerSeat)
	return nil
}

// ResolveEntityAction closes the entity phase and begins the next draft turn.
// Entity effects are likewise resolved at the table; this transition captures
// the phase boundary and rotates the first player.
func (m *EntityMachine) ResolveEntityAction(seat int) error {
	if m == nil || m.Complete || m.Phase != EntityPhaseEntity || m.CurrentPlayerSeat == nil || *m.CurrentPlayerSeat != seat {
		return ErrInvalidGameState
	}
	m.History = append(m.History, EntityTurn{Seat: seat, Type: "entity_action"})
	firstIndex := m.currentSeatIndex()
	next := m.TurnOrder[(firstIndex+1)%len(m.TurnOrder)]
	m.FirstPlayerSeat = copyInt(&next)
	m.CurrentPlayerSeat = copyInt(&next)
	m.CurrentTurn++
	m.DraftPass = 1
	m.Phase = EntityPhaseDrafting
	m.DraftingEntity = false
	m.EntityHand = EntityHand{}
	for index := range m.Hands {
		m.Hands[index].Left = nil
		m.Hands[index].Right = nil
	}
	return nil
}

func (m *EntityMachine) currentSeatIndex() int {
	if m.CurrentPlayerSeat == nil {
		return -1
	}
	for index, seat := range m.TurnOrder {
		if seat == *m.CurrentPlayerSeat {
			return index
		}
	}
	return -1
}
