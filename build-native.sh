#!/usr/bin/env bash
# Build Arvexis editor as a GraalVM native binary (no JVM required to run)
# Output: editor/backend/target/arvexis-editor
# Requirements: GraalVM JDK 21 must be set as JAVA_HOME
#               (e.g. via SDKMAN: sdk use java 21-graalce)
# Usage:  ./build-native.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$ROOT/editor/frontend"
BACKEND="$ROOT/editor/backend"

# Verify GraalVM
if ! java -version 2>&1 | grep -qi "graalvm\|native"; then
    echo "WARNING: JAVA_HOME does not appear to be GraalVM."
    echo "  Install GraalVM JDK 21, e.g.: sdk install java 21-graalce"
    echo "  Then re-run this script."
    exit 1
fi

echo "==> [1/2] Building frontend..."
cd "$FRONTEND"
npm install --silent
npm run build

echo "==> [2/2] Compiling native binary (this takes several minutes)..."
cd "$BACKEND"
mvn -Pnative native:compile -DskipTests -q

BINARY="$BACKEND/target/arvexis-editor"
echo ""
echo "Done! Run with:"
echo "  $BINARY"
echo "Then open: http://localhost:8080"
