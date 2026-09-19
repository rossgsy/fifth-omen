package game

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
)

func copyInt(value *int) *int {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func validTracker(value *int) bool {
	return value == nil || (*value >= 0 && *value <= 10)
}

func normalizeRoomCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func validRoomCode(code string) bool {
	if len(code) != RoomCodeLength {
		return false
	}
	for _, ch := range code {
		if (ch < 'A' || ch > 'Z') && (ch < '0' || ch > '9') {
			return false
		}
	}
	return true
}

func validPIN(pin string) bool {
	if len(pin) != PINLength {
		return false
	}
	for _, ch := range pin {
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return true
}

func randomCode(length int) (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	for i := range buf {
		buf[i] = alphabet[int(buf[i])%len(alphabet)]
	}
	return string(buf), nil
}

func randomDigits(length int) (string, error) {
	const digits = "0123456789"
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	for i := range buf {
		buf[i] = digits[int(buf[i])%len(digits)]
	}
	return string(buf), nil
}

func randomToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func playerReconnectToken(playerName string, seat *int) (string, error) {
	token, err := randomToken()
	if err != nil {
		return "", err
	}
	seatPart := "seat-open"
	if seat != nil {
		seatPart = fmt.Sprintf("seat-%d", *seat+1)
	}
	return fmt.Sprintf("%s-%s-%s", tokenSlug(playerName), seatPart, token), nil
}

func tokenSlug(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return "player"
	}
	var builder strings.Builder
	for _, ch := range value {
		switch {
		case ch >= 'a' && ch <= 'z':
			builder.WriteRune(ch)
		case ch >= '0' && ch <= '9':
			builder.WriteRune(ch)
		case builder.Len() > 0:
			last := builder.String()[builder.Len()-1]
			if last != '-' {
				builder.WriteByte('-')
			}
		}
		if builder.Len() >= 24 {
			break
		}
	}
	slug := strings.Trim(builder.String(), "-")
	if slug == "" {
		return "player"
	}
	return slug
}

func randomID(prefix string) (string, error) {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(buf)), nil
}
