# Challenge API 리팩토링/마이그레이션 계획

> 작성일: 2026-09-04
> 목적: NestJS 리팩토링 → MariaDB→Supabase PostgreSQL 마이그레이션 → 부하 테스트 → (Backend 정리 후) React+TS 프론트엔드 개발을 앞두고 진행한 전체 소스 분석 및 작업 계획.
> 이 시점 기준 코드 변경 없음. 분석 및 TODO만 정리.
> **2026-09-07 갱신**: PostgreSQL 마이그레이션(Phase 3)은 범위에서 제외. 리팩토링(Phase 1, 2) 이후 곧바로 부하 테스트(Phase 4)로 진행. 상세는 §2, Phase 3 항목 참고.

---

## 0. 프로젝트 구조와 주요 기능 (요약)

- NestJS 모듈: `user`, `auth`, `challenge`, `participation`, `feed` + `common`(필터/인터셉터/미들웨어/유틸/공통 엔티티)
- 도메인 흐름: 회원가입/로그인(JWT) → 챌린지 생성/조회 → 챌린지 참가/기록 갱신/랭킹 → 피드(이미지 업로드) CRUD
- TypeORM + MariaDB, 마이그레이션 파일 기반 스키마 관리(synchronize: false)
- 전역 `ValidationPipe`, `HttpExceptionFilter`, `ResponseInterceptor`로 공통 응답 포맷 통일
- EC2 단일 인스턴스 + GitHub Actions → S3 → CodeDeploy 배포 (현재 워크플로우 `if: false`로 비활성화, 서버 종료 상태)

---

## 1. 항목별 분석

### 1) NestJS 모듈/서비스/컨트롤러 구조

- **현재 상태**: 모듈당 Controller 1 + Service 1, `forwardRef`로 `User ↔ Auth` 순환 참조 해소, `ChallengeService`를 `Participation`/`Feed` 모듈이 재사용.
- **문제점**
  - 컨트롤러 클래스 전체에 `@UseGuards(JwtAuthGuard)`를 걸어 `GET /challenge`, `GET /challenge/:id`, `GET /feed/*` 같은 조회 엔드포인트까지 인증 강제 (`challenge.controller.ts`, `feed.controller.ts`)
  - `@User() user` 파라미터가 모든 컨트롤러에서 타입 없이(`any`) 사용됨
  - `User ↔ Auth` 순환 의존을 `forwardRef`로 우회
  - `findByTitle(0, title)` 같은 sentinel(0) 방식으로 "제외 없음"을 표현
- **왜 문제인지**: 인증 정책이 컨트롤러 단위로만 걸려 있으면 프론트엔드 연동 시 재설계 필요. `any` 타입은 리팩토링 중 필드명이 바뀌어도 컴파일러가 못 잡음. sentinel 값은 PostgreSQL 마이그레이션 등에서 조용히 깨질 수 있음.
- **개선 방향**: 엔드포인트 단위 인증 재검토(공개 조회 vs 인증 필요), `RequestUser` 타입 도입, `findByTitle(title, excludeId?)` 형태로 옵셔널화.
- **우선순위**: 중

### 2) TypeScript 타입 설계

- **현재 상태**: `tsconfig.json`에 `noImplicitAny: false`, `strictBindCallApply: false`. `strictNullChecks`는 켜져 있음.
- **문제점**
  - `noImplicitAny: false`로 `@User() user` 등 암묵적 `any` 다수
  - DTO ↔ Entity 수동 매핑이라 필드 추가/변경 시 컴파일 에러 없이 누락 가능
  - `JwtStrategy`의 `Payload.sub: string`인데 실제로는 `user.id`(number)를 대입 — 타입/실값 불일치
- **왜 문제인지**: `any`가 섞이면 TS의 리팩토링 안전망이 크게 줄어듦. Payload 타입 불일치는 지금은 무해하나 잠재적 버그.
- **개선 방향**: `noImplicitAny: true` 전환 후 에러를 리팩토링 과정에서 해소. `RequestUser`, `JwtPayload` 공용 타입을 `common/types`로 분리.
- **우선순위**: 상 (마이그레이션/리팩토링 전에 타입 안전성 확보가 선행 조건)

### 3) TypeORM Entity 및 DB 접근 방식

