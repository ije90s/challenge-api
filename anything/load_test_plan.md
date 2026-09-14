# 부하 테스트 시나리오 설계

> 작성일: 2026-09-14
> 범위: Phase 4 — "부하 테스트 시나리오 설계" TODO. 이 문서는 시나리오/기준 설계까지만 다룬다.
> 실제 실행 도구 선정(k6/artillery 등) 및 스크립트 작성, 실측/EXPLAIN, 이후 개선 여부 결정은 Phase 4의 다음 TODO들(별도 세션)에서 진행.

## 1. 왜 이 두 시나리오가 우선인가

`anything/refactor_plan.md` §1-7, §1-6, §3 Phase 1-2에서 실측 없이는 판단을 미뤄둔 지점이 두 곳 있다:

- **랭킹 조회**: `Participation`의 복합 인덱스 컬럼 순서가 `(challenge, score, created_at)`인데 쿼리는 `ORDER BY score DESC, created_at DESC`(`participation.service.ts`의 `getChallengeRank`). 정렬 방향 불일치로 filesort가 발생할 수 있는지 실측 전에는 알 수 없음.
- **동시 참가/기록 갱신**: `ParticipationService.update`(`participation.service.ts:56-89`)가 락/트랜잭션 없는 read-modify-write로 `score`/`challenge_count`를 갱신한다. 동시 요청 시 lost update가 이론상 가능하다는 것만 코드 분석으로 확인됐고(`refactor_plan.md` 1-2번 항목, 2026-09-07), 실제로 재현되는지·심각도가 어느 정도인지는 부하를 걸어봐야 안다. 이 결과가 "원자적 증가 쿼리로 바꿀지" 최종 결정(Phase 4 마지막 TODO)의 근거가 된다.

다른 엔드포인트(챌린지 CRUD, 피드 등)는 이번 계획에서 성능 이슈로 지목된 적이 없으므로 우선순위에서 제외.

## 2. 대상 환경

- 로컬 `npm run start:dev` + `docker compose -f docker/docker-compose.yml up -d`(MariaDB)로 기동한 인스턴스. 별도 스테이징 환경 없음(README 기준 EC2는 종료 상태).
- 부하 테스트 전 `docker/mysql-data`를 초기화하거나 전용 테스트 DB로 분리할지는 실행 단계(다음 TODO)에서 결정 — 이 문서에서는 "격리된 상태에서 시작"만 전제로 둔다.

## 3. 사전 준비 (테스트 데이터 시딩)

- **유저**: 동시성 시나리오를 위해 다수(예: 수백~수천, 실행 단계에서 규모 확정) 계정 필요. `POST /user`로 가입 후 `POST /user/login`으로 JWT 획득.
- **챌린지**: 랭킹 조회 대상 챌린지 최소 1개, `type: 0`(score 기반)과 `type: 1`(challenge_count 기반) 각각 1개씩 — 두 정렬 경로(`p.score` vs `p.challenge_count`) 모두 검증.
- **참가(Participation) 데이터**: 랭킹 조회 시나리오는 "이미 대량의 참가자가 있는 챌린지"를 전제로 한다. 실제 서비스 규모를 가정한 로우 수(예: 수만 건)를 미리 채워둬야 인덱스/filesort 이슈가 드러난다 — 신규 가입 유저 몇 명만으로는 병목이 재현되지 않음.
- 시딩 방식(스크립트 vs SQL bulk insert)은 실행 단계에서 결정.

## 4. 인증 흐름을 부하 시나리오에 어떻게 반영할지

- `challenge`/`participation` 컨트롤러 전체에 `JwtAuthGuard`가 걸려 있어(`refactor_plan.md` Phase 2 결정으로 현행 유지) 모든 요청에 유효한 Bearer 토큰이 필요하다.
- 로그인 자체는 이번 부하 테스트의 관심사가 아니므로(성능 이슈로 지목된 적 없음), **토큰은 시나리오 실행 전에 미리 발급해 재사용**하는 것을 전제로 한다. 로그인 엔드포인트에 부하를 함께 거는 것은 범위 밖.

