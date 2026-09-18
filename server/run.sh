#!/bin/bash
set -euo pipefail

export PATH="/usr/local/go/bin:$PATH"
export GOCACHE="${GOCACHE:-$PWD/.gocache}"
export GOMODCACHE="${GOMODCACHE:-$PWD/.gomodcache}"

addr="${HTTP_ADDR:-:8080}"
echo "Starting fifth-omen server on ${addr}"

HTTP_ADDR="$addr" go run ./cmd/server
