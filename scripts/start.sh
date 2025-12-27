#!/bin/bash
set -e

echo "--------------- 배포 시작 -----------------" 
cd /home/ubuntu/app 

pm2 startOrReload ecosystem.config.js --env production
pm2 save

echo "--------------- 배포 끝 -----------------"