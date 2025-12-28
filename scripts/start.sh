#!/bin/bash
set -e

echo "--------------- 배포 시작 -----------------" 
cd /home/ubuntu/app 

# pm2 startOrReload ecosystem.config.js --env production
echo "--------------- 배포 끝 -----------------"