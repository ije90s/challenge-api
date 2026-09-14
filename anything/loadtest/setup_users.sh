#!/usr/bin/env bash
# 부하 테스트용 시딩 스크립트 (일회성) — 실 유저를 API로 가입/로그인/참가시키고
# k6가 읽을 수 있는 토큰 JSON을 생성한다. anything/load_test_plan.md §3/§4 참고.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
USER_COUNT="${USER_COUNT:-20}"
OUT_FILE="$(dirname "$0")/tokens.json"

echo "[]" > "$OUT_FILE.tmp"

echo "1) 챌린지 2개 생성 (score 기반 type=0, count 기반 type=1)"
AUTHOR_EMAIL="loadtest-author@test.local"
AUTHOR_PASS="loadtest1234"

curl -s -o /dev/null -X POST "$BASE_URL/user" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$AUTHOR_EMAIL\",\"password\":\"$AUTHOR_PASS\"}" || true

AUTHOR_TOKEN=$(curl -s -X POST "$BASE_URL/user/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$AUTHOR_EMAIL\",\"password\":\"$AUTHOR_PASS\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

echo "author token acquired"

create_challenge() {
  local title="$1" type="$2"
  curl -s -X POST "$BASE_URL/challenge" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTHOR_TOKEN" \
    -d "{\"type\":$type,\"mininum_count\":100,\"title\":\"$title\",\"content\":\"loadtest\",\"start_date\":\"2026-01-01T00:00:00.000Z\",\"end_date\":\"2027-01-01T00:00:00.000Z\"}"
}

SCORE_CHALLENGE_RESP=$(create_challenge "부하테스트-score-$(date +%s)" 0)
COUNT_CHALLENGE_RESP=$(create_challenge "부하테스트-count-$(date +%s)" 1)

SCORE_CHALLENGE_ID=$(echo "$SCORE_CHALLENGE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
COUNT_CHALLENGE_ID=$(echo "$COUNT_CHALLENGE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

echo "score challenge id: $SCORE_CHALLENGE_ID"
echo "count challenge id: $COUNT_CHALLENGE_ID"

echo "2) k6 VU용 유저 ${USER_COUNT}명 가입/로그인/참가"
TOKENS="[]"
for i in $(seq 1 "$USER_COUNT"); do
  EMAIL="loadtest-vu${i}@test.local"
  PASS="loadtest1234"

  curl -s -o /dev/null -X POST "$BASE_URL/user" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" || true

  TOKEN=$(curl -s -X POST "$BASE_URL/user/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

  curl -s -o /dev/null -X POST "$BASE_URL/participation/challenge/$SCORE_CHALLENGE_ID" \
    -H "Authorization: Bearer $TOKEN"
  curl -s -o /dev/null -X POST "$BASE_URL/participation/challenge/$COUNT_CHALLENGE_ID" \
    -H "Authorization: Bearer $TOKEN"

  TOKENS=$(TOKENS="$TOKENS" TOKEN="$TOKEN" python3 -c "
import json, os
tokens = json.loads(os.environ['TOKENS'])
tokens.append(os.environ['TOKEN'])
print(json.dumps(tokens))
")
  echo "  vu $i ready"
done

python3 -c "
import json
data = {
    'baseUrl': '$BASE_URL',
    'scoreChallengeId': $SCORE_CHALLENGE_ID,
    'countChallengeId': $COUNT_CHALLENGE_ID,
    'tokens': $TOKENS,
}
with open('$OUT_FILE', 'w') as f:
    json.dump(data, f, indent=2)
"
rm -f "$OUT_FILE.tmp"
echo "done. wrote $OUT_FILE"
