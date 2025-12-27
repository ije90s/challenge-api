#!/bin/bash
set -e

cd /home/ubuntu/app 

if [ ! -f /home/ubuntu/.env.prod ]; then
  echo ".env.prod not found"
  exit 1
fi

cp /home/ubuntu/.env.prod ./.env
chmod 600 .env

npm ci