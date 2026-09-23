package game

import (
	"context"
	"testing"
)

type testSender struct {
	closed bool
	sent   []any
}

func (s *testSender) Send(v any) bool {
	s.sent = append(s.sent, v)
	return true
}

func (s *testSender) Close(string) {
	s.closed = true
}

type memoryRoomStore struct {
	rooms map[string]StoredRoom
}

func newMemoryRoomStore() *memoryRoomStore {
	return &memoryRoomStore{rooms: make(map[string]StoredRoom)}
}

func (s *memoryRoomStore) LoadRooms(context.Context) ([]StoredRoom, error) {
	rooms := make([]StoredRoom, 0, len(s.rooms))
	for _, room := range s.rooms {
		rooms = append(rooms, room)
	}
	return rooms, nil
}

func (s *memoryRoomStore) SaveRoom(_ context.Context, room StoredRoom) error {
	s.rooms[room.Code] = room
	return nil
}

func (s *memoryRoomStore) DeleteRoom(_ context.Context, code string) error {
	delete(s.rooms, normalizeRoomCode(code))
	return nil
}

func TestPlayersChooseSeatsAndSeatClassesLock(t *testing.T) {
	manager := NewManager()
	if _, err := manager.CreateRoom(CreateRoomRequest{
		Code:     "abc12",
		PIN:      "123456",
		MaxSeats: 2,
	}); err != nil {
		t.Fatalf("create room: %v", err)
	}

	firstSender := &testSender{}
	first, err := manager.Join(JoinRequest{
		RoomCode:   "ABC12",
		PIN:        "123456",
		Role:       RolePlayer,
		PlayerName: "Mara",
	}, firstSender)
	if err != nil {
		t.Fatalf("join first player: %v", err)
	}
	if first.Session.Seat != nil {
		t.Fatalf("first player seat = %v, want nil before seat selection", first.Session.Seat)
	}
	snapshot, err := manager.ClaimSeat(first.Session.ID, 0)
	if err != nil {
		t.Fatalf("claim first seat: %v", err)
	}
	if len(snapshot.Players) != 1 || snapshot.Players[0].Seat != 0 || !snapshot.Players[0].Connected {
		t.Fatalf("first seat snapshot = %+v, want connected seat 0", snapshot.Players)
	}

	snapshot, err = manager.ClaimClass(first.Session.ID, 2)
	if err != nil {
		t.Fatalf("claim class: %v", err)
	}
	if snapshot.Players[0].ClassID == nil || *snapshot.Players[0].ClassID != 2 {
		t.Fatalf("claimed class = %v, want 2", snapshot.Players[0].ClassID)
	}
	if snapshot.Players[0].Name != "Mara" || snapshot.Players[0].PlaybookID == nil || *snapshot.Players[0].PlaybookID != 2 {
		t.Fatalf("snapshot player = %+v, want name Mara and playbook 2", snapshot.Players[0])
	}

	second, err := manager.Join(JoinRequest{
		RoomCode: "abc12",
		PIN:      "123456",
		Role:     RolePlayer,
	}, &testSender{})
	if err != nil {
		t.Fatalf("join second player: %v", err)
	}
	if _, err := manager.ClaimSeat(second.Session.ID, 0); err != ErrSeatOccupied {
		t.Fatalf("claim occupied seat error = %v, want %v", err, ErrSeatOccupied)
	}
	if _, err := manager.ClaimSeat(second.Session.ID, 1); err != nil {
		t.Fatalf("claim second seat: %v", err)
	}
	if _, err := manager.ClaimClass(second.Session.ID, 2); err != ErrClassTaken {
		t.Fatalf("claim taken class error = %v, want %v", err, ErrClassTaken)
	}

	manager.Leave(first.Session.ID)
	snapshot, err = manager.Snapshot("ABC12")
	if err != nil {
		t.Fatalf("snapshot after leave: %v", err)
	}
	if len(snapshot.Players) != 2 {
		t.Fatalf("players after disconnect = %d, want 2", len(snapshot.Players))
	}
	if snapshot.Players[0].Connected {
		t.Fatal("disconnected player should remain in room but not be connected")
	}

	if _, err := manager.ClaimSeat(second.Session.ID, 0); err != nil {
		t.Fatalf("claim disconnected open seat: %v", err)
	}
	snapshot, err = manager.Snapshot("ABC12")
	if err != nil {
		t.Fatalf("snapshot after taking open seat: %v", err)
	}
	if len(snapshot.Players) != 2 || snapshot.Players[0].Connected == false {
		t.Fatalf("snapshot after taking open seat = %+v, want seat 0 connected", snapshot.Players)
	}

	snapshot, err = manager.ClaimClass(second.Session.ID, 2)
	if err != nil {
		t.Fatalf("confirm locked seat class: %v", err)
	}
	if snapshot.Players[0].ClassID == nil || *snapshot.Players[0].ClassID != 2 {
		t.Fatalf("locked seat class = %v, want 2", snapshot.Players[0].ClassID)
	}

	firstReconnected, err := manager.Join(JoinRequest{
		RoomCode:       "abc12",
		PIN:            "123456",
		Role:           RolePlayer,
		ReconnectToken: first.Session.ReconnectToken,
	}, &testSender{})
	if err != nil {
		t.Fatalf("reconnect first player: %v", err)
	}
	if firstReconnected.Session.Seat != nil {
		t.Fatalf("reconnect into occupied previous seat = %v, want nil", firstReconnected.Session.Seat)
	}
}

