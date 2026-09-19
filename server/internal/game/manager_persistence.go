package game

import "context"

func (m *Manager) saveRoomLocked(room *Room) error {
	if m.store == nil {
		return nil
	}
	return m.store.SaveRoom(context.Background(), room.stored())
}

func (m *Manager) deleteRoomLocked(code string) error {
	if m.store == nil {
		return nil
	}
	return m.store.DeleteRoom(context.Background(), code)
}
