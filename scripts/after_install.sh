#!/bin/bash
set -e

cd /home/ubuntu/app

npm ci

echo "--- 현재 위치 확인 ---"
pwd
            
echo "--- 마이그레이션 파일 존재 확인 ---"
ls -l dist/src/migrations || echo "파일 없음!"

echo "--- 마이그레이션 실행 ---"
npm run migration:run