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

func TestPlayerClassIsReleasedOnDisconnect(t *testing.T) {
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
		RoomCode: "ABC12",
		PIN:      "123456",
		Role:     RolePlayer,
	}, firstSender)
	if err != nil {
		t.Fatalf("join first player: %v", err)
	}
	if first.Session.Seat == nil || *first.Session.Seat != 0 {
		t.Fatalf("first player seat = %v, want 0", first.Session.Seat)
	}

	snapshot, err := manager.ClaimClass(first.Session.ID, 2)
	if err != nil {
		t.Fatalf("claim class: %v", err)
	}
	if snapshot.Players[0].ClassID == nil || *snapshot.Players[0].ClassID != 2 {
		t.Fatalf("claimed class = %v, want 2", snapshot.Players[0].ClassID)
	}

	second, err := manager.Join(JoinRequest{
		RoomCode: "abc12",
		PIN:      "123456",
		Role:     RolePlayer,
	}, &testSender{})
	if err != nil {
		t.Fatalf("join second player: %v", err)
	}
	if second.Session.Seat == nil || *second.Session.Seat != 1 {
		t.Fatalf("second player seat = %v, want 1", second.Session.Seat)
	}
	if _, err := manager.ClaimClass(second.Session.ID, 2); err != ErrClassTaken {
		t.Fatalf("claim taken class error = %v, want %v", err, ErrClassTaken)
	}

	manager.Leave(first.Session.ID)
	snapshot, err = manager.Snapshot("ABC12")
	if err != nil {
		t.Fatalf("snapshot after leave: %v", err)
	}
	if len(snapshot.Players) != 1 {
		t.Fatalf("players after leave = %d, want 1", len(snapshot.Players))
	}
	if snapshot.Players[0].Seat != 1 {
		t.Fatalf("remaining player seat = %d, want 1", snapshot.Players[0].Seat)
	}

	snapshot, err = manager.ClaimClass(second.Session.ID, 2)
	if err != nil {
		t.Fatalf("claim released class: %v", err)
	}
	if snapshot.Players[0].ClassID == nil || *snapshot.Players[0].ClassID != 2 {
		t.Fatalf("released class claim = %v, want 2", snapshot.Players[0].ClassID)
	}
}

func TestInvalidReconnectTokenIsRejected(t *testing.T) {
	manager := NewManager()
	if _, err := manager.CreateRoom(CreateRoomRequest{
		Code: "ROOM1",
		PIN:  "999999",
	}); err != nil {
		t.Fatalf("create room: %v", err)
	}

	_, err := manager.Join(JoinRequest{
		RoomCode:       "ROOM1",
		PIN:            "999999",
		Role:           RolePlayer,
		ReconnectToken: "missing",
	}, &testSender{})
	if err != ErrReconnectNotFound {
		t.Fatalf("join with invalid reconnect token error = %v, want %v", err, ErrReconnectNotFound)
	}
}

func TestGameScreenUpdatesGlobalState(t *testing.T) {
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

	doom, ward := 4, 7
	snapshot, err := manager.UpdateGlobalState(screen.Session.ID, GlobalStateUpdate{Doom: &doom, Ward: &ward})
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
	if _, err := manager.UpdateGlobalState(player.Session.ID, GlobalStateUpdate{Doom: &doom}); err != ErrInvalidJoin {
		t.Fatalf("player update error = %v, want %v", err, ErrInvalidJoin)
	}
}

func TestGlobalStateSurvivesDisconnects(t *testing.T) {
	manager := NewManager()
	if _, err := manager.CreateRoom(CreateRoomRequest{Code: "STATE", PIN: "123456"}); err != nil {
		t.Fatalf("create room: %v", err)
	}
	screen, err := manager.Join(JoinRequest{RoomCode: "STATE", PIN: "123456", Role: RoleGameScreen}, &testSender{})
	if err != nil {
		t.Fatalf("join game screen: %v", err)
	}
	ward := 3
	if _, err := manager.UpdateGlobalState(screen.Session.ID, GlobalStateUpdate{Ward: &ward}); err != nil {
		t.Fatalf("update global state: %v", err)
	}

	manager.Leave(screen.Session.ID)
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

	player, err := manager.Join(JoinRequest{RoomCode: "LOAD1", PIN: "123456", Role: RolePlayer}, &testSender{})
	if err != nil {
		t.Fatalf("join player: %v", err)
	}
	if _, err := manager.ClaimClass(player.Session.ID, 4); err != nil {
		t.Fatalf("claim class: %v", err)
	}

	screen, err := manager.Join(JoinRequest{RoomCode: "LOAD1", PIN: "123456", Role: RoleGameScreen}, &testSender{})
	if err != nil {
		t.Fatalf("join game screen: %v", err)
	}
	doom, ward := 6, 2
	if _, err := manager.UpdateGlobalState(screen.Session.ID, GlobalStateUpdate{Doom: &doom, Ward: &ward}); err != nil {
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
