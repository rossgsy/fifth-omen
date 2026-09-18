package httpapi

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/rossgsy/fifth-omen/server/internal/ws"
)

func NewRouter(logger *log.Logger) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", health)
	mux.HandleFunc("/ws", ws.Handler(logger))

	return recoverer(logger, requestLogger(logger, mux))
}

func health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}