## 5. 시나리오 상세

### 5-1. 랭킹 조회 (우선순위 1)

- **대상**: `GET /participation/challenge/:challengeId/rank` (`participation.controller.ts:32-35` → `participation.service.ts:110-137`)
- **패턴**: 다수의 가상 유저가 동시에 같은 챌린지의 랭킹을 여러 페이지(`page`/`limit` 쿼리)에 걸쳐 반복 조회. read-only이므로 순수 처리량/지연시간 측정에 적합.
- **변화 축**: 동시 접속자 수를 단계적으로 늘려가며(ramp-up) p95/p99 지연시간이 꺾이는 지점을 찾는다.
- **함께 확인할 것**: 요청 처리 중 서버 로그 또는 MariaDB 슬로우 쿼리 로그로 `getChallengeRank` 쿼리의 실제 실행 계획(`EXPLAIN`) 확보 — filesort 발생 여부는 다음 TODO("실측 후 슬로우 쿼리 EXPLAIN 확인")에서 수행하지만, 이번 시나리오 실행이 그 입력 데이터가 된다.

### 5-2. 동시 참가/기록 갱신 (우선순위 2)

- **대상**:
  - `POST /participation/challenge/:challengeId` (참가, `participation.service.ts:30-54`)
  - `PATCH /participation/challenge/:challengeId` (기록 갱신, `participation.service.ts:56-89`)
- **패턴 A — 동시 참가**: 서로 다른 유저 다수가 동일 챌린지에 동시에 `POST`. `findOne` 중복 체크 후 `create`하는 구조라 유저별로는 충돌 없음(참가는 유저-챌린지 쌍이 유니크) — 주로 처리량/동시 insert 성능 측정.
- **패턴 B — 동시 기록 갱신 (핵심)**: **같은 유저**가 아니라, **서로 다른 유저들이 동일 챌린지에 이미 참가한 상태에서 각자 자기 자신의 참가 기록을 동시에 `PATCH`** — 이건 락 경합보다는 처리량 테스트에 가깝다. lost update를 실제로 검증하려면 별도로:
  - 같은 `participation` 로우(동일 유저-챌린지)에 대해 여러 요청을 **동시에** 보내는 것은 정상적인 API 사용 패턴이 아니지만(한 유저가 여러 기기/탭에서 동시에 기록을 올리는 경우에 해당), read-modify-write 경쟁을 재현하려면 필요하다. 이 경우를 시나리오에 포함할지, 포함한다면 몇 개의 동시 요청으로 테스트할지는 **실행 단계에서 별도로 결정** — 정상 트래픽 패턴이 아니므로 이 문서에서는 "포함 후보"로만 남겨둔다.
- **검증 방법**: 테스트 종료 후 `participation.score`/`challenge_count`를 "보낸 요청 수 × 요청당 증가량"의 기대값과 대조 — 불일치가 있으면 lost update 재현.

## 6. 측정 지표

- 응답 시간 p50/p95/p99, 에러율(4xx/5xx), 초당 처리 요청 수(RPS)
- MariaDB 쪽: 슬로우 쿼리 로그, (가능하면) `SHOW PROCESSLIST`/커넥션 수
- 패턴 B(동시 기록 갱신)는 위 지표 외에 **데이터 정합성 검증**(§5-2 참고)이 핵심 지표

## 7. 성공/실패 기준 (초안 — 실행 단계에서 조정 가능)

- 랭킹 조회: 목표 동시 접속자 수에서 p95 지연시간이 사전에 정한 임계값(예: 500ms, 실행 단계에서 서비스 성격에 맞게 재확정) 이내
- 동시 기록 갱신(패턴 B): lost update가 재현되는지 여부 자체가 1차 산출물 — "통과/실패" 이분법보다는 "재현됨/안 됨 + 빈도"를 기록해 Phase 4 마지막 TODO(원자적 갱신 여부 최종 결정)의 근거로 사용