func TestPlayerUpdatesGlobalState(t *testing.T) {
	manager := NewManager()
	if _, err := manager.CreateRoom(CreateRoomRequest{Code: "STATE", PIN: "123456"}); err != nil {
		t.Fatalf("create room: %v", err)
	}

	screenSender := &testSender{}
	screen, err := manager.Join(JoinRequest{
		RoomCode: "STATE",
		PIN:      "123456",
		Role:     RoleGameScreen,
	}, screenSender)
	if err != nil {
		t.Fatalf("join game screen: %v", err)
	}
	playerSender := &testSender{}
	player, err := manager.Join(JoinRequest{
		RoomCode: "STATE",
		PIN:      "123456",
		Role:     RolePlayer,
	}, playerSender)
	if err != nil {
		t.Fatalf("join player: %v", err)
	}
	if _, err := manager.ClaimSeat(player.Session.ID, 0); err != nil {
		t.Fatalf("claim player seat: %v", err)
	}

	doom, ward := 4, 7
	snapshot, err := manager.UpdateGlobalState(player.Session.ID, GlobalStateUpdate{Doom: &doom, Ward: &ward})
	if err != nil {
		t.Fatalf("update global state: %v", err)
	}
	if snapshot.Global.Doom != doom || snapshot.Global.Ward != ward {
		t.Fatalf("global state = %+v, want doom=%d ward=%d", snapshot.Global, doom, ward)
	}
	if len(screenSender.sent) == 0 || len(playerSender.sent) == 0 {
		t.Fatal("global state update was not broadcast to all devices")
	}

	invalid := 11
	if _, err := manager.UpdateGlobalState(screen.Session.ID, GlobalStateUpdate{Doom: &invalid}); err != ErrInvalidGameState {
		t.Fatalf("invalid tracker error = %v, want %v", err, ErrInvalidGameState)
	}
	if _, err := manager.UpdateGlobalState(screen.Session.ID, GlobalStateUpdate{Doom: &doom}); err != ErrInvalidJoin {
		t.Fatalf("game screen update error = %v, want %v", err, ErrInvalidJoin)
	}
}

func TestOnlyFirstSeatBeginsSetupGame(t *testing.T) {
	manager := NewManager()
	if _, err := manager.CreateRoom(CreateRoomRequest{Code: "BEGIN", PIN: "123456", MaxSeats: 2}); err != nil {
		t.Fatalf("create room: %v", err)
	}

	first, err := manager.Join(JoinRequest{RoomCode: "BEGIN", PIN: "123456", Role: RolePlayer}, &testSender{})
	if err != nil {
		t.Fatalf("join first player: %v", err)
	}
	if _, err := manager.ClaimSeat(first.Session.ID, 0); err != nil {
		t.Fatalf("claim first seat: %v", err)
	}

	second, err := manager.Join(JoinRequest{RoomCode: "BEGIN", PIN: "123456", Role: RolePlayer}, &testSender{})
	if err != nil {
		t.Fatalf("join second player: %v", err)
	}
	if _, err := manager.ClaimSeat(second.Session.ID, 1); err != nil {
		t.Fatalf("claim second seat: %v", err)
	}

	if _, err := manager.BeginGame(second.Session.ID); err != ErrInvalidJoin {
		t.Fatalf("second seat begin error = %v, want %v", err, ErrInvalidJoin)
	}

	snapshot, err := manager.BeginGame(first.Session.ID)
	if err != nil {
		t.Fatalf("first seat begin: %v", err)
	}
	if snapshot.Phase != GamePhasePlaying {
		t.Fatalf("phase after begin = %q, want %q", snapshot.Phase, GamePhasePlaying)
	}
	if _, err := manager.BeginGame(first.Session.ID); err != ErrInvalidGameState {
		t.Fatalf("second begin error = %v, want %v", err, ErrInvalidGameState)
	}
}

