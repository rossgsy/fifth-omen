package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rossgsy/fifth-omen/server/internal/game"
)

func TestAdminCreateListGetAndDeleteRoom(t *testing.T) {
	manager := game.NewManager()
	router := NewRouter(log.New(io.Discard, "", 0), manager, "secret")

	body := bytes.NewBufferString(`{"code":"abc12","pin":"123456","maxSeats":2}`)
	createReq := httptest.NewRequest(http.MethodPost, "/admin/rooms", body)
	createReq.Header.Set("Content-Type", "application/json")
	createReq.SetBasicAuth("admin", "secret")
	createResp := httptest.NewRecorder()

	router.ServeHTTP(createResp, createReq)

	if createResp.Code != http.StatusCreated {
		t.Fatalf("create status = %d, want %d; body=%s", createResp.Code, http.StatusCreated, createResp.Body.String())
	}

	var created game.CreateRoomResult
	if err := json.NewDecoder(createResp.Body).Decode(&created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if created.Room.Code != "ABC12" {
		t.Fatalf("created room code = %q, want ABC12", created.Room.Code)
	}
	if created.PIN != "123456" {
		t.Fatalf("created room pin = %q, want 123456", created.PIN)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/admin/rooms", nil)
	listReq.SetBasicAuth("admin", "secret")
	listResp := httptest.NewRecorder()

	router.ServeHTTP(listResp, listReq)

	if listResp.Code != http.StatusOK {
		t.Fatalf("list status = %d, want %d; body=%s", listResp.Code, http.StatusOK, listResp.Body.String())
	}
	var list struct {
		Rooms []game.AdminRoomSnapshot `json:"rooms"`
	}
	if err := json.NewDecoder(listResp.Body).Decode(&list); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	if len(list.Rooms) != 1 || list.Rooms[0].Code != "ABC12" || list.Rooms[0].PIN != "123456" {
		t.Fatalf("admin room list = %+v, want one room with code ABC12 and pin 123456", list.Rooms)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/admin/rooms/ABC12", nil)
	getReq.SetBasicAuth("admin", "secret")
	getResp := httptest.NewRecorder()

	router.ServeHTTP(getResp, getReq)

	if getResp.Code != http.StatusOK {
		t.Fatalf("get status = %d, want %d; body=%s", getResp.Code, http.StatusOK, getResp.Body.String())
	}

	var snapshot game.AdminRoomSnapshot
	if err := json.NewDecoder(getResp.Body).Decode(&snapshot); err != nil {
		t.Fatalf("decode get response: %v", err)
	}
	if snapshot.Code != "ABC12" || snapshot.PIN != "123456" || snapshot.MaxSeats != 2 {
		t.Fatalf("snapshot = %+v, want code ABC12 pin 123456 maxSeats 2", snapshot)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/admin/rooms/ABC12", nil)
	deleteReq.SetBasicAuth("admin", "secret")
	deleteResp := httptest.NewRecorder()

	router.ServeHTTP(deleteResp, deleteReq)

	if deleteResp.Code != http.StatusNoContent {
		t.Fatalf("delete status = %d, want %d; body=%s", deleteResp.Code, http.StatusNoContent, deleteResp.Body.String())
	}
}

func TestAdminEndpointsRequirePassword(t *testing.T) {
	manager := game.NewManager()
	router := NewRouter(log.New(io.Discard, "", 0), manager, "secret")

	req := httptest.NewRequest(http.MethodGet, "/admin/rooms", nil)
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("admin status = %d, want %d", resp.Code, http.StatusUnauthorized)
	}
}

func TestAdminEndpointsAreDisabledWithoutConfiguredPassword(t *testing.T) {
	manager := game.NewManager()
	router := NewRouter(log.New(io.Discard, "", 0), manager, "")

	req := httptest.NewRequest(http.MethodGet, "/admin/rooms", nil)
	req.SetBasicAuth("admin", "secret")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("admin status = %d, want %d", resp.Code, http.StatusServiceUnavailable)
	}
}
