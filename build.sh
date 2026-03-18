#!/usr/bin/env bash
# Build Arvexis editor: frontend → backend JAR
# Output: editor/backend/target/editor-backend-*.jar
# Usage:  ./build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$ROOT/editor/frontend"
BACKEND="$ROOT/editor/backend"

echo "==> [1/2] Building frontend..."
cd "$FRONTEND"
npm install --silent
npm run build

echo "==> [2/2] Building backend JAR (frontend bundled inside)..."
cd "$BACKEND"
mvn clean package -DskipTests -q

JAR=$(ls "$BACKEND/target/editor-backend-"*.jar 2>/dev/null | grep -v sources | head -1)
echo ""
echo "Done! Run with:"
echo "  java -jar $JAR"
echo "Then open: http://localhost:8080"