func TestRitualFlowRevealsResolvesAndAdvancesPlayers(t *testing.T) {
	manager := NewManager()
	if _, err := manager.CreateRoom(CreateRoomRequest{Code: "RITES", PIN: "123456", MaxSeats: 2}); err != nil {
		t.Fatalf("create room: %v", err)
	}

	first, err := manager.Join(JoinRequest{RoomCode: "RITES", PIN: "123456", Role: RolePlayer}, &testSender{})
	if err != nil {
		t.Fatalf("join first player: %v", err)
	}
	if _, err := manager.ClaimSeat(first.Session.ID, 0); err != nil {
		t.Fatalf("claim first seat: %v", err)
	}
	if _, err := manager.ClaimClass(first.Session.ID, 1); err != nil {
		t.Fatalf("claim first class: %v", err)
	}
	second, err := manager.Join(JoinRequest{RoomCode: "RITES", PIN: "123456", Role: RolePlayer}, &testSender{})
	if err != nil {
		t.Fatalf("join second player: %v", err)
	}
	if _, err := manager.ClaimSeat(second.Session.ID, 1); err != nil {
		t.Fatalf("claim second seat: %v", err)
	}
	if _, err := manager.ClaimClass(second.Session.ID, 2); err != nil {
		t.Fatalf("claim second class: %v", err)
	}

	if _, err := manager.BeginGame(first.Session.ID); err != nil {
		t.Fatalf("begin game: %v", err)
	}
	if _, err := manager.RevealRitualCard(second.Session.ID, 3); err != ErrInvalidJoin {
		t.Fatalf("non-current player reveal error = %v, want %v", err, ErrInvalidJoin)
	}
	snapshot, err := manager.RevealRitualCard(first.Session.ID, 3)
	if err != nil {
		t.Fatalf("reveal first card: %v", err)
	}
	if snapshot.Ritual.Phase != RitualPhaseEntity {
		t.Fatalf("ritual phase after first reveal = %q, want %q", snapshot.Ritual.Phase, RitualPhaseEntity)
	}
	if snapshot.Ritual.DrawnCards[0].TarotNumber == nil || *snapshot.Ritual.DrawnCards[0].TarotNumber != 3 {
		t.Fatalf("first ritual card = %+v, want tarot 3", snapshot.Ritual.DrawnCards[0])
	}
	if snapshot.Entity == nil || snapshot.Entity.CardTarotNumber != 3 || snapshot.Entity.CurrentPlayerSeat == nil || *snapshot.Entity.CurrentPlayerSeat != 0 {
		t.Fatalf("entity machine after reveal = %+v, want entity card 3 controlled by seat 0", snapshot.Entity)
	}

	snapshot, err = manager.ResolveRitualPhase(first.Session.ID)
	if err != nil {
		t.Fatalf("resolve first card: %v", err)
	}
	if snapshot.Ritual.Phase != RitualPhaseRitual || snapshot.Ritual.CurrentStep != 1 {
		t.Fatalf("ritual after resolve = %+v, want ritual step 1", snapshot.Ritual)
	}
	if snapshot.Ritual.CurrentPlayerSeat == nil || *snapshot.Ritual.CurrentPlayerSeat != 1 {
		t.Fatalf("current ritual player = %v, want seat 1", snapshot.Ritual.CurrentPlayerSeat)
	}
	if snapshot.Entity == nil || !snapshot.Entity.Complete || len(snapshot.Entity.History) != 1 || snapshot.Entity.History[0].Seat != 0 {
		t.Fatalf("resolved entity machine = %+v, want one completed turn for seat 0", snapshot.Entity)
	}

	snapshot, err = manager.RevealRitualCard(second.Session.ID, 8)
	if err != nil {
		t.Fatalf("reveal second card: %v", err)
	}
	if snapshot.Ritual.Phase != RitualPhaseEncounter {
		t.Fatalf("ritual phase after second reveal = %q, want %q", snapshot.Ritual.Phase, RitualPhaseEncounter)
	}
}

