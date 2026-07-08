#!/bin/bash
set -e

cd "$(dirname "$0")"

# Start Lavalink in the background if the jar exists
if [ -f "lavalink/Lavalink.jar" ]; then
  echo "🎺 Starting local Lavalink server..."
  cd lavalink
  java -jar Lavalink.jar &> ../lavalink.log &
  LAVALINK_PID=$!
  cd ..
  echo "   PID: $LAVALINK_PID"

  # Wait for it to be ready (max 30s)
  for i in {1..30}; do
    if curl -s http://localhost:2333/version > /dev/null 2>&1; then
      echo "✅ Lavalink is ready on port 2333"
      break
    fi
    sleep 1
  done
fi

# Start the Discord bot (foreground)
echo "🤖 Starting Nilou Bot..."
node --enable-source-maps src/index.js
