#!/bin/bash
set -e

mkdir -p /home/ubuntu/app

PARAM_PATH=/challenge-api/prod

ENV_FILE=/home/ubuntu/app/.env

echo "--------------- .env 파일 생성 시작 -----------------" 

# .env 초기화
> $ENV_FILE

# 파라미터 값 가져오기
PARAMS=$(aws ssm get-parameters-by-path \
  --path "$PARAM_PATH" \
  --with-decryption \
  --query "Parameters[*].[Name,Value]" \
  --output text)

# 반복문으로 .env 파일 값 셋팅
while read -r name value; do
  key=$(basename "$name")
  echo "$key=$value" >> $ENV_FILE
done <<< "$PARAMS"

chmod 600 $ENV_FILE

echo "--------------- .env 파일 생성 끝 -----------------" 
