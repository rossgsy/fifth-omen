# Fifth Omen Server

Skeleton Go server for API and realtime game traffic.

## Run

```bash
go mod tidy
go run ./cmd/server
```

The server listens on `:8080` by default. Override it with:

```bash
HTTP_ADDR=:9090 go run ./cmd/server
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
- `GET /ws` upgrades to a WebSocket connection and currently echoes JSON messages.

## WebSockets

This project uses `github.com/coder/websocket`, the maintained successor to `nhooyr.io/websocket`. It keeps the context-first API and JSON helpers while avoiding the callback-heavy style of older libraries.
