#!/bin/bash
set -e

cd "$(dirname "$0")"

# ─── Auto-install Java if missing (e.g. on Render) ────────────────────────────
if ! command -v java &> /dev/null; then
  echo "⚡ Java not found — downloading lightweight JRE..."
  mkdir -p .jre && cd .jre
  curl -sL -o jre.tar.gz "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jre_x64_linux_hotspot_21.0.5_11.tar.gz"
  tar -xzf jre.tar.gz --strip-components=1
  cd ..
  export PATH="$(pwd)/.jre/bin:$PATH"
  echo "✅ Java installed: $(java -version 2>&1 | head -1)"
fi

# ─── Start Lavalink in the background ───────────────────────────────────────
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

# ─── Start the Discord bot (foreground) ─────────────────────────────────────
echo "🤖 Starting Nilou Bot..."
node --enable-source-maps src/index.js
