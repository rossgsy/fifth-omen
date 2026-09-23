package game

import (
	"context"
	"sync"
)

const (
	RoleGameScreen = "gamescreen"
	RolePlayer     = "player"

	GamePhaseSetup   = "setup"
	GamePhasePlaying = "playing"

	RitualPhaseRitual    = "ritual"
	RitualPhaseEntity    = "entity"
	RitualPhaseEncounter = "encounter"
	RitualPhaseComplete  = "complete"

	DefaultMaxSeats = 6
	MaxSeatsLimit   = 6
	RoomCodeLength  = 5
	PINLength       = 6
	MaxTarotCard    = 21
)

type Sender interface {
	Send(v any) bool
	Close(reason string)
}

type Manager struct {
	mu       sync.Mutex
	rooms    map[string]*Room
	sessions map[string]*Session
	store    RoomStore
}

type Room struct {
	Code     string
	PIN      string
	MaxSeats int
	state    GameState
}

// GameState coordinates the machines for one room. Manager.mu protects this
// aggregate, so machine transitions and shared-state updates are atomic.
type GameState struct {
	SharedGameState
	Phase  string
	Ritual RitualMachine
	Entity *EntityMachine
}

// SharedGameState is mode-agnostic state available to every game machine.
type SharedGameState struct {
	Global      GlobalState
	players     map[int]*Player
	playerToken map[string]*Player
	playerClass map[int]*Player
	screens     map[string]*GameScreen
}

type GlobalState struct {
	Doom int `json:"doom"`
	Ward int `json:"ward"`
}

type GlobalStateUpdate struct {
	Doom *int `json:"doom,omitempty"`
	Ward *int `json:"ward,omitempty"`
}

// RitualMachine owns the ritual's turn, step, and card history.
type RitualMachine struct {
	Phase             string       `json:"phase"`
	CurrentStep       int          `json:"currentStep"`
	CurrentPlayerSeat *int         `json:"currentPlayerSeat,omitempty"`
	Steps             []RitualStep `json:"steps"`
	DrawnCards        []RitualCard `json:"drawnCards"`
}

// RitualState remains an alias for persisted and API-facing compatibility.
type RitualState = RitualMachine

type RitualStep struct {
	Title string `json:"title"`
	Kind  string `json:"kind"`
}

type RitualCard struct {
	Step        int    `json:"step"`
	TarotNumber *int   `json:"tarotNumber"`
	Resolved    bool   `json:"resolved"`
	Kind        string `json:"kind"`
}

// EntityMachine is created for each revealed entity. It owns a separate turn
// order and action history without changing the ritual machine's cursor.
type EntityMachine struct {
	CardTarotNumber   int          `json:"cardTarotNumber"`
	RitualStep        int          `json:"ritualStep"`
	CurrentPlayerSeat *int         `json:"currentPlayerSeat,omitempty"`
	TurnOrder         []int        `json:"turnOrder"`
	CurrentTurn       int          `json:"currentTurn"`
	History           []EntityTurn `json:"history"`
	Complete          bool         `json:"complete"`
}

type EntityTurn struct {
	Seat int    `json:"seat"`
	Type string `json:"type"`
}

type Player struct {
	Seat      int    `json:"seat"`
	DeviceID  string `json:"deviceId"`
	Token     string `json:"-"`
	Name      string `json:"name"`
	ClassID   *int   `json:"classId,omitempty"`
	Connected bool   `json:"connected"`
	sender    Sender
}

type GameScreen struct {
	DeviceID  string
	Token     string
	Connected bool
	sender    Sender
}

type Session struct {
	ID             string `json:"sessionId"`
	RoomCode       string `json:"roomCode"`
	Role           string `json:"role"`
	DeviceID       string `json:"deviceId"`
	Seat           *int   `json:"seat,omitempty"`
	ClassID        *int   `json:"classId,omitempty"`
	ReconnectToken string `json:"reconnectToken"`
	PlayerName     string `json:"playerName,omitempty"`
	sender         Sender
}

type CreateRoomRequest struct {
	Code     string `json:"code"`
	PIN      string `json:"pin"`
	MaxSeats int    `json:"maxSeats"`
}

type CreateRoomResult struct {
	Room RoomSnapshot `json:"room"`
	PIN  string       `json:"pin"`
}

type JoinRequest struct {
	RoomCode       string
	PIN            string
	Role           string
	ReconnectToken string
	PlayerName     string
	ClassID        *int
	Seat           *int
}

type JoinResult struct {
	Session     *Session     `json:"session"`
	Room        RoomSnapshot `json:"room"`
	Reconnected bool         `json:"reconnected"`
	replaced    Sender
}

type RoomSnapshot struct {
	Code        string           `json:"code"`
	MaxSeats    int              `json:"maxSeats"`
	Phase       string           `json:"phase"`
	Ritual      RitualState      `json:"ritual"`
	Entity      *EntityMachine   `json:"entity,omitempty"`
	Players     []PlayerSnapshot `json:"players"`
	GameScreens int              `json:"gameScreens"`
	Global      GlobalState      `json:"global"`
}

type AdminRoomSnapshot struct {
	RoomSnapshot
	PIN string `json:"pin"`
}

type PlayerSnapshot struct {
	Seat       int    `json:"seat"`
	DeviceID   string `json:"deviceId"`
	Name       string `json:"name"`
	ClassID    *int   `json:"classId,omitempty"`
	PlaybookID *int   `json:"playbookId,omitempty"`
	Connected  bool   `json:"connected"`
}

type RoomEvent struct {
	Type string       `json:"type"`
	Room RoomSnapshot `json:"room"`
}

func NewManager() *Manager {
	return &Manager{
		rooms:    make(map[string]*Room),
		sessions: make(map[string]*Session),
	}
}

func NewManagerWithStore(ctx context.Context, store RoomStore) (*Manager, error) {
	manager := NewManager()
	manager.store = store
	if store == nil {
		return manager, nil
	}

	rooms, err := store.LoadRooms(ctx)
	if err != nil {
		return nil, err
	}
	for _, storedRoom := range rooms {
		room, err := roomFromStored(storedRoom)
		if err != nil {
			return nil, err
		}
		manager.rooms[room.Code] = room
	}
	return manager, nil
}

var ritualSteps = []RitualStep{
	{Title: "First Card", Kind: "Entity"},
	{Title: "Second Card", Kind: "Encounter"},
	{Title: "Third Card", Kind: "Entity"},
	{Title: "Fourth Card", Kind: "Encounter"},
	{Title: "Final Card", Kind: "Entity"},
}
