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

## 8. 이번 문서에서 다루지 않는 것

- 실행 도구 선정(k6/artillery/autocannon 등) 및 스크립트 작성
- 실제 실행과 결과 수치
- EXPLAIN 분석, 커서 기반 페이지네이션 검토, 원자적 갱신 방식 결정 — 모두 Phase 4의 이후 TODO
