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
- `GET /admin/login` shows the admin login page.
- `GET /admin/rooms` shows the admin room dashboard.
- `POST /admin/rooms` creates a room from the dashboard form.
- `POST /admin/rooms/{code}/delete` deletes a room from the dashboard.
- `GET /ws` upgrades to a WebSocket connection for a room device.

Admin routes use a signed session cookie. The login password is read from `ADMIN_PASSWORD`.

Open the dashboard:

```bash
open http://localhost:8080/admin/login
```

Room codes are 5 uppercase letters/numbers. PINs are 6 digits. If either field is blank while creating a room, the server generates it.

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