## 8. 이번 문서에서 다루지 않는 것 (2026-09-14 갱신)

- ~~실행 도구 선정 및 스크립트 작성~~ → k6로 확정, `anything/loadtest/` 참고 (2026-09-14)
- ~~실제 실행과 결과 수치~~ → §9 참고 (2026-09-14)
- ~~EXPLAIN 분석~~ → §9 참고 (2026-09-14)
- 커서 기반 페이지네이션 검토, 원자적 갱신 방식 결정 — 여전히 Phase 4의 이후 TODO (§9의 실측 결과가 근거 자료가 됨)
- 동시 참가/기록 갱신(§5-2) 실행 — 아직 미실행, 다음 TODO

## 9. 실측 결과 — 랭킹 조회 (2026-09-14)

### 실행 방법
- 도구: k6 v2.2.0 (`brew install k6`)
- 스크립트: `anything/loadtest/`
  - `setup_users.sh`: 챌린지 2개(type 0/1) 생성 + 실 유저 20명 가입/로그인/참가 → `tokens.json`(gitignore)
  - `seed_participation.py`: 필러 Participation 5만 건 × 2챌린지(총 10만 건) SQL 생성, `user_id=NULL`(랭킹 쿼리가 user 관계를 select하지 않아 실제 유저 불필요)
  - `rank_query.js`: `GET /participation/challenge/:id/rank`에 랜덤 페이지로 ramping-vus(0→20→50→100, 총 100초) 부하
- 환경: 로컬 `npm run start:dev` + `docker compose`(MariaDB 10.6), `docker-compose.yml`에 slow query log 추가(`long_query_time=0.05`)

### EXPLAIN — §1의 "정렬 방향 불일치 → filesort" 가설 기각

```
EXPLAIN SELECT * FROM participation p WHERE p.challenge_id = 410
  ORDER BY p.score DESC, p.created_at DESC LIMIT 20 OFFSET 0;

type: range   key: idx_challenge_score_rank   Extra: Using where   (filesort 없음)
```

인덱스 컬럼은 `(challenge_id, score, created_at)` 오름차순이지만, 쿼리가 두 컬럼 모두 `DESC`라 InnoDB가 해당 브랜치를 **역방향으로 스캔**해서 정렬을 만족시킨다 — filesort가 필요 없다. `challenge_count` 정렬(type=1, `idx_challenge_count_rank`)도 `EXPLAIN`으로 별도 확인(동일하게 filesort 없음) — 단, 커밋된 `rank_query.js`는 `scoreChallengeId`만 부하를 걸도록 작성돼 있어 이 challenge_count 경로 확인은 **재현 가능한 스크립트가 아니라 세션 중 직접 실행한 EXPLAIN**에 근거함(재검증하려면 `rank_query.js`의 대상을 `countChallengeId`로 바꿔 다시 실행). **§1/§1-7에서 실측 전 우려했던 인덱스-정렬 불일치 문제는 실제로는 발생하지 않는다.**

### 진짜 병목: offset 자체의 스캔 비용

같은 쿼리를 offset만 바꿔 `ANALYZE FORMAT=JSON`으로 실측:

| offset | r_total_time_ms | r_rows(스캔) |
|---|---|---|
| 0 | 0.065 | 20 |
| 40000 | 42.8 | 40,020 |

인덱스를 타면서도 LIMIT/OFFSET 이전 로우를 전부 순회하기 때문에 페이지가 뒤로 갈수록 비용이 선형으로 증가한다 — `refactor_plan.md` §7의 "offset 페이지네이션은 페이지 번호가 커질수록 스캔 비용 증가" 우려가 실측으로 확인됨.

### k6 결과 (100 VUs 램프업, 랜덤 페이지 1~2501)

