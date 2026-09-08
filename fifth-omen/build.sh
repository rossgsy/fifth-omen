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
    docker build -t yps/fifth-omen-app:local .
elif [ "$env" == "prod" ]; then
    echo "noop"
fi