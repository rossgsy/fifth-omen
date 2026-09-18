package ws

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/rossgsy/fifth-omen/server/internal/httperr"
)

type Message struct {
	Type string `json:"type"`
	Data string `json:"data,omitempty"`
}

func Handler(logger *log.Logger) http.HandlerFunc {
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
		defer conn.CloseNow()

		ctx := r.Context()
		for {
			var msg Message
			if err := wsjson.Read(ctx, conn, &msg); err != nil {
				if websocket.CloseStatus(err) == websocket.StatusNormalClosure || errors.Is(err, context.Canceled) {
					return
				}
				logger.Printf("websocket read failed: %v", err)
				return
			}

			reply := Message{
				Type: "echo",
				Data: msg.Data,
			}
			writeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			err = wsjson.Write(writeCtx, conn, reply)
			cancel()
			if err != nil {
				logger.Printf("websocket write failed: %v", err)
				return
			}
		}
	}
}
