// score/challenge_count 원자적 갱신 여부 결정을 위한 lost update 재현 테스트.
// 같은 참가 로우(동일 유저-챌린지)에 동시에 겹치는 PATCH 요청을 보내
// ParticipationService.update의 read-modify-write 경쟁을 재현한다.
// 사용법: TOKEN=... CHALLENGE_ID=410 VUS=20 k6 run anything/loadtest/concurrent_update.js
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN;
const CHALLENGE_ID = __ENV.CHALLENGE_ID || '410';
const INCREMENT = 1;
const VUS = parseInt(__ENV.VUS || '20', 10);

if (!TOKEN) {
  throw new Error('TOKEN env var is required');
}

export const options = {
  scenarios: {
    concurrent_same_row_update: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: 1,
      maxDuration: '10s',
    },
  },
};

export default function () {
  const res = http.patch(
    `${BASE_URL}/participation/challenge/${CHALLENGE_ID}`,
    JSON.stringify({ score: INCREMENT }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` } },
  );
  check(res, { 'status 200': (r) => r.status === 200 });
}
