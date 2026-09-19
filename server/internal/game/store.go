package game

import (
	"context"
	"fmt"
)

type RoomStore interface {
	LoadRooms(ctx context.Context) ([]StoredRoom, error)
	SaveRoom(ctx context.Context, room StoredRoom) error
	DeleteRoom(ctx context.Context, code string) error
}

type StoredRoom struct {
	Version  int            `json:"version"`
	Code     string         `json:"code"`
	PIN      string         `json:"pin"`
	MaxSeats int            `json:"maxSeats"`
	Global   GlobalState    `json:"global"`
	Players  []StoredPlayer `json:"players"`
	Screens  []StoredScreen `json:"screens"`
}

type StoredPlayer struct {
	Seat     int    `json:"seat"`
	DeviceID string `json:"deviceId"`
	Token    string `json:"token"`
	Name     string `json:"name"`
	ClassID  *int   `json:"classId,omitempty"`
}

type StoredScreen struct {
	DeviceID string `json:"deviceId"`
	Token    string `json:"token"`
}

func (r *Room) stored() StoredRoom {
	players := make([]StoredPlayer, 0, len(r.state.players))
	for seat := 0; seat < r.MaxSeats; seat++ {
		player := r.state.players[seat]
		if player == nil {
			continue
		}
		players = append(players, StoredPlayer{
			Seat:     player.Seat,
			DeviceID: player.DeviceID,
			Token:    player.Token,
			Name:     player.Name,
			ClassID:  copyInt(player.ClassID),
		})
	}

	screens := make([]StoredScreen, 0, len(r.state.screens))
	for _, screen := range r.state.screens {
		screens = append(screens, StoredScreen{
			DeviceID: screen.DeviceID,
			Token:    screen.Token,
		})
	}

	return StoredRoom{
		Version:  1,
		Code:     r.Code,
		PIN:      r.PIN,
		MaxSeats: r.MaxSeats,
		Global:   r.state.Global,
		Players:  players,
		Screens:  screens,
	}
}

func roomFromStored(stored StoredRoom) (*Room, error) {
	code := normalizeRoomCode(stored.Code)
	if !validRoomCode(code) {
		return nil, fmt.Errorf("%w: stored room has invalid code %q", ErrInvalidRoom, stored.Code)
	}
	if !validPIN(stored.PIN) {
		return nil, fmt.Errorf("%w: stored room %s has invalid pin", ErrInvalidRoom, code)
	}
	if stored.MaxSeats <= 0 {
		stored.MaxSeats = DefaultMaxSeats
	} else if stored.MaxSeats > MaxSeatsLimit {
		stored.MaxSeats = MaxSeatsLimit
	}
	if !validTracker(&stored.Global.Doom) || !validTracker(&stored.Global.Ward) {
		return nil, fmt.Errorf("%w: stored room %s has invalid global state", ErrInvalidRoom, code)
	}

	room := &Room{
		Code:     code,
		PIN:      stored.PIN,
		MaxSeats: stored.MaxSeats,
		state: roomState{
			Global:      stored.Global,
			players:     make(map[int]*Player),
			playerToken: make(map[string]*Player),
			playerClass: make(map[int]*Player),
			screens:     make(map[string]*GameScreen),
		},
	}

	for _, storedPlayer := range stored.Players {
		if storedPlayer.Seat < 0 || storedPlayer.Seat >= room.MaxSeats || storedPlayer.DeviceID == "" || storedPlayer.Token == "" {
			return nil, fmt.Errorf("%w: stored room %s has invalid player", ErrInvalidRoom, code)
		}
		if room.state.players[storedPlayer.Seat] != nil || room.state.playerToken[storedPlayer.Token] != nil {
			return nil, fmt.Errorf("%w: stored room %s has duplicate player", ErrInvalidRoom, code)
		}
		if storedPlayer.ClassID != nil {
			if *storedPlayer.ClassID < 0 || room.state.playerClass[*storedPlayer.ClassID] != nil {
				return nil, fmt.Errorf("%w: stored room %s has invalid class claim", ErrInvalidRoom, code)
			}
		}

		player := &Player{
			Seat:      storedPlayer.Seat,
			DeviceID:  storedPlayer.DeviceID,
			Token:     storedPlayer.Token,
			Name:      storedPlayer.Name,
			ClassID:   copyInt(storedPlayer.ClassID),
			Connected: false,
		}
		room.state.players[player.Seat] = player
		room.state.playerToken[player.Token] = player
		if player.ClassID != nil {
			room.state.playerClass[*player.ClassID] = player
		}
	}

	for _, storedScreen := range stored.Screens {
		if storedScreen.DeviceID == "" || storedScreen.Token == "" {
			return nil, fmt.Errorf("%w: stored room %s has invalid game screen", ErrInvalidRoom, code)
		}
		if room.state.screens[storedScreen.Token] != nil {
			return nil, fmt.Errorf("%w: stored room %s has duplicate game screen", ErrInvalidRoom, code)
		}
		room.state.screens[storedScreen.Token] = &GameScreen{
			DeviceID:  storedScreen.DeviceID,
			Token:     storedScreen.Token,
			Connected: false,
		}
	}

	return room, nil
}
