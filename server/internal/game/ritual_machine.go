package game

// Reveal records the draw for the current ritual step and starts the machine
// that owns the resulting phase. Entity cards start an EntityMachine; an
// encounter is resolved directly by the ritual machine.
func (m *RitualMachine) Reveal(tarotNumber int, shared SharedGameState) (*EntityMachine, error) {
	*m = m.normalized()
	if tarotNumber < 0 || tarotNumber > MaxTarotCard || m.Phase != RitualPhaseRitual || m.CurrentStep >= len(m.Steps) {
		return nil, ErrInvalidGameState
	}

	card := &m.DrawnCards[m.CurrentStep]
	if card.TarotNumber != nil || card.Resolved {
		return nil, ErrInvalidGameState
	}
	card.TarotNumber = copyInt(&tarotNumber)

	switch card.Kind {
	case "Entity":
		m.Phase = RitualPhaseEntity
		return newEntityMachine(tarotNumber, m.CurrentStep, shared, m.CurrentPlayerSeat), nil
	case "Encounter":
		m.Phase = RitualPhaseEncounter
		return nil, nil
	default:
		return nil, ErrInvalidGameState
	}
}

// Resolve closes the current entity or encounter phase and advances the ritual
// to its next draw turn. An entity machine is completed as part of the same
// atomic transition.
func (m *RitualMachine) Resolve(shared SharedGameState, entity *EntityMachine) error {
	*m = m.normalized()
	if m.Phase != RitualPhaseEntity && m.Phase != RitualPhaseEncounter || m.CurrentStep >= len(m.Steps) {
		return ErrInvalidGameState
	}
	card := &m.DrawnCards[m.CurrentStep]
	if card.TarotNumber == nil {
		return ErrInvalidGameState
	}
	if m.Phase == RitualPhaseEntity {
		if entity == nil || entity.Complete {
			return ErrInvalidGameState
		}
		entity.resolveTurn()
	}

	card.Resolved = true
	if m.CurrentStep >= len(m.Steps)-1 {
		m.Phase = RitualPhaseComplete
		return nil
	}
	m.CurrentStep++
	m.Phase = RitualPhaseRitual
	m.CurrentPlayerSeat = nextRitualPlayerSeatFor(shared, m.CurrentPlayerSeat)
	return nil
}
