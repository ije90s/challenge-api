// 랭킹 조회(GET /participation/challenge/:id/rank) 부하 테스트
// anything/load_test_plan.md §5-1 참고. 실행 전 setup_users.sh로 tokens.json 생성 필요.
import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const data = new SharedArray('tokens', function () {
  return [JSON.parse(open('./tokens.json'))];
});

const cfg = data[0];
const BASE_URL = cfg.baseUrl;
const CHALLENGE_ID = cfg.scoreChallengeId;
const TOTAL_ROWS = 50020;
const LIMIT = 20;
const MAX_PAGE = Math.ceil(TOTAL_ROWS / LIMIT);

export const appErrors = new Rate('app_errors');

export const options = {
  scenarios: {
    ranking_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 20 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '20s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    app_errors: ['rate<0.01'],
  },
};

export default function () {
  const token = cfg.tokens[__VU % cfg.tokens.length];
  const page = Math.floor(Math.random() * MAX_PAGE) + 1;

  const res = http.get(
    `${BASE_URL}/participation/challenge/${CHALLENGE_ID}/rank?page=${page}&limit=${LIMIT}`,
    { headers: { Authorization: `Bearer ${token}` }, tags: { name: 'rank' } },
  );

  appErrors.add(res.status >= 400);
  check(res, { 'status is 200': (r) => r.status === 200 });
}
