package httperr

import (
	"encoding/json"
	"errors"
	"net/http"
)

type Error struct {
	Status  int    `json:"-"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *Error) Error() string {
	return e.Message
}

func New(status int, code, message string) *Error {
	return &Error{
		Status:  status,
		Code:    code,
		Message: message,
	}
}

func Write(w http.ResponseWriter, err error) {
	var apiErr *Error
	if !errors.As(err, &apiErr) {
		apiErr = New(http.StatusInternalServerError, "internal_error", "Internal server error")
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(apiErr.Status)

	_ = json.NewEncoder(w).Encode(struct {
		Error *Error `json:"error"`
	}{
		Error: apiErr,
	})
}
