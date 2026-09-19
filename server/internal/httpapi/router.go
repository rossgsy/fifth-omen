package httpapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/rossgsy/fifth-omen/server/internal/game"
	"github.com/rossgsy/fifth-omen/server/internal/rules"
	"github.com/rossgsy/fifth-omen/server/internal/ws"
)

func NewRouter(logger *log.Logger, manager *game.Manager, adminPassword string, catalogs ...*rules.Catalog) http.Handler {
	mux := http.NewServeMux()
	admin := adminHandler(adminPassword)
	catalog := rules.MustLoad()
	if len(catalogs) > 0 && catalogs[0] != nil {
		catalog = catalogs[0]
	}

	mux.HandleFunc("/healthz", health)
	mux.HandleFunc("GET /api/rules", serveRulesBundle(catalog))
	mux.HandleFunc("GET /api/rules/folio", serveRulesFile(catalog.Folio))
	mux.HandleFunc("GET /api/rules/folio.json", serveRulesFile(catalog.Folio))
	mux.HandleFunc("GET /api/rules/playbooks", serveRulesFile(catalog.Playbooks))
	mux.HandleFunc("GET /api/rules/playbooks.json", serveRulesFile(catalog.Playbooks))
	mux.HandleFunc("GET /admin/login", adminLoginPage(adminPassword))
	mux.HandleFunc("POST /admin/login", adminLogin(adminPassword))
	mux.HandleFunc("POST /admin/logout", adminLogout)
	mux.Handle("GET /admin", admin(adminRoomsPage(manager)))
	mux.Handle("GET /admin/rooms", admin(adminRoomsPage(manager)))
	mux.Handle("POST /admin/rooms", admin(createRoom(manager)))
	mux.Handle("POST /admin/rooms/{code}/delete", admin(deleteRoom(manager)))
	mux.HandleFunc("/ws", ws.Handler(logger, manager))

	return recoverer(logger, requestLogger(logger, mux))
}

func serveRulesBundle(catalog *rules.Catalog) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		setRulesHeaders(w)
		_ = json.NewEncoder(w).Encode(catalog.Bundle())
	}
}

func serveRulesFile(load func() json.RawMessage) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		setRulesHeaders(w)
		_, _ = w.Write(load())
	}
}

func setRulesHeaders(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Header().Set("Access-Control-Allow-Origin", "*")
}

func health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

func adminLoginPage(adminPassword string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if adminPassword == "" {
			renderAdminDisabled(w)
			return
		}
		if validAdminSession(r, adminPassword) {
			http.Redirect(w, r, "/admin/rooms", http.StatusSeeOther)
			return
		}

		renderAdminLogin(w, r.URL.Query().Get("error") != "")
	}
}

func adminLogin(adminPassword string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if adminPassword == "" {
			renderAdminDisabled(w)
			return
		}

		if err := r.ParseForm(); err != nil {
			renderAdminLoginError(w, http.StatusBadRequest)
			return
		}

		password := r.FormValue("password")
		if subtle.ConstantTimeCompare([]byte(password), []byte(adminPassword)) != 1 {
			http.Redirect(w, r, "/admin/login?error=1", http.StatusSeeOther)
			return
		}

		setAdminSession(w, adminPassword)
		http.Redirect(w, r, "/admin/rooms", http.StatusSeeOther)
	}
}

func adminLogout(w http.ResponseWriter, r *http.Request) {
	clearAdminSession(w)
	http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
}

func adminRoomsPage(manager *game.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		renderAdminRooms(w, adminRoomsView{
			Rooms: manager.ListAdminRooms(),
			Error: r.URL.Query().Get("error"),
		})
	}
}

func createRoom(manager *game.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			http.Redirect(w, r, "/admin/rooms?error=invalid_form", http.StatusSeeOther)
			return
		}

		maxSeats, _ := strconv.Atoi(r.FormValue("maxSeats"))
		_, err := manager.CreateRoom(game.CreateRoomRequest{
			Code:     r.FormValue("code"),
			PIN:      r.FormValue("pin"),
			MaxSeats: maxSeats,
		})
		if err != nil {
			http.Redirect(w, r, "/admin/rooms?error="+adminErrorCode(err), http.StatusSeeOther)
			return
		}

		http.Redirect(w, r, "/admin/rooms", http.StatusSeeOther)
	}
}

func deleteRoom(manager *game.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := manager.DeleteRoom(r.PathValue("code")); err != nil {
			http.Redirect(w, r, "/admin/rooms?error="+adminErrorCode(err), http.StatusSeeOther)
			return
		}

		http.Redirect(w, r, "/admin/rooms", http.StatusSeeOther)
	}
}

func adminHandler(adminPassword string) func(http.HandlerFunc) http.Handler {
	return func(next http.HandlerFunc) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if adminPassword == "" {
				renderAdminDisabled(w)
				return
			}

			if !validAdminSession(r, adminPassword) {
				http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
				return
			}

			next(w, r)
		})
	}
}

func setAdminSession(w http.ResponseWriter, adminPassword string) {
	expires := time.Now().Add(24 * time.Hour)
	value := adminSessionValue(adminPassword, expires.Unix())
	http.SetCookie(w, &http.Cookie{
		Name:     "fifth_omen_admin",
		Value:    value,
		Path:     "/admin",
		Expires:  expires,
		MaxAge:   int(time.Until(expires).Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func clearAdminSession(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "fifth_omen_admin",
		Value:    "",
		Path:     "/admin",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func validAdminSession(r *http.Request, adminPassword string) bool {
	cookie, err := r.Cookie("fifth_omen_admin")
	if err != nil || cookie.Value == "" {
		return false
	}

	parts := strings.Split(cookie.Value, ".")
	if len(parts) != 2 {
		return false
	}

	expiresUnix, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || time.Now().Unix() > expiresUnix {
		return false
	}

	expected := adminSessionValue(adminPassword, expiresUnix)
	return subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(expected)) == 1
}

func adminSessionValue(adminPassword string, expiresUnix int64) string {
	expires := strconv.FormatInt(expiresUnix, 10)
	mac := hmac.New(sha256.New, []byte(adminPassword))
	mac.Write([]byte("fifth-omen-admin-session:" + expires))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return expires + "." + signature
}

func adminErrorCode(err error) string {
	switch {
	case errors.Is(err, game.ErrRoomExists):
		return "room_exists"
	case errors.Is(err, game.ErrInvalidRoomCode):
		return "invalid_room_code"
	case errors.Is(err, game.ErrInvalidPIN):
		return "invalid_pin"
	case errors.Is(err, game.ErrRoomNotFound):
		return "room_not_found"
	default:
		return "unknown"
	}
}
