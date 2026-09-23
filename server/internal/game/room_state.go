package game

import "sort"

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
		Phase:       r.state.phase(),
		Ritual:      r.state.Ritual.normalized(),
		Entity:      r.state.Entity.clone(),
		Players:     players,
		GameScreens: gameScreens,
		Global:      r.state.Global,
	}
}

func (s GameState) phase() string {
	if s.Phase == "" {
		return GamePhaseSetup
	}
	return s.Phase
}

func newRitualState(currentPlayerSeat *int) RitualMachine {
	drawnCards := make([]RitualCard, len(ritualSteps))
	for index, step := range ritualSteps {
		drawnCards[index] = RitualCard{
			Step: index,
			Kind: step.Kind,
		}
	}
	return RitualState{
		Phase:             RitualPhaseRitual,
		CurrentStep:       0,
		CurrentPlayerSeat: copyInt(currentPlayerSeat),
		Steps:             copyRitualSteps(ritualSteps),
		DrawnCards:        drawnCards,
	}
}

func (s RitualState) normalized() RitualState {
	if len(s.Steps) == 0 {
		s.Steps = copyRitualSteps(ritualSteps)
	}
	if len(s.DrawnCards) != len(s.Steps) {
		drawnCards := make([]RitualCard, len(s.Steps))
		for index, step := range s.Steps {
			drawnCards[index] = RitualCard{
				Step: index,
				Kind: step.Kind,
			}
			if index < len(s.DrawnCards) {
				drawnCards[index].TarotNumber = copyInt(s.DrawnCards[index].TarotNumber)
				drawnCards[index].Resolved = s.DrawnCards[index].Resolved
			}
		}
		s.DrawnCards = drawnCards
	}
	for index := range s.DrawnCards {
		s.DrawnCards[index].Step = index
		if s.DrawnCards[index].Kind == "" && index < len(s.Steps) {
			s.DrawnCards[index].Kind = s.Steps[index].Kind
		}
	}
	if s.CurrentStep < 0 {
		s.CurrentStep = 0
	}
	if s.CurrentStep > len(s.Steps) {
		s.CurrentStep = len(s.Steps)
	}
	if s.Phase == "" {
		s.Phase = RitualPhaseRitual
	}
	return s
}

func copyRitualSteps(steps []RitualStep) []RitualStep {
	copied := make([]RitualStep, len(steps))
	copy(copied, steps)
	return copied
}

func canControlRitual(session *Session, room *Room) bool {
	if session.Role != RolePlayer || session.Seat == nil {
		return false
	}
	currentSeat := room.state.Ritual.CurrentPlayerSeat
	if currentSeat == nil || *currentSeat != *session.Seat {
		return false
	}
	player := room.state.players[*session.Seat]
	return player != nil && player.Token == session.ReconnectToken && player.Connected
}

func canControlEntity(session *Session, room *Room) bool {
	if session.Role != RolePlayer || session.Seat == nil || room.state.Entity == nil {
		return false
	}
	currentSeat := room.state.Entity.CurrentPlayerSeat
	if currentSeat == nil || *currentSeat != *session.Seat {
		return false
	}
	player := room.state.players[*session.Seat]
	return player != nil && player.Token == session.ReconnectToken && player.Connected
}

func nextRitualPlayerSeat(room *Room, currentSeat *int) *int {
	return nextRitualPlayerSeatFor(room.state.SharedGameState, currentSeat)
}

func nextRitualPlayerSeatFor(shared SharedGameState, currentSeat *int) *int {
	seats := eligiblePlayerSeats(shared)
	if len(seats) == 0 {
		return copyInt(currentSeat)
	}
	sort.Ints(seats)
	if currentSeat == nil {
		return copyInt(&seats[0])
	}
	for _, seat := range seats {
		if seat > *currentSeat {
			return copyInt(&seat)
		}
	}
	return copyInt(&seats[0])
}

func eligiblePlayerSeats(shared SharedGameState) []int {
	seats := make([]int, 0, len(shared.players))
	for seat, player := range shared.players {
		if player != nil && player.ClassID != nil {
			seats = append(seats, seat)
		}
	}
	sort.Ints(seats)
	return seats
}

func newEntityMachine(cardTarotNumber, ritualStep int, shared SharedGameState, currentSeat *int) *EntityMachine {
	turnOrder := eligiblePlayerSeats(shared)
	if len(turnOrder) == 0 && currentSeat != nil {
		turnOrder = []int{*currentSeat}
	}
	entity := &EntityMachine{
		CardTarotNumber: cardTarotNumber,
		RitualStep:      ritualStep,
		TurnOrder:       turnOrder,
		CurrentTurn:     0,
	}
	if len(turnOrder) > 0 {
		entity.CurrentPlayerSeat = copyInt(&turnOrder[0])
	}
	return entity
}

func (m *EntityMachine) resolveTurn() {
	if m == nil || m.Complete {
		return
	}
	if m.CurrentPlayerSeat != nil {
		m.History = append(m.History, EntityTurn{Seat: *m.CurrentPlayerSeat, Type: "resolved"})
	}
	m.Complete = true
}

func (m *EntityMachine) clone() *EntityMachine {
	if m == nil {
		return nil
	}
	clone := *m
	clone.CurrentPlayerSeat = copyInt(m.CurrentPlayerSeat)
	clone.TurnOrder = append([]int(nil), m.TurnOrder...)
	clone.History = append([]EntityTurn(nil), m.History...)
	return &clone
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