```
http_req_duration: avg=862ms  p(90)=1.65s  p(95)=1.75s  max=2.17s
http_reqs: 5238 (52.4/s)   checks: 100% 통과   app_errors: 0%
threshold 'p(95)<500ms' 실패 (p95=1.75s)
```

slow query log(4,582건, 전체 요청의 87.5%)를 보면 전부 offset이 큰 랭킹 쿼리였고, 동시 부하 하에서 단일 쿼리 DB 처리 시간이 최대 390ms까지 올라갔다(격리 상태 42ms 대비). HTTP 레벨 p95(1.75s)가 DB 쿼리 시간(최대 390ms)보다 훨씬 큰 것은 **TypeORM/mysql2가 커넥션 풀 크기를 명시적으로 설정하지 않아 기본값(10)에 머물러 있고**, 100 동시 요청이 그 풀을 두고 대기하는 게 주요 원인으로 추정된다(`app.module.ts`에 `extra.connectionLimit` 없음) — 이번 TODO 범위 밖이라 수정하지 않았으나, Phase 4 다음 TODO(커서 페이지네이션/원자적 갱신 결정)나 별도 항목으로 다룰 만한 새로운 발견 사항으로 기록.

### 커넥션 풀 크기 실험 — 병목 아님으로 반증됨

위 "HTTP p95가 DB 쿼리 시간보다 훨씬 크다"는 관찰에 대해 "TypeORM/mysql2 기본 커넥션 풀(10)이 병목일 것"이라는 가설을 세우고, `app.module.ts`의 TypeORM 옵션에 `extra: { connectionLimit: 100 }`을 임시로 추가해 동일 조건으로 재실행했다(MariaDB `max_connections=151`이라 여유 있음을 사전 확인). 결과는 가설과 반대:

| | 풀 10 (기본) | 풀 100 |
|---|---|---|
| HTTP p95 | 1.75s | **2.1s** (악화) |
| HTTP max | 2.17s | **4.7s** (악화) |
| slow 쿼리 수 (요청 대비) | 4,582 / 5,238 | **8,982** / 5,501 (악화) |
| 최악 단일 쿼리 시간 | ~390ms | **1.24s** (악화) |

풀을 늘리자 더 많은 offset 스캔 쿼리가 동시에 MariaDB에 도달해 CPU/디스크 I/O를 더 심하게 다투게 됐다 — "커넥션 대기열" 문제가 아니라 **DB 자체가 동시에 처리할 수 있는 무거운 스캔의 양이 한계에 부딪힌 것**. 즉 병목은 처음부터 끝까지 offset 스캔 비용 하나였고, 커넥션 풀은 원인이 아니었다. `connectionLimit: 100` 변경은 효과가 없어 코드에는 반영하지 않고 되돌림(`app.module.ts` 원복 확인).

### 결론 / 다음 TODO에 넘기는 것

- filesort 문제 아님 → 인덱스 컬럼 순서 재설계는 불필요.
- 커넥션 풀 크기도 원인이 아님(실측으로 반증) → 이 방향은 더 이상 검토하지 않음.
- 병목은 **offset 스캔 비용** 하나로 좁혀짐 → "필요 시 커서 기반 페이지네이션 검토" TODO에서 실제로 진행할 근거 확보. (페이지네이션 계약 자체를 바꾸는 건 이번 세션 범위 밖으로 결정 — 사용자 확인, 2026-09-14)
- 로컬 DB에는 이번 실측으로 생긴 필러 데이터(챌린지 410/411, 참가 10만 건, 테스트 유저 20여 명)가 정리되지 않고 남아있음 — 다음 부하 테스트(동시 참가/기록 갱신)에서 재사용 예정.

## 10. 개선 구현 — 상위 100위 캡 + 본인 순위 분리 (2026-09-14)

