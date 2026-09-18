package httpapi

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/rossgsy/fifth-omen/server/internal/game"
	"github.com/rossgsy/fifth-omen/server/internal/httperr"
	"github.com/rossgsy/fifth-omen/server/internal/ws"
)

func NewRouter(logger *log.Logger, manager *game.Manager, adminPassword string) http.Handler {
	mux := http.NewServeMux()
	admin := adminHandler(adminPassword)

	mux.HandleFunc("/healthz", health)
	mux.Handle("GET /admin/rooms", admin(listRooms(manager)))
	mux.Handle("POST /admin/rooms", admin(createRoom(manager)))
	mux.Handle("GET /admin/rooms/{code}", admin(getAdminRoom(manager)))
	mux.Handle("DELETE /admin/rooms/{code}", admin(deleteRoom(manager)))
	mux.HandleFunc("/ws", ws.Handler(logger, manager))

	return recoverer(logger, requestLogger(logger, mux))
}

func health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

func listRooms(manager *game.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(struct {
			Rooms []game.AdminRoomSnapshot `json:"rooms"`
		}{
			Rooms: manager.ListAdminRooms(),
		})
	}
}

func createRoom(manager *game.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req game.CreateRoomRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httperr.Write(w, httperr.New(http.StatusBadRequest, "invalid_json", "Request body must be valid JSON"))
			return
		}

		result, err := manager.CreateRoom(req)
		if err != nil {
			writeGameError(w, err)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(result)
	}
}

func getAdminRoom(manager *game.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		snapshot, err := manager.AdminSnapshot(r.PathValue("code"))
		if err != nil {
			writeGameError(w, err)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(snapshot)
	}
}

func deleteRoom(manager *game.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := manager.DeleteRoom(r.PathValue("code")); err != nil {
			writeGameError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func adminHandler(adminPassword string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if adminPassword == "" {
				httperr.Write(w, httperr.New(http.StatusServiceUnavailable, "admin_disabled", "Admin endpoints require ADMIN_PASSWORD"))
				return
			}

			username, password, ok := r.BasicAuth()
			if !ok || username == "" || subtle.ConstantTimeCompare([]byte(password), []byte(adminPassword)) != 1 {
				w.Header().Set("WWW-Authenticate", `Basic realm="fifth-omen-admin"`)
				httperr.Write(w, httperr.New(http.StatusUnauthorized, "unauthorized", "Unauthorized"))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func writeGameError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, game.ErrRoomExists):
		httperr.Write(w, httperr.New(http.StatusConflict, "room_exists", "Room already exists"))
	case errors.Is(err, game.ErrInvalidRoomCode):
		httperr.Write(w, httperr.New(http.StatusBadRequest, "invalid_room_code", "Room code must be 5 alphanumeric characters"))
	case errors.Is(err, game.ErrRoomNotFound):
		httperr.Write(w, httperr.New(http.StatusNotFound, "room_not_found", "Room not found"))
	case errors.Is(err, game.ErrInvalidPIN):
		httperr.Write(w, httperr.New(http.StatusBadRequest, "invalid_pin", "PIN must be 6 digits"))
	case errors.Is(err, game.ErrInvalidJoin), errors.Is(err, game.ErrInvalidRole):
		httperr.Write(w, httperr.New(http.StatusBadRequest, "invalid_request", "Invalid request"))
	case errors.Is(err, game.ErrRoomFull):
		httperr.Write(w, httperr.New(http.StatusConflict, "room_full", "Room is full"))
	case errors.Is(err, game.ErrReconnectNotFound):
		httperr.Write(w, httperr.New(http.StatusNotFound, "reconnect_not_found", "Reconnect token not found"))
	default:
		httperr.Write(w, err)
	}
}
