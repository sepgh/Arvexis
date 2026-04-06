#!/usr/bin/env bash
# Build Arvexis editor: frontend → backend JAR
# Output: editor/backend/target/editor-backend-*.jar
# Usage:  ./build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$ROOT/editor/frontend"
BACKEND="$ROOT/editor/backend"
RUNTIME="$ROOT/runtime"

echo "==> [1/3] Building runtime JAR..."
cd "$RUNTIME"
mvn clean package -DskipTests -q
JAR=$(ls "$RUNTIME/target/runtime-"*.jar 2>/dev/null | grep -v sources | head -1)
cp "$JAR" "$RUNTIME/target/arvexis-runtime.jar"
JAR="$RUNTIME/target/arvexis-runtime.jar"
echo "Runtime has been built and is available at:"
echo "  $JAR"
echo "It can be used to run the game/interactive-video if placed next to dist"

echo "==> [2/3] Building frontend..."
cd "$FRONTEND"
npm install --silent
npm run build

echo "==> [3/3] Building backend JAR (frontend + runtime bundled inside)..."
cd "$BACKEND"
mvn clean package -DskipTests -q

JAR=$(ls "$BACKEND/target/editor-backend-"*.jar 2>/dev/null | grep -v sources | head -1)
echo ""
echo "Done! Run with:"
echo "  java -jar $JAR"
echo "Then open: http://localhost:8080"
