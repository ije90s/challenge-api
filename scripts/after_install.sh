#!/bin/bash
set -e

APP_DIR=/home/ubuntu/app
ENV_SRC=/home/ubuntu/.env.prod
ENV_DST=$APP_DIR/.env
ENV_BAK=$APP_DIR/.env.bak

if [ ! -f "$ENV_SRC" ]; then
  echo ".env.prod not found"
  exit 1
fi

if [ -f "$ENV_DST" ]; then 
  cp "$ENV_DST" "$ENV_BAK"
fi

cp "$ENV_SRC" "$ENV_DST"
chmod 600 "$ENV_DST"

npm ci