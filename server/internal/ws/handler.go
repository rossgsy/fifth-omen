package ws

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/rossgsy/fifth-omen/server/internal/game"
	"github.com/rossgsy/fifth-omen/server/internal/httperr"
)

const sendTimeout = 5 * time.Second

type ServerMessage struct {
	Type string `json:"type"`
	Data any    `json:"data,omitempty"`
}

type ClientMessage struct {
	Type    string `json:"type"`
	ClassID *int   `json:"classId,omitempty"`
}

type client struct {
	conn   *websocket.Conn
	logger *log.Logger
	send   chan any
	done   chan struct{}
	once   sync.Once
}

func Handler(logger *log.Logger, manager *game.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			OriginPatterns: []string{
				"localhost:*",
				"127.0.0.1:*",
			},
		})
		if err != nil {
			httperr.Write(w, httperr.New(http.StatusBadRequest, "websocket_upgrade_failed", "Could not upgrade request"))
			return
		}

		c := newClient(conn, logger)
		defer c.Close("connection closed")

		join, err := manager.Join(joinRequest(r), c)
		if err != nil {
			c.closeWithError(closeStatus(err), err.Error())
			return
		}
		defer manager.Leave(join.Session.ID)

		c.Send(ServerMessage{
			Type: "joined",
			Data: join,
		})

		go c.writeLoop(r.Context())
		c.readLoop(r.Context(), manager, join.Session.ID)
	}
}

func joinRequest(r *http.Request) game.JoinRequest {
	query := r.URL.Query()
	req := game.JoinRequest{
		RoomCode:       query.Get("room"),
		PIN:            query.Get("pin"),
		Role:           query.Get("role"),
		ReconnectToken: query.Get("reconnect_token"),
	}
	if classValue := query.Get("class"); classValue != "" {
		classID, err := strconv.Atoi(classValue)
		if err == nil {
			req.ClassID = &classID
		}
	}
	return req
}

func newClient(conn *websocket.Conn, logger *log.Logger) *client {
	return &client{
		conn:   conn,
		logger: logger,
		send:   make(chan any, 16),
		done:   make(chan struct{}),
	}
}

func (c *client) Send(v any) bool {
	select {
	case <-c.done:
		return false
	case c.send <- v:
		return true
	default:
		c.Close("outbound websocket buffer full")
		return false
	}
}

func (c *client) Close(reason string) {
	c.once.Do(func() {
		close(c.done)
		c.conn.Close(websocket.StatusNormalClosure, reason)
	})
}

func (c *client) closeWithError(status websocket.StatusCode, reason string) {
	c.once.Do(func() {
		close(c.done)
		c.conn.Close(status, reason)
	})
}

func (c *client) readLoop(ctx context.Context, manager *game.Manager, sessionID string) {
	for {
		var msg ClientMessage
		if err := wsjson.Read(ctx, c.conn, &msg); err != nil {
			if websocket.CloseStatus(err) == websocket.StatusNormalClosure || errors.Is(err, context.Canceled) {
				return
			}
			c.logger.Printf("websocket read failed: %v", err)
			return
		}

		if msg.Type == "ping" {
			c.Send(ServerMessage{Type: "pong"})
		}
		if msg.Type == "select_class" && msg.ClassID != nil {
			room, err := manager.ClaimClass(sessionID, *msg.ClassID)
			if err != nil {
				c.Send(ServerMessage{
					Type: "error",
					Data: map[string]string{
						"code":    errorCode(err),
						"message": err.Error(),
					},
				})
				continue
			}
			c.Send(ServerMessage{
				Type: "class_selected",
				Data: map[string]any{
					"classId": *msg.ClassID,
					"room":    room,
				},
			})
		}
	}
}

func (c *client) writeLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-c.done:
			return
		case msg := <-c.send:
			writeCtx, cancel := context.WithTimeout(ctx, sendTimeout)
			err := wsjson.Write(writeCtx, c.conn, msg)
			cancel()
			if err != nil {
				c.logger.Printf("websocket write failed: %v", err)
				c.Close("websocket write failed")
				return
			}
		}
	}
}

func closeStatus(err error) websocket.StatusCode {
	switch {
	case errors.Is(err, game.ErrInvalidPIN), errors.Is(err, game.ErrReconnectNotFound), errors.Is(err, game.ErrClassTaken), errors.Is(err, game.ErrInvalidClass):
		return websocket.StatusPolicyViolation
	case errors.Is(err, game.ErrRoomNotFound):
		return websocket.StatusUnsupportedData
	case errors.Is(err, game.ErrRoomFull):
		return websocket.StatusTryAgainLater
	default:
		return websocket.StatusInvalidFramePayloadData
	}
}

func errorCode(err error) string {
	switch {
	case errors.Is(err, game.ErrClassTaken):
		return "class_taken"
	case errors.Is(err, game.ErrInvalidClass):
		return "invalid_class"
	default:
		return "unknown"
	}
}
