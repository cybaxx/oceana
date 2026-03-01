#!/usr/bin/env bash
# Quick smoke test for Oceana API
# Requires: curl, jq, running server on :3000, running postgres

BASE="http://localhost:3000/api/v1"

echo "=== Health ==="
curl -s "$BASE/health"
echo -e "\n"

echo "=== Register user alice ==="
ALICE=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@example.com","password":"password123"}')
echo "$ALICE" | jq .
ALICE_TOKEN=$(echo "$ALICE" | jq -r '.token')
ALICE_ID=$(echo "$ALICE" | jq -r '.user.id')

echo "=== Register user bob ==="
BOB=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"bob","email":"bob@example.com","password":"password123"}')
echo "$BOB" | jq .
BOB_TOKEN=$(echo "$BOB" | jq -r '.token')
BOB_ID=$(echo "$BOB" | jq -r '.user.id')

echo "=== Alice creates a post ==="
POST1=$(curl -s -X POST "$BASE/posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -d '{"content":"Hello from Alice! This is **markdown** with `code`."}')
echo "$POST1" | jq .

echo "=== Bob follows Alice ==="
curl -s -X POST "$BASE/users/$ALICE_ID/follow" \
  -H "Authorization: Bearer $BOB_TOKEN" | jq .

echo "=== Bob creates a post ==="
curl -s -X POST "$BASE/posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -d '{"content":"Hey everyone, Bob here!"}' | jq .

echo "=== Bob checks feed (should see Alice + own posts) ==="
curl -s "$BASE/feed" \
  -H "Authorization: Bearer $BOB_TOKEN" | jq .

echo "=== Alice checks feed (only own posts, not following bob) ==="
curl -s "$BASE/feed" \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq .

echo "=== Get alice profile ==="
curl -s "$BASE/users/$ALICE_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN" | jq .

echo "=== Update alice profile ==="
curl -s -X PUT "$BASE/users/me/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -d '{"display_name":"Alice Oceana","bio":"Building the ocean of social media"}' | jq .

echo "=== Done ==="
