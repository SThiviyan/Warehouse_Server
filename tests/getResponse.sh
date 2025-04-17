#!/bin/bash

# Load environment variables from .env file
set -o allexport
source .env
set +o allexport

echo "➡️ Logging in as $USERNAME..."

LOGIN_RESPONSE=$(curl -k -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\", \"password\":\"$PASSWORD\"}")

echo "🔐 Login response: $LOGIN_RESPONSE"

# Extract the token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token."
  exit 1
fi

echo "✅ Token: $TOKEN"

echo "➡️ Requesting response..."

RESPONSE=$(curl -k -s -X GET "$BASE_URL/user" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "📞 Response:"
echo "$RESPONSE"