- **현재 상태**: `CommonEntity`(id/created_at/updated_at) 상속, 모든 `ManyToOne`이 `onDelete: 'SET NULL'`, soft delete(`DeleteDateColumn`) 사용.
- **문제점**
  - 관계가 전부 `SET NULL`인데 코드에서는 `challenge.author.id`, `feed.user.id` 등 관계 객체가 항상 존재한다고 가정(null 가드 없음) → 작성자 탈퇴 시 `TypeError` 발생 가능
  - `ParticipationService`의 score/challenge_count 갱신이 트랜잭션/락 없는 read-modify-write → 동시 요청 시 갱신 유실 가능성
  - `title`에 `unique: true` + soft delete 조합 → 삭제된 레코드의 title도 유니크로 남아 재사용 불가 (의도된 정책인지 확인 필요)
  - `getChallengeRank`처럼 `createQueryBuilder` 사용 구간은 relation 미지정이라 추후 필드 추가 시 놓치기 쉬움
  - `typeorm.datasource.ts`와 `app.module.ts`에 DB 접속 설정 중복 정의
- **왜 문제인지**: null 가드 누락은 실사용 버그(탈퇴 회원 콘텐츠 조회 시 500). 레이스 컨디션은 부하 테스트에서 재현 가능성 높음. 설정 중복은 PostgreSQL 전환 시 누락 위험.
- **개선 방향**: 관계 필드 optional chaining 처리, score/count 갱신을 트랜잭션+락 또는 원자적 `increment()`로 전환, 유니크+soft delete 정책 결정(부분 유니크 인덱스 검토), DataSource 설정 통합.
- **우선순위**: 상

### 4) 예외 처리와 Validation

- **현재 상태**: 전역 `ValidationPipe(whitelist, forbidNonWhitelisted, transform)`, 도메인별 예외 클래스 사용, `HttpExceptionFilter`로 응답 포맷 통일.
- **문제점**
  - "중복된 제목" 등에 `UnauthorizedException`(401) 사용 — 의미상 `ConflictException`(409)이 맞음 (challenge/feed/participation 다수 지점)
  - 응답 JSON의 성공 플래그 키가 `sucess`(오타)로 되어 있는 곳과 `success`(정상)로 되어 있는 곳이 혼재 (`response.interceptor.ts`, `http.exception.filter.ts`, `multer.exception.filter.ts`)
  - `MulterExceptionFilter`가 응답 전송 후 다시 `throw exception` — 이중 처리 가능성
  - `JwtStrategy.validate()`에서 `this.userService.findOneByEmail(payload.email)`에 `await` 누락 → `if(!user)` 체크가 죽은 코드 (현재는 async 함수의 프로미스 자동 언래핑으로 우연히 동작)
  - Validation 에러 메시지가 class-validator 기본 영어 메시지 그대로 노출
- **왜 문제인지**: status code 오매핑은 프론트엔드에서 에러 유형 오인 유발. 오타 혼재는 실제 파싱 버그로 이어짐. await 누락은 지금은 동작하지만 취약한 코드.
- **개선 방향**: 예외 재매핑(중복→409, 권한없음→403, 인증실패→401, 없음→404), `sucess`→`success` 전역 통일, MulterExceptionFilter 이중 응답 정리, `await` 추가.
- **우선순위**: 상 (프론트엔드 개발 전에 API 계약 고정 필요)

### 5) 테스트 현황과 부족한 테스트

- **현재 상태**: 서비스 레이어(challenge/feed/participation)는 300줄 이상의 비교적 촘촘한 유닛 테스트. 컨트롤러 스펙은 대부분 "should be defined" 수준. e2e(`test/app.e2e-spec.ts`, 621줄)는 실제 `AppModule`(실 DB 연결) 기반.
- **문제점**
  - 컨트롤러 레벨에서 가드 동작, `ParseIntPipe`, DTO validation 실패(400) 등 미검증
  - e2e가 격리된 테스트 DB/트랜잭션 롤백 없이 실행되어 이전 실행 상태에 의존 (예: "이미 존재하는 이메일" 기대 → 409)
  - Repository/쿼리빌더(랭킹 조회) 레벨 통합 테스트 부재
- **왜 문제인지**: 리팩토링/마이그레이션의 안전망 역할을 해야 하는데 현재 e2e가 가장 불안정한 상태.
- **개선 방향**: e2e에 트랜잭션 롤백 또는 Testcontainers 기반 DB 초기화 도입, 컨트롤러 최소 계약 테스트 추가, 쿼리빌더 기반 로직은 마이그레이션 전 통합 테스트로 커버.
- **우선순위**: 상 (사실상 이번 계획의 선행 조건)

