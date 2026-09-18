# Multi-stage build for the Go server.
FROM golang:1.27-alpine AS builder
WORKDIR /app

ARG GIT_COMMIT=unknown

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -trimpath \
    -ldflags "-s -w -X main.gitCommit=${GIT_COMMIT}" \
    -o /out/fifth-omen-server \
    ./cmd/server

FROM alpine:3.22

RUN apk add --no-cache ca-certificates \
    && addgroup -S fifthomen \
    && adduser -S fifthomen -G fifthomen
USER fifthomen

ENV HTTP_ADDR=:8080
EXPOSE 8080

COPY --from=builder /out/fifth-omen-server /usr/local/bin/fifth-omen-server

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/fifth-omen-server"]
