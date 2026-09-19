package roomstore

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/rossgsy/fifth-omen/server/internal/game"
)

const (
	defaultRedisTimeout = 5 * time.Second
	roomSetKey          = "fifth-omen:rooms"
	roomKeyPrefix       = "fifth-omen:room:"
)

type RedisStore struct {
	addr    string
	timeout time.Duration
}

func NewRedisStore(addr string) *RedisStore {
	return &RedisStore{
		addr:    addr,
		timeout: defaultRedisTimeout,
	}
}

func (s *RedisStore) LoadRooms(ctx context.Context) ([]game.StoredRoom, error) {
	codes, err := s.stringSlice(ctx, "SMEMBERS", roomSetKey)
	if err != nil {
		return nil, err
	}

	rooms := make([]game.StoredRoom, 0, len(codes))
	for _, code := range codes {
		value, err := s.string(ctx, "GET", roomKey(code))
		if errors.Is(err, errRedisNil) {
			continue
		}
		if err != nil {
			return nil, err
		}

		var room game.StoredRoom
		if err := json.Unmarshal([]byte(value), &room); err != nil {
			return nil, fmt.Errorf("decode stored room %s: %w", code, err)
		}
		rooms = append(rooms, room)
	}
	return rooms, nil
}

func (s *RedisStore) SaveRoom(ctx context.Context, room game.StoredRoom) error {
	data, err := json.Marshal(room)
	if err != nil {
		return err
	}
	if _, err := s.call(ctx, "SET", roomKey(room.Code), string(data)); err != nil {
		return err
	}
	_, err = s.call(ctx, "SADD", roomSetKey, room.Code)
	return err
}

func (s *RedisStore) DeleteRoom(ctx context.Context, code string) error {
	if _, err := s.call(ctx, "DEL", roomKey(code)); err != nil {
		return err
	}
	_, err := s.call(ctx, "SREM", roomSetKey, code)
	return err
}

func (s *RedisStore) string(ctx context.Context, command string, args ...string) (string, error) {
	value, err := s.call(ctx, command, args...)
	if err != nil {
		return "", err
	}
	text, ok := value.(string)
	if !ok {
		return "", fmt.Errorf("redis %s returned %T, want string", command, value)
	}
	return text, nil
}

func (s *RedisStore) stringSlice(ctx context.Context, command string, args ...string) ([]string, error) {
	value, err := s.call(ctx, command, args...)
	if err != nil {
		return nil, err
	}
	items, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("redis %s returned %T, want array", command, value)
	}
	result := make([]string, 0, len(items))
	for _, item := range items {
		text, ok := item.(string)
		if !ok {
			return nil, fmt.Errorf("redis %s returned array item %T, want string", command, item)
		}
		result = append(result, text)
	}
	return result, nil
}

func (s *RedisStore) call(ctx context.Context, command string, args ...string) (any, error) {
	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()

	conn, err := (&net.Dialer{}).DialContext(ctx, "tcp", s.addr)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	}

	if _, err := conn.Write(redisCommand(command, args...)); err != nil {
		return nil, err
	}
	return readRESP(bufio.NewReader(conn))
}

func redisCommand(command string, args ...string) []byte {
	parts := append([]string{strings.ToUpper(command)}, args...)
	var buf bytes.Buffer
	fmt.Fprintf(&buf, "*%d\r\n", len(parts))
	for _, part := range parts {
		fmt.Fprintf(&buf, "$%d\r\n%s\r\n", len(part), part)
	}
	return buf.Bytes()
}

var errRedisNil = errors.New("redis nil")

func readRESP(r *bufio.Reader) (any, error) {
	prefix, err := r.ReadByte()
	if err != nil {
		return nil, err
	}

	switch prefix {
	case '+':
		return readLine(r)
	case '-':
		line, err := readLine(r)
		if err != nil {
			return nil, err
		}
		return nil, errors.New(line)
	case ':':
		line, err := readLine(r)
		if err != nil {
			return nil, err
		}
		return strconv.ParseInt(line, 10, 64)
	case '$':
		length, err := readLength(r)
		if err != nil {
			return nil, err
		}
		if length == -1 {
			return nil, errRedisNil
		}
		buf := make([]byte, length+2)
		if _, err := io.ReadFull(r, buf); err != nil {
			return nil, err
		}
		return string(buf[:length]), nil
	case '*':
		length, err := readLength(r)
		if err != nil {
			return nil, err
		}
		if length == -1 {
			return nil, errRedisNil
		}
		values := make([]any, 0, length)
		for range length {
			value, err := readRESP(r)
			if err != nil {
				return nil, err
			}
			values = append(values, value)
		}
		return values, nil
	default:
		return nil, fmt.Errorf("unexpected redis response prefix %q", prefix)
	}
}

func readLength(r *bufio.Reader) (int, error) {
	line, err := readLine(r)
	if err != nil {
		return 0, err
	}
	return strconv.Atoi(line)
}

func readLine(r *bufio.Reader) (string, error) {
	line, err := r.ReadString('\n')
	if err != nil {
		return "", err
	}
	return strings.TrimSuffix(strings.TrimSuffix(line, "\n"), "\r"), nil
}

func roomKey(code string) string {
	return roomKeyPrefix + strings.ToUpper(strings.TrimSpace(code))
}