### 6) MariaDB → PostgreSQL 마이그레이션 시 주의점

- **문제점 / 왜 문제인지**
  - `tinyint` 타입: PostgreSQL에 없음(`smallint`로 대체 필요) — `Challenge.type`, `mininum_count`, `Participation.status`
  - 기존 마이그레이션 파일이 MariaDB raw SQL(백틱, `AUTO_INCREMENT`, `ENGINE=InnoDB`) — 재사용 불가
  - `timestamp` 컬럼에 타임존 정보 없음 — PostgreSQL은 `timestamp`/`timestamptz` 구분이 명확해 시간대 버그 소지
  - `AUTO_INCREMENT` → PostgreSQL `serial`/`identity` 매핑 시 데이터 이관 후 시퀀스 재설정 필요
  - `mysql2` 드라이버 → `pg` 드라이버 교체, `type: 'mysql'` 설정 전체 교체
  - `feed.images`의 `json` → PostgreSQL `jsonb` 사용 권장(인덱싱/성능 이점)
  - 유니크+soft delete 조합은 PostgreSQL 부분 유니크 인덱스로 구현이 자연스러움
  - `MoreThanOrEqual(today)` 같은 날짜 비교 쿼리는 서버-DB 타임존 설정 차이에 민감 — 마이그레이션 시 재검증 필요
- **개선 방향**: 컬럼 타입 재정리 → 새 마이그레이션 히스토리(PostgreSQL 기준) → 드라이버/DataSource 교체 → 데이터 이관(덤프/리스토어 + 시퀀스 재설정) → 전체 테스트 스위트 재실행(특히 랭킹 쿼리).
- **우선순위**: 상 (마이그레이션 핵심 리스크가 몰려 있음, 테스트 보강과 짝을 이뤄야 함)

### 7) 성능/DB 병목 가능성

- **현재 상태**: `Participation`에 랭킹용 복합 인덱스(`idx_challenge_score_rank`, `idx_challenge_count_rank`) 존재. 페이지네이션은 offset(`skip`/`take`) 기반.
- **문제점 / 왜 문제인지**
  - 인덱스 컬럼 순서 `(challenge, score, created_at)` vs 쿼리의 `ORDER BY score DESC, created_at DESC` — 정렬 방향 불일치로 filesort 발생 가능(EXPLAIN으로 실측 필요)
  - offset 페이지네이션은 페이지 번호가 커질수록 스캔 비용 증가(랭킹 하위권 조회 등)
  - `ParticipationService`의 락 없는 read-modify-write는 정확성 문제이자 동시 참가 몰릴 때 성능 저하로도 이어질 수 있음
  - 로컬 디스크 기반 이미지 업로드는 스케일아웃 시 병목 소지 (현재 계획 범위 밖이지만 참고용으로 기록)
- **개선 방향**: 부하 테스트 시나리오에 "랭킹 조회", "동시 참가 갱신" 포함 → EXPLAIN으로 실측 → PostgreSQL 인덱스 재설계(정렬 방향 포함) → 필요 시 커서 기반 페이지네이션 → score/count 갱신 원자적 쿼리 전환.
- **우선순위**: 중 (부하 테스트 실측 후 우선순위 재조정)

### 8) 보안 측면

- **현재 상태**: JWT + bcrypt, `.env*`는 `.gitignore`에 등록되어 실제 커밋되지 않음(확인 완료). `ValidationPipe`의 whitelist/forbidNonWhitelisted 적용.
- **문제점(참고용, 이번 계획에서는 대응하지 않음)**
  - CORS/helmet/Rate Limiting 부재
  - JWT 만료 `1y`, Refresh Token/토큰 폐기 메커니즘 없음
  - `package.json`에 불필요한 `fs`, `path` 의존성 (npm의 `fs` 패키지는 보안 경고용 더미 패키지)
  - 업로드 파일 검증이 확장자 기반만 존재(MIME/시그니처 검사 없음)
- **참고**: 사이드 프로젝트로 실제 배포 없이 로컬 단위 진행 예정이라, 본 계획에서는 강한 보안 강화를 하지 않기로 결정함. `fs`/`path` 의존성 제거처럼 비용이 낮은 항목만 여유 있을 때 처리.
- **우선순위**: 하 (범위 제외에 가까움)

