#!/bin/bash
kill -9 $(lsof -t -i:5000) 2>/dev/null || true
node server.js &
SERVER_PID=$!
sleep 2
node test.js
TEST_EXIT=$?
kill -9 $SERVER_PID
exit $TEST_EXIT
