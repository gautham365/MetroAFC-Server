#!/bin/bash
sudo pm2 describe metro-server > /dev/null
RUNNING=$?

if [ "${RUNNING}" -ne 0 ]; then
          sudo npm install -g pm2 && pm2 start npm --name "metro-server" -- start
else
          sudo pm2 restart metro-server
fi;