---

## 2. 확정된 작업 우선순위

```
[3 타입 설계 + 4 Entity/DB 접근 + 5 예외처리/Validation + 6 테스트]
  > 2 모듈구조
  > 8 성능(부하 테스트까지만)
  > 9 보안(최소화, 사실상 범위 제외)
```

> **2026-09-07 변경**: MariaDB → Supabase PostgreSQL 마이그레이션(Phase 3, 원 계획 §6 "마이그레이션 시 주의점")은 이번 계획 범위에서 제외하기로 결정. 리팩토링(Phase 1, 2) 완료 후 마이그레이션 없이 곧바로 부하 테스트(Phase 4)로 진행한다. 아래 §1의 6번 항목과 원래의 Phase 3 TODO는 참고용으로 남겨두되 실행하지 않음.

- 3/4/5/6을 묶어서 먼저 가는 이유: 서로 얽혀 있는 기초 작업 — 타입이 튼튼해야 Entity null 가드 같은 버그를 컴파일 타임에 잡고, 그게 예외처리 정합성과 테스트 보강의 전제가 됨.
- 9번(보안)은 실제 배포가 아니라 로컬 진행이라 Rate Limiting/Refresh Token/helmet 등은 진행하지 않음.
- 8번(성능)도 "부하 테스트로 병목 확인"까지가 목표이며, 이후 인프라 스케일링 대응은 범위 밖.
- 7번(마이그레이션 주의사항)은 범위 제외로 실행하지 않음 — MariaDB 구조를 유지한 채 부하 테스트로 넘어감.

---

## 3. TODO 리스트

### Phase 1 — 타입/Entity/예외처리/테스트 기반 다지기 (최우선)

**1-1. 타입 강화**
- [x] `tsconfig.json`: `noImplicitAny: true`로 전환 (2026-09-05)
- [x] 전환 후 발생하는 컴파일 에러를 파일별로 정리 → 세부 작업 리스트화 (2026-09-05, 상세는 `anything/worklog_2026-09-05.md` 참고)
- [x] `common/types` 신설, `RequestUser` 타입 정의 → `@User()` 데코레이터 및 전 컨트롤러에 적용 (2026-09-05, 실제 사용처 기준으로 `{ id: number }`만 정의 — `email`은 어디서도 쓰이지 않아 제외)
- [x] `JwtPayload` 타입 정의(`jwt.strategy.ts`) — `sub` 타입/실값 불일치 수정 (2026-09-06, 상세는 `anything/worklog_2026-09-06.md` 참고)

**1-2. Entity / DB 접근**
- [x] `challenge.author`, `feed.user`, `participation.user`/`challenge` 접근부 null 가드 추가 (2026-09-07)
  - `ResponseChallengeDto`, `ResponseFeedDto` 생성자
  - `ChallengeService.update/delete`의 author 비교
  - `FeedService.update/delete`의 user 비교
- [x] `findByTitle(id, title)` sentinel(0) 패턴 제거 → `excludeId?: number`로 변경 (challenge, feed) (2026-09-07)
- [x] `ParticipationService.update`의 score/challenge_count 갱신 원자적 처리 검토 (2026-09-07, 검토 완료 — read-modify-write 방식의 lost update 문제 확인. 실측 없이 방식(atomic increment/비관적 락/낙관적 락)을 정할 근거가 없어 실제 구현은 Phase 4 부하 테스트("동시 참가/기록 갱신" 시나리오) 실측 후 재검토로 확정 이월. 검토 중 발견한 `UpdateParticipationDto.score`/`challenge_count`의 음수값 미검증 문제만 `@Min(0)` 추가로 별도 반영, 상세는 `anything/worklog_2026-09-07.md` 참고)
- [x] `app.module.ts` / `typeorm.datasource.ts` DataSource 설정 통합 (2026-09-07, 진행 안 함 — 작성자가 마이그레이션 CLI(`typeorm.datasource.ts`)와 런타임 앱(`app.module.ts`)이 분리 동작하는 걸 직접 관찰하려는 목적으로 의도적으로 유지 중인 상태라 이번 계획에서 제외. 두 파일의 커넥션 자격증명 리터럴이 중복인 것 자체는 여전히 사실이며, 실제 위험(dev/prod 자동 분기 등)은 없음을 확인함 — 필요해지면 재검토)