§9 실측을 근거로 "커서 기반 페이지네이션 검토" TODO를 다음 방향으로 대체 결정(사용자 확인):
- 랭킹 목록은 **상위 100위까지만** 노출 — offset+limit이 100을 넘는 페이지는 조회 없이 빈 배열 반환(`RANK_VISIBLE_LIMIT`, `participation.service.ts`).
- **본인 순위**는 목록과 별도로 `GET /participation/challenge/:challengeId/rank/me`에서 제공(`ResponseMyRankDto`).

### 시행착오 — myRank를 처음엔 랭킹 응답에 합쳐서 넣었다가 되돌림

처음에는 "매 rank 응답에 myRank 필드를 함께 내려준다"로 구현했으나(사용자 확인), k6로 재검증하니 p95가 거의 개선되지 않았다(1.75s → 1.69s). 원인 조사 중 실제로는 두 가지 문제가 겹쳐 있었다:

1. **재현 환경 오염**: 세션 중 `kill`/`pkill`이 실제로 프로세스를 못 죽여서, "수정 후 재검증"이라고 생각한 실행 중 상당수가 실제로는 고치기 전 서버를 때리고 있었다. PID를 직접 확인해서 발견.
2. **myRank 자체가 새 병목**: 깨끗한 환경에서 정말로 고쳐진 코드로 재검증해도 개선이 없었다(오히려 p95=2.82~3.85s로 악화). 원인은 `myRank`가 이제 **모든** 요청마다 COUNT 쿼리를 하나 더 무는데, 이 쿼리 자체는 격리 상태에서 6.5ms로 싸지만 100명 동시 요청 하에서는 경합 때문에 50~60ms로 늘어나 — offset 문제를 고친 대신 "모든 요청에 새 비용"을 얹은 셈이 됐다.

사용자와 재논의 후 myRank를 별도 엔드포인트로 분리하기로 결정. 분리 후 **완전히 깨끗한 환경**(Docker 컨테이너 재시작 + 재시딩 + 새 서버 프로세스)에서 최종 검증:

| 지표 | 원래 (offset 무제한) | 최종 (top 100 캡, myRank 분리) |
|---|---|---|
| HTTP p95 | 1.75s | **473ms** (임계값 500ms 통과) |
| 처리량 | 52.4 req/s | **189.3 req/s** (~3.6배) |
| 완료 요청 수 (100초) | 5,238 | **18,933** |

### 구현 중 발견해서 함께 고친 버그

- **`myRank` 쿼리의 괄호 버그**: `.andWhere()`에 넘긴 OR 조건을 전체를 감싸는 괄호 없이 작성해서(`(A) OR (B)` 형태), TypeORM이 앞의 `.where(challenge_id=...)`와 결합할 때 `challenge_id` 필터가 OR로 깨져 **테이블 전체(다른 챌린지 포함)를 스캔**하고 있었다. slow query log의 `Rows_examined: 100041`(두 챌린지 합산)로 발견. 전체 OR 표현식을 괄호로 한 번 더 감싸 수정.
- **본인 자신을 "더 높은 순위"로 잘못 카운트하는 정밀도 버그**: `Participation.created_at`은 DB에 `timestamp(6)`(마이크로초)로 저장되지만 Entity(`@CreateDateColumn`)에는 정밀도가 지정돼 있지 않아, JS `Date` 왕복 과정에서 잘려나가는 경우가 있다. 그 결과 자기 자신의 로우가 자신보다 "더 늦다(더 낮은 순위다)"고 잘못 카운트되어 `myRank`가 실제보다 1 크게 나오는 버그가 있었음(e2e 테스트로 발견: 참가자 1명뿐인 챌린지에서 myRank가 1이 아니라 2로 나옴). `p.id != :myId` 조건으로 자기 자신을 명시적으로 제외해서 수정 — 정밀도 문제를 우회.
- 남은 한계(고치지 않음, 알려진 제약으로 기록): 동점자 간 tie-break에 여전히 `created_at`의 정밀도 문제가 남아있어, score와 created_at이 완전히 같은(밀리초 단위) 두 참가자가 있으면 `myRank`와 실제 목록상의 위치가 어긋날 수 있음. 실사용 트래픽에서는 발생 가능성이 매우 낮다고 판단해 이번 범위에서는 손대지 않음.

