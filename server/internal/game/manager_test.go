package game

import "testing"

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

func TestPlayerSeatsAreAllocatedAndReservedForReconnect(t *testing.T) {
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

	if _, err := manager.Join(JoinRequest{
		RoomCode: "ABC12",
		PIN:      "123456",
		Role:     RolePlayer,
	}, &testSender{}); err != ErrRoomFull {
		t.Fatalf("join full room error = %v, want %v", err, ErrRoomFull)
	}

	reconnectSender := &testSender{}
	reconnect, err := manager.Join(JoinRequest{
		RoomCode:       "ABC12",
		PIN:            "123456",
		Role:           RolePlayer,
		ReconnectToken: first.Session.ReconnectToken,
	}, reconnectSender)
	if err != nil {
		t.Fatalf("reconnect first player: %v", err)
	}
	if !reconnect.Reconnected {
		t.Fatal("reconnect result was not marked as reconnected")
	}
	if reconnect.Session.Seat == nil || *reconnect.Session.Seat != 0 {
		t.Fatalf("reconnected player seat = %v, want 0", reconnect.Session.Seat)
	}
	if !firstSender.closed {
		t.Fatal("old sender was not closed during reconnect")
	}

	manager.Leave(first.Session.ID)
	snapshot, err := manager.Snapshot("ABC12")
	if err != nil {
		t.Fatalf("snapshot after old leave: %v", err)
	}
	if !snapshot.Players[0].Connected {
		t.Fatal("old session cleanup marked the reconnected player offline")
	}

	manager.Leave(reconnect.Session.ID)
	snapshot, err = manager.Snapshot("ABC12")
	if err != nil {
		t.Fatalf("snapshot after reconnect leave: %v", err)
	}
	if snapshot.Players[0].Connected {
		t.Fatal("current session cleanup left player marked online")
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
