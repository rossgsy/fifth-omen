#!/bin/bash
set -euo pipefail

echo "Build for environment [local/prod]?"
read -r env

if [ "$env" == "" ]; then
    env="local"
fi

if [ "$env" != "local" ] && [ "$env" != "prod" ]; then
    echo "Invalid environment. Please choose 'local' or 'prod'."
    exit 1
fi

echo "Building server for environment: $env"

git_commit=$(git rev-parse --short HEAD)

echo "Git commit: $git_commit"

if [ "$env" == "local" ]; then
    docker build \
        --build-arg GIT_COMMIT="$git_commit" \
        -t rossgsy/fifth-omen-server:local \
        .
elif [ "$env" == "prod" ]; then
    echo "noop"
fi
