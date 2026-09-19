package game

import "errors"

var (
	ErrInvalidJoin       = errors.New("invalid join request")
	ErrInvalidRoom       = errors.New("invalid room")
	ErrInvalidRoomCode   = errors.New("invalid room code")
	ErrInvalidPIN        = errors.New("invalid pin")
	ErrInvalidRole       = errors.New("invalid role")
	ErrInvalidClass      = errors.New("invalid class")
	ErrInvalidGameState  = errors.New("invalid game state")
	ErrClassTaken        = errors.New("class already taken")
	ErrRoomExists        = errors.New("room already exists")
	ErrRoomNotFound      = errors.New("room not found")
	ErrRoomFull          = errors.New("room is full")
	ErrReconnectNotFound = errors.New("reconnect token not found")
)