**1-3. 예외 처리 / Validation**
- [x] `sucess` → `success` 전역 통일 (`response.interceptor.ts`, `http.exception.filter.ts`, `multer.exception.filter.ts`, 관련 스펙/e2e assertion) (2026-09-07)
- [x] "중복" 계열 `UnauthorizedException` → `ConflictException` 재매핑 (challenge/feed 제목 중복, participation 중복 참가 등) (2026-09-07, 논의 중 발견한 범위 밖 오매핑도 함께 정리 — "챌린지/피드가 없습니다" → `NotFoundException`, "날짜 설정이 잘못되었습니다" → `BadRequestException`, "기간이 지났습니다"(feed/participation create+update) → `ConflictException`, participation의 "챌린지가 존재하지 않습니다" Forbidden/NotFound 불일치 → `NotFoundException`으로 통일. 상세는 `anything/worklog_2026-09-07.md` §8 참고)
- [x] `JwtStrategy.validate()`의 `await` 누락 수정 (2026-09-06, 상세는 `anything/worklog_2026-09-06.md` 참고)
- [x] `MulterExceptionFilter` 이중 응답(응답 후 재throw) 로직 정리 (2026-09-07, 상세는 `anything/worklog_2026-09-07.md` §9 참고)
- [x] `FeedService.update`의 이미지 유실 버그 수정 (`getFileArr(images) ?? feed.images`가 항상 배열 반환하는 문제) (2026-09-08, 새 이미지 없으면 `feed.images` 유지하도록 수정, 전체 삭제 기능은 스코프 밖으로 결정)

**1-4. 테스트 보강**
- [ ] e2e 테스트 격리 전략 도입 (트랜잭션 롤백 또는 Testcontainers 기반 DB 리셋)
- [ ] 컨트롤러 스펙에 최소 계약 테스트 추가 (Guard 통과/차단, 잘못된 body → 400)
- [ ] 위 1-1~1-3 수정 항목에 대한 회귀 테스트 추가/보완

### Phase 2 — 모듈 구조 정리
- [ ] 인증 정책 재검토: 조회성 엔드포인트(`GET /challenge`, `GET /challenge/:id`, `GET /feed/*`)의 Guard 필요 여부 결정
- [ ] `User ↔ Auth` `forwardRef` 순환 의존 구조 재검토

### Phase 3 — MariaDB → Supabase PostgreSQL 마이그레이션 (2026-09-07 범위 제외, 미실행)
> Phase 1/2 완료 후 마이그레이션 없이 바로 Phase 4로 진행하기로 결정. 아래 항목은 추후 재검토용 기록.
- [ ] 컬럼 타입 재설계 (`tinyint`→`smallint`, `timestamp`→`timestamptz` 여부, `json`→`jsonb` 검토)
- [ ] 유니크 제약 + soft delete 정책 결정 (부분 유니크 인덱스 적용 여부)
- [ ] PostgreSQL 기준 마이그레이션 히스토리 재작성 (기존 마이그레이션 아카이브)
- [ ] 드라이버 교체(`mysql2`→`pg`), DataSource 설정 전환
- [ ] 인덱스 재설계 시 정렬 방향 포함
- [ ] 데이터 이관 전략 수립 (덤프/리스토어, 시퀀스 재설정)
- [ ] 전체 테스트 스위트 Postgres 대상 재실행 (특히 `getChallengeRank` 쿼리)

### Phase 4 — 부하 테스트 & 성능 개선 (Phase 2 완료 후 Phase 3 없이 바로 진행, 여기까지만 진행)
- [ ] 부하 테스트 시나리오 설계 (랭킹 조회, 동시 참가/기록 갱신 우선)
- [ ] 실측 후 슬로우 쿼리 EXPLAIN 확인
- [ ] 필요 시 커서 기반 페이지네이션 검토
- [ ] score/challenge_count 원자적 갱신 여부 최종 결정 (실측 기반)

### 범위 제외 / 최소화 (참고용)
- 보안 강화(Rate Limiting, Refresh Token, helmet, 파일 시그니처 검증 등)는 로컬 진행 특성상 작업하지 않음
- `fs`/`path` 불필요 의존성 제거는 비용이 낮으므로 여유 있을 때 처리 (필수 아님)
