#!/usr/bin/env bash
# Raw-NATS smoke test for swamp-nats-agent. Uses the `nats` CLI to publish
# a handful of requests directly (bypassing swamp) so you can verify the
# agent's primitive handlers respond correctly before layering swamp on top.
#
# Usage:
#   ./smoke.sh [hostname]
#
# Prereq: `nats` CLI (brew install nats-io/nats-tools/nats), NATS running
# on localhost:4222, and the agent running with the matching --hostname.

set -euo pipefail

HOST="${1:-localmac}"
PREFIX="${SMOKE_PREFIX:-swamp.agent}"
NATS_URL="${SMOKE_NATS_URL:-nats://localhost:4222}"

if ! command -v nats >/dev/null; then
  echo "error: nats CLI not found. Install with:" >&2
  echo "  brew install nats-io/nats-tools/nats" >&2
  exit 2
fi

printf '→ target: %s.%s.*\n→ nats:   %s\n\n' "$PREFIX" "$HOST" "$NATS_URL"

echo '=== 1. exec echo hello ==='
nats --server="$NATS_URL" request --timeout=5s \
  "${PREFIX}.${HOST}.exec" \
  '{"cmd":"echo hello from smoke.sh","timeoutSec":5}'
echo

echo '=== 2. exec with non-zero exit ==='
nats --server="$NATS_URL" request --timeout=5s \
  "${PREFIX}.${HOST}.exec" \
  '{"cmd":"exit 42","timeoutSec":5}'
echo

echo '=== 3. exec uname -a ==='
nats --server="$NATS_URL" request --timeout=5s \
  "${PREFIX}.${HOST}.exec" \
  '{"cmd":"uname -a","timeoutSec":5}'
echo

echo '=== 4. exec with stdin ==='
nats --server="$NATS_URL" request --timeout=5s \
  "${PREFIX}.${HOST}.exec" \
  '{"cmd":"cat","stdin":"piped input","timeoutSec":5}'
echo

echo '=== 5. exec with sudo (likely exits 1 on macOS with -n) ==='
nats --server="$NATS_URL" request --timeout=5s \
  "${PREFIX}.${HOST}.exec" \
  '{"cmd":"whoami","sudo":true,"timeoutSec":5}'
echo

echo '✓ raw-NATS smoke complete'
echo
echo 'Note: writeFile and readFile require Object Store uploads/downloads,'
echo 'which are easier to exercise via the swamp CLI model (swamp-nats extension).'
echo 'See ../../README.md for the swamp-based walkthrough.'
