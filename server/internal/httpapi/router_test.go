package httpapi

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/rossgsy/fifth-omen/server/internal/game"
)

func TestRulesEndpointsServeCatalog(t *testing.T) {
	router := NewRouter(log.New(io.Discard, "", 0), game.NewManager(), "")

	for _, target := range []string{"/api/rules/folio.json", "/api/rules/playbooks.json"} {
		req := httptest.NewRequest(http.MethodGet, target, nil)
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		if resp.Code != http.StatusOK {
			t.Fatalf("GET %s status = %d, want %d", target, resp.Code, http.StatusOK)
		}
		if contentType := resp.Header().Get("Content-Type"); contentType != "application/json" {
			t.Fatalf("GET %s content type = %q", target, contentType)
		}
		if !json.Valid(resp.Body.Bytes()) {
			t.Fatalf("GET %s returned invalid JSON", target)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/rules", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	var bundle struct {
		Folio     map[string]any `json:"folio"`
		Playbooks []any          `json:"playbooks"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &bundle); err != nil {
		t.Fatalf("decode rules bundle: %v", err)
	}
	if bundle.Folio["name"] == nil || len(bundle.Playbooks) == 0 {
		t.Fatalf("rules bundle is incomplete: folio=%v playbooks=%d", bundle.Folio["name"], len(bundle.Playbooks))
	}
}

func TestAdminLoginCreateListAndDeleteRoom(t *testing.T) {
	manager := game.NewManager()
	router := NewRouter(log.New(io.Discard, "", 0), manager, "secret")

	loginResp := httptest.NewRecorder()
	loginReq := formRequest(http.MethodPost, "/admin/login", url.Values{
		"password": {"secret"},
	})
	router.ServeHTTP(loginResp, loginReq)

	if loginResp.Code != http.StatusSeeOther {
		t.Fatalf("login status = %d, want %d", loginResp.Code, http.StatusSeeOther)
	}
	session := loginResp.Result().Cookies()[0]
	if session.Name != "fifth_omen_admin" {
		t.Fatalf("session cookie name = %q, want fifth_omen_admin", session.Name)
	}

	createResp := httptest.NewRecorder()
	createReq := formRequest(http.MethodPost, "/admin/rooms", url.Values{
		"code":     {"abc12"},
		"pin":      {"123456"},
		"maxSeats": {"2"},
	})
	createReq.AddCookie(session)
	router.ServeHTTP(createResp, createReq)

	if createResp.Code != http.StatusSeeOther {
		t.Fatalf("create status = %d, want %d; body=%s", createResp.Code, http.StatusSeeOther, createResp.Body.String())
	}

	listResp := httptest.NewRecorder()
	listReq := httptest.NewRequest(http.MethodGet, "/admin/rooms", nil)
	listReq.AddCookie(session)
	router.ServeHTTP(listResp, listReq)

	if listResp.Code != http.StatusOK {
		t.Fatalf("list status = %d, want %d; body=%s", listResp.Code, http.StatusOK, listResp.Body.String())
	}
	body := listResp.Body.String()
	if !strings.Contains(body, "ABC12") || !strings.Contains(body, "123456") {
		t.Fatalf("admin page body did not include room code and pin: %s", body)
	}

	deleteResp := httptest.NewRecorder()
	deleteReq := httptest.NewRequest(http.MethodPost, "/admin/rooms/ABC12/delete", nil)
	deleteReq.AddCookie(session)
	router.ServeHTTP(deleteResp, deleteReq)

	if deleteResp.Code != http.StatusSeeOther {
		t.Fatalf("delete status = %d, want %d; body=%s", deleteResp.Code, http.StatusSeeOther, deleteResp.Body.String())
	}

	rooms := manager.ListAdminRooms()
	if len(rooms) != 0 {
		t.Fatalf("rooms after delete = %+v, want none", rooms)
	}
}

func TestAdminRoutesRedirectToLoginWithoutSession(t *testing.T) {
	manager := game.NewManager()
	router := NewRouter(log.New(io.Discard, "", 0), manager, "secret")

	req := httptest.NewRequest(http.MethodGet, "/admin/rooms", nil)
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusSeeOther {
		t.Fatalf("admin status = %d, want %d", resp.Code, http.StatusSeeOther)
	}
	if location := resp.Header().Get("Location"); location != "/admin/login" {
		t.Fatalf("redirect location = %q, want /admin/login", location)
	}
}

func TestAdminRejectsBadPassword(t *testing.T) {
	manager := game.NewManager()
	router := NewRouter(log.New(io.Discard, "", 0), manager, "secret")

	req := formRequest(http.MethodPost, "/admin/login", url.Values{
		"password": {"wrong"},
	})
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusSeeOther {
		t.Fatalf("login status = %d, want %d", resp.Code, http.StatusSeeOther)
	}
	if location := resp.Header().Get("Location"); location != "/admin/login?error=1" {
		t.Fatalf("redirect location = %q, want /admin/login?error=1", location)
	}
}

func TestAdminEndpointsAreDisabledWithoutConfiguredPassword(t *testing.T) {
	manager := game.NewManager()
	router := NewRouter(log.New(io.Discard, "", 0), manager, "")

	req := httptest.NewRequest(http.MethodGet, "/admin/rooms", nil)
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("admin status = %d, want %d", resp.Code, http.StatusServiceUnavailable)
	}
}

func formRequest(method string, target string, values url.Values) *http.Request {
	req := httptest.NewRequest(method, target, strings.NewReader(values.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return req
}
