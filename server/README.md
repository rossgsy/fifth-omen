# Fifth Omen Server

Skeleton Go server for API and realtime game traffic.

## Run

```bash
go mod tidy
ADMIN_PASSWORD=change-me go run ./cmd/server
```

The server listens on `:8080` by default. Override it with:

```bash
ADMIN_PASSWORD=change-me HTTP_ADDR=:9090 go run ./cmd/server
```

Or use the local run script:

```bash
./run.sh
```

## Build

Build a local binary:

```bash
./build-local.sh
```

Build a local Docker image:

```bash
./build.sh
```

The local image is tagged `rossgsy/fifth-omen-server:local`.

Run the image:

```bash
docker run --rm -p 8080:8080 rossgsy/fifth-omen-server:local
```

## Routes

- `GET /healthz` returns a JSON health response.
- `GET /admin/rooms` lists rooms with codes and PINs.
- `POST /admin/rooms` creates a room.
- `GET /admin/rooms/{code}` returns room state with the PIN.
- `DELETE /admin/rooms/{code}` deletes a room.
- `GET /ws` upgrades to a WebSocket connection for a room device.

Admin routes use HTTP Basic Auth. The password is read from `ADMIN_PASSWORD`; the username can be any non-empty value.

Create a room:

```bash
curl -u admin:change-me -X POST http://localhost:8080/admin/rooms \
    -H 'Content-Type: application/json' \
    -d '{"code":"TEST1","pin":"123456","maxSeats":6}'
```

Join over WebSocket:

```text
ws://localhost:8080/ws?room=TEST1&pin=123456&role=player
ws://localhost:8080/ws?room=TEST1&pin=123456&role=gamescreen
```

Players receive a seat number and reconnect token in the initial `joined` message. To reclaim the same seat:

```text
ws://localhost:8080/ws?room=TEST1&pin=123456&role=player&reconnect_token=<token>
```

Server messages:

- `joined`: sent to the connecting device with its session, room state, and reconnect token.
- `room_state`: broadcast when devices join, leave, or reconnect.
- `pong`: sent in response to a client `{"type":"ping"}` message.

## WebSockets

This project uses `github.com/coder/websocket`, the maintained successor to `nhooyr.io/websocket`. It keeps the context-first API and JSON helpers while avoiding the callback-heavy style of older libraries.
