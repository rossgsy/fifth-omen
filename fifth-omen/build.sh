#!/bin/bash

echo "Build for environment [local/prod]?"
read env

if [ "$env" == "" ]; then
    env="local"
fi

if [ "$env" != "local" ] && [ "$env" != "prod" ]; then
    echo "Invalid environment. Please choose 'local' or 'prod'."
    exit 1
fi

echo "Building for environment: $env"

git_commit=$(git rev-parse --short HEAD)

echo "Git commit: $git_commit"

if [ "$env" == "local" ]; then
    docker build -t rossgsy/fifth-omen-app:local . --build-arg VITE_GAME_WS_URL=wss://server.fifth-omen.lab-2.paleglyph.com/ws
elif [ "$env" == "prod" ]; then
    echo "noop"
fi