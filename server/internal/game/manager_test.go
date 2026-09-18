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