### 이번에 다루지 않은 것 (다음 TODO 후보로 기록)

- `ChallengeService.findAll`, `FeedService.findAll`, `ParticipationService.getMyChallenge`도 동일한 무제한 offset 페이지네이션 패턴을 쓰고 있어 데이터가 커지면 같은 문제가 재현될 수 있음 — 이번 세션은 랭킹 조회만 다뤘고, 이 세 엔드포인트는 손대지 않음.
- Docker Compose의 slow query log 설정은 이번 조사에 쓰고 다시 껐음(영구로 켜두면 매 로컬 개발 세션마다 로그가 무한정 쌓이고 오버헤드가 생김) — 다음 부하 테스트(동시 참가/기록 갱신) 때 필요하면 `docker/docker-compose.yml`의 `command` 블록을 다시 추가할 것.

## 11. 다음 부하 테스트(동시 참가/기록 갱신) 전 체크리스트

이번 세션(§10)에서 실제로 겪은 세 가지 문제를 재발 방지용으로 남긴다 — 다음 TODO 시작 전에 순서대로 확인:

1. **더미 데이터의 동적값**: 새 시딩 스크립트를 SQL로 직접 짤 때 `NOW()`/`NOW(6)` 같은 DB 함수를 멀티 로우 `INSERT ... VALUES` 안에 넣지 말 것 — MySQL/MariaDB는 한 SQL문 안에서 이 함수를 한 번만 평가해서, 같은 배치의 모든 행이 동일한 타임스탬프를 갖게 된다(§10에서 실제로 겪음). 행마다 실제로 다른 값이 필요하면(타임스탬프, 랜덤 시드 등) 애플리케이션 코드(Python 등)에서 미리 계산해 리터럴로 박아 넣을 것 — `anything/loadtest/seed_participation.py`가 이 패턴의 예시.
2. **직접 작성한 SQL/쿼리빌더 조건의 오타·괄호 검증**: `.where()`/`.andWhere()`에 raw SQL 문자열로 `OR`가 섞인 조건을 넘길 때는 전체를 감싸는 괄호를 반드시 확인할 것(예: `((A) OR (B))`, `(A) OR (B)`가 아님) — TypeORM이 앞의 조건과 결합할 때 괄호가 없으면 의도와 다르게 파싱될 수 있다(§10 `myRank` 버그). **새로 작성한 쿼리는 k6/e2e로 검증하기 전에 먼저 실제 DB에 직접 실행(`docker exec mariadb mysql ...`)해서 결과 행 수·스캔 범위가 예상과 맞는지 눈으로 확인**할 것 — 이번 세션은 이 순서를 건너뛰어서 버그를 늦게 발견했다.
3. **서버 재시작이 실제로 됐는지 확인**: `kill %1`/`pkill -f "<패턴>"`은 이 환경에서 신뢰할 수 없다(Bash 도구 호출마다 새 쉘이라 job control이 안 먹히고, `pkill -f`는 `nest start --watch`가 아니라 그 자식 프로세스인 `node .../dist/src/main`을 못 잡는다). 항상 다음 순서로 확인:
   ```
   lsof -ti :3000 | xargs -r kill -9   # PID로 직접 종료
   lsof -i :3000                        # 비어있는지 확인
   # ... 서버 재기동 ...
   ps -o pid,lstart,command -p $(lsof -ti :3000)   # 새 PID의 시작 시각이 방금인지 확인
   ```
   추가로 `ps aux | grep "nest start --watch"`로 좀비 워처 프로세스가 남아있는지도 확인 — 누적되면 로컬 벤치마크 결과에 잡음을 만든다(§10에서 실제로 겪음).
