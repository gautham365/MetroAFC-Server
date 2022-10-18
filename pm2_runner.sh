#!/bin/bash
pm2 describe metro-server > /dev/null
RUNNING=$?

if [ "${RUNNING}" -ne 0 ]; then
          pm2 restart metro-server
else
          sudo npm install -g pm2 && pm2 start npm --name "metro-server" -- start
fi;