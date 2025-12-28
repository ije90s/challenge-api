#!/bin/bash

set -e

PORT=$(aws ssm get-parameters-by-path \
  --path "/challenge-api/prod" \
  --with-decryption \
  --region ap-northeast-2 \
  --query "Parameters[?Name=='/challenge-api/prod/PORT'].Value | [0]" \
  --output text)

if [ -z "$PORT" ]; then
  echo "PORT not found"
  exit 1
fi

URL="http://localhost:${PORT}/health"
MAX_RETRY=3
SLEEP=3

for i in $(seq 1 $MAX_RETRY); do
  echo "Health check attempt $i..."

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" $URL)

  if [ "$STATUS" = "200" ]; then
    echo "Health check passed"
    exit 0
  fi

  sleep $SLEEP
done

echo "Health check failed"
exit 1