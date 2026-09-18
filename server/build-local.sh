#!/bin/bash
set -euo pipefail

export PATH="/usr/local/go/bin:$PATH"
export GOCACHE="${GOCACHE:-$PWD/.gocache}"
export GOMODCACHE="${GOMODCACHE:-$PWD/.gomodcache}"

git_commit=$(git rev-parse --short HEAD)

mkdir -p bin "$GOCACHE" "$GOMODCACHE"

CGO_ENABLED=0 go build \
    -trimpath \
    -ldflags "-s -w -X main.gitCommit=${git_commit}" \
    -o bin/fifth-omen-server \
    ./cmd/server

echo "Built bin/fifth-omen-server"