func TestGlobalStateSurvivesDisconnects(t *testing.T) {
	manager := NewManager()
	if _, err := manager.CreateRoom(CreateRoomRequest{Code: "STATE", PIN: "123456"}); err != nil {
		t.Fatalf("create room: %v", err)
	}
	player, err := manager.Join(JoinRequest{RoomCode: "STATE", PIN: "123456", Role: RolePlayer}, &testSender{})
	if err != nil {
		t.Fatalf("join player: %v", err)
	}
	if _, err := manager.ClaimSeat(player.Session.ID, 0); err != nil {
		t.Fatalf("claim player seat: %v", err)
	}
	ward := 3
	if _, err := manager.UpdateGlobalState(player.Session.ID, GlobalStateUpdate{Ward: &ward}); err != nil {
		t.Fatalf("update global state: %v", err)
	}

	manager.Leave(player.Session.ID)
	snapshot, err := manager.Snapshot("STATE")
	if err != nil {
		t.Fatalf("snapshot: %v", err)
	}
	if snapshot.Global.Ward != ward {
		t.Fatalf("ward after disconnect = %d, want %d", snapshot.Global.Ward, ward)
	}
}

func TestManagerLoadsPersistedRooms(t *testing.T) {
	store := newMemoryRoomStore()
	manager, err := NewManagerWithStore(context.Background(), store)
	if err != nil {
		t.Fatalf("new manager with store: %v", err)
	}
	if _, err := manager.CreateRoom(CreateRoomRequest{Code: "LOAD1", PIN: "123456", MaxSeats: 3}); err != nil {
		t.Fatalf("create room: %v", err)
	}

	player, err := manager.Join(JoinRequest{RoomCode: "LOAD1", PIN: "123456", Role: RolePlayer, PlayerName: "Iris"}, &testSender{})
	if err != nil {
		t.Fatalf("join player: %v", err)
	}
	if _, err := manager.ClaimSeat(player.Session.ID, 0); err != nil {
		t.Fatalf("claim seat: %v", err)
	}
	if _, err := manager.ClaimClass(player.Session.ID, 4); err != nil {
		t.Fatalf("claim class: %v", err)
	}

	_, err = manager.Join(JoinRequest{RoomCode: "LOAD1", PIN: "123456", Role: RoleGameScreen}, &testSender{})
	if err != nil {
		t.Fatalf("join game screen: %v", err)
	}
	doom, ward := 6, 2
	if _, err := manager.UpdateGlobalState(player.Session.ID, GlobalStateUpdate{Doom: &doom, Ward: &ward}); err != nil {
		t.Fatalf("update global state: %v", err)
	}

	reloaded, err := NewManagerWithStore(context.Background(), store)
	if err != nil {
		t.Fatalf("reload manager: %v", err)
	}
	snapshot, err := reloaded.Snapshot("load1")
	if err != nil {
		t.Fatalf("snapshot reloaded room: %v", err)
	}
	if snapshot.Global.Doom != doom || snapshot.Global.Ward != ward {
		t.Fatalf("reloaded global = %+v, want doom=%d ward=%d", snapshot.Global, doom, ward)
	}
	if len(snapshot.Players) != 1 {
		t.Fatalf("reloaded players = %d, want 1", len(snapshot.Players))
	}
	if snapshot.Players[0].Connected {
		t.Fatal("reloaded player should start disconnected")
	}
	if snapshot.Players[0].ClassID == nil || *snapshot.Players[0].ClassID != 4 {
		t.Fatalf("reloaded class = %v, want 4", snapshot.Players[0].ClassID)
	}
	if snapshot.Players[0].Name != "Iris" || snapshot.Players[0].PlaybookID == nil || *snapshot.Players[0].PlaybookID != 4 {
		t.Fatalf("reloaded player = %+v, want name Iris and playbook 4", snapshot.Players[0])
	}
	if snapshot.GameScreens != 0 {
		t.Fatalf("reloaded connected game screens = %d, want 0", snapshot.GameScreens)
	}

	reconnected, err := reloaded.Join(JoinRequest{
		RoomCode:       "LOAD1",
		PIN:            "123456",
		Role:           RolePlayer,
		ReconnectToken: player.Session.ReconnectToken,
	}, &testSender{})
	if err != nil {
		t.Fatalf("reconnect persisted player: %v", err)
	}
	if !reconnected.Reconnected {
		t.Fatal("persisted player reconnect was not recognized")
	}
	if reconnected.Session.Seat == nil || *reconnected.Session.Seat != *player.Session.Seat {
		t.Fatalf("reconnected seat = %v, want %d", reconnected.Session.Seat, *player.Session.Seat)
	}
}
