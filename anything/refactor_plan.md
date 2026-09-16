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
- [x] e2e 테스트 격리 전략 도입 (트랜잭션 롤백 또는 Testcontainers 기반 DB 리셋) (2026-09-08, 별도 테스트 DB 없이 기존 로컬 DB 그대로 두고 트랜잭션 롤백 방식 채택. `test/utils/transactional-data-source.ts` 신설, `test/app.e2e-spec.ts` 전면 재작성 — 죽어있던 성공 assertion 복원 + 하드코딩 PK 제거도 함께 진행. 상세는 `anything/worklog_2026-09-08.md` Part 2 참고)
- [x] 컨트롤러 스펙에 최소 계약 테스트 추가 (Guard 통과/차단, 잘못된 body → 400) (2026-09-09, e2e가 이미 실 HTTP로 Guard 차단/400을 촘촘히 검증 중이라 컨트롤러 스펙에는 reflection 기반 최소 검증(`JwtAuthGuard` 적용 여부)만 추가 — `src/common/test/guard-metadata.helper.ts` 공유 헬퍼 신설. 상세는 `anything/worklog_2026-09-09.md` 참고)
- [x] 위 1-1~1-3 수정 항목에 대한 회귀 테스트 추가/보완 (2026-09-09, 갭 4곳 전부 반영 — `jwt.strategy.spec.ts`/`multer.exception.filter.spec.ts` 신설, challenge/feed 서비스 스펙에 author/user null 케이스 추가, e2e에 participation 음수값 400 케이스 추가. 상세는 `anything/worklog_2026-09-09.md` 참고)

### Phase 2 — 모듈 구조 정리
- [x] 인증 정책 재검토: 조회성 엔드포인트(`GET /challenge`, `GET /challenge/:id`, `GET /feed/*`)의 Guard 필요 여부 결정 (2026-09-10, 소스 분석 결과 해당 서비스 메서드들은 `user`를 전혀 사용하지 않아 Guard가 기술적으로는 불필요함을 확인했으나, 작성자가 "회원가입 안 된 유저는 조회도 포함해 접근 못하게" 의도적으로 설계한 정책임을 확인 — 현행 클래스 단위 `JwtAuthGuard` 유지로 결론, 코드 변경 없음)
- [x] `User ↔ Auth` `forwardRef` 순환 의존 구조 재검토 (2026-09-10, 소스 분석 결과 순환의 실제 원인은 `UserController`가 로그인(`POST /user/login`) 처리를 위해 `AuthService`를 주입받는 것 하나뿐(`UserService`는 `AuthModule`을 전혀 쓰지 않음) — `AuthModule` 소속 `AuthController`로 로그인 라우트를 옮기면(`@Controller('user')`로 경로는 유지) `forwardRef` 없이 단방향 의존(`AuthModule → UserModule`)으로 정리 가능함을 확인. 다만 로컬 부하 테스트까지만 진행하고 보안 강화는 범위 밖이라는 프로젝트 방침상 이 리팩토링의 실익이 낮다고 판단해 현행 구조(양쪽 `forwardRef`) 유지로 결론 — `forwardRef`는 NestJS가 공식 지원하는 정상 패턴이라 방치해도 되는 수준의 이슈로 판단. 코드 변경 없음)

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
- [x] 부하 테스트 시나리오 설계 (랭킹 조회, 동시 참가/기록 갱신 우선) (2026-09-14, 시나리오 문서만 작성하기로 범위 결정 — 실행 도구 선정/스크립트/실측은 다음 TODO로 이월. 상세는 `anything/load_test_plan.md` 참고)
- [x] 실측 후 슬로우 쿼리 EXPLAIN 확인 (2026-09-14, k6로 랭킹 조회 부하 테스트 실행 — filesort는 발생하지 않음을 확인(§1-7 가설 기각), offset 페이지네이션 자체의 스캔 비용 증가(offset 0: 0.065ms → offset 40000: 42.8ms)가 실제 병목임을 실측으로 확인. "커넥션 풀 기본값(10)이 원인일 것"이라는 부가 가설도 세워 `connectionLimit: 100`으로 재실측했으나 오히려 악화됨을 확인하고 반증(풀이 아니라 DB의 동시 스캔 처리 한계가 원인) — 코드는 원복. 상세는 `anything/load_test_plan.md` §9 참고)
- [x] 필요 시 커서 기반 페이지네이션 검토 (2026-09-14, §9 실측 근거로 커서 방식 대신 "상위 100위 캡 + 본인 순위 별도 엔드포인트"로 대체 결정 — 사용자 확인. 구현 후 최종 k6 검증: p95 1.75s→473ms(임계값 500ms 통과), 처리량 52.4→189.3 req/s. 구현 중 `myRank` 쿼리의 괄호 버그(챌린지 필터 우회)와 자기 자신을 잘못 카운트하는 타임스탬프 정밀도 버그를 발견해 함께 수정. `ChallengeService.findAll`/`FeedService.findAll`/`getMyChallenge`도 같은 무제한 offset 패턴이나 이번 범위 밖 — 상세는 `anything/load_test_plan.md` §10 참고)
- [x] score/challenge_count 원자적 갱신 여부 최종 결정 (실측 기반) (2026-09-15, k6로 같은 참가 로우에 동시 PATCH 20건 실측 — lost update 재현율 90~95%(20건 중 18~19건 유실)로 심각하게 확인됨. `repository.increment()`로 SQL 원자 연산 전환해 재실측 시 0건 유실(20/20 정확) 및 완료 임계값 동시 교차 케이스도 정상 동작 확인. 코드리뷰에서 `updateStatus()`의 `save()`가 동시 `increment()` 결과를 덮어쓸 수 있는 잔여 갭을 추가로 발견해 같은 패턴(타깃 컬럼만 갱신)으로 함께 수정. 상세는 `anything/worklog_2026-09-15.md` 참고)
- [ ] `ParticipationService.create`의 중복 참가 check-then-act race 검토 (`findOne`으로 기존 참가 확인 후 `create`+`save` — 마이그레이션(`1766221023728-Init.ts`) 확인 결과 `participation` 테이블에 `(user_id, challenge_id)` DB 레벨 UNIQUE 제약 없음, 동시 `POST` 시 중복 참가 로우 생성 가능. 2026-09-15 score/challenge_count 원자성 분석 중 발견해 별도 항목으로 분리)
- [x] `ChallengeService.findAll`/`FeedService.findAll`/`getMyChallenge`(§Phase 4 2026-09-14 항목에서 "같은 무제한 offset 패턴, 범위 밖"으로 남겨뒀던 후보) 추가 부하 테스트 진행 여부 결정 (2026-09-15, 진행 안 함으로 결정 — 사용자 확인. 페이지네이션 UI는 쿼리 성능과 무관하게 동일하게 구현되므로 프론트엔드 화면 설계에 영향 없음, 로컬/개인 사용 규모에서는 랭킹 쿼리 실측 때(4만 건)만큼 데이터가 쌓일 가능성이 낮음(참가자당 1행인 랭킹과 달리 챌린지/피드 개수는 통상 훨씬 적음), 이번 주 내 프론트엔드 완료 일정 우선. 이걸로 Phase 4의 부하 테스트 범위는 위 중복 참가 race 검토 1건만 남기고 종료)
- [x] `ParticipationService.create`의 중복 참가 check-then-act race 최종 해결 (2026-09-16, `(user, challenge)` 복합 유니크 인덱스(`idx_unique_user_challenge`) 추가 + `save()`의 `QueryFailedError`(ER_DUP_ENTRY, `driverError.sqlMessage`로 해당 인덱스 위반인지까지 확인)를 캐치해 기존과 동일한 `ConflictException("이미 참가중입니다.")`로 변환. e2e에 `Promise.all` 동시 요청 테스트 추가해 실제 로컬 DB에서 레이스 재현 및 수정 확인(반복 실행 시 매번 201/409로 정확히 갈림). code-review에서 이 패턴과 같은 계열의 미해결 이슈 2건(User 이메일 중복가입, Challenge/Feed 제목 중복) 발견해 아래 항목으로 별도 등록. 추가로 code-review가 지적한 "새 유니크 인덱스가 soft-delete(`deleted_at`)를 고려하지 않아, 참가 취소를 soft-delete로 구현하면 재참가가 영구히 막힐 수 있다"는 지점은 — 현재 `Participation`에 soft-delete를 호출하는 코드 자체가 없어(참가 취소 기능 미구현) 아직 재현 불가능한 **잠재적 버그**로, 별도 TODO는 등록하지 않고 이 항목 기록으로만 남김. 참가 취소 기능을 실제로 만들 때 반드시 먼저 풀어야 함 — hard-delete로의 전환은 선택지가 아님(이 프로젝트가 soft-delete를 쓰는 이유 자체가 로우 증가 시 영구 삭제를 피하기 위함, 2026-09-16 확인). MariaDB가 PostgreSQL의 partial unique index를 지원하지 않으므로 (a) 생성/가상 컬럼(예: `deleted_at IS NULL`이면 `challenge_id`, 아니면 `NULL`을 반환)로 "활성 상태만 유니크" 구현, 또는 (b) 재참가 시 기존 soft-deleted 로우를 `restore()`로 되살려 로우를 하나만 유지 — 두 방향을 검토 후보로 논의함)
- [x] `UserService.signUp()`의 이메일 중복가입 check-then-act(`findOneByEmail` 후 `save()`) 레이스 검토 (2026-09-16, participation 때(2026-09-16) 확립한 패턴 재사용 — `email` 유니크 인덱스는 이미 존재했으므로 신규 인덱스 추가는 불필요, 대신 자동생성 해시명(`IDX_e12875dfb3b1d92d7d7c5377e2`)을 마이그레이션으로 `idx_unique_email`로 rename하고 엔티티에 명시적 `@Index` 데코레이터로 전환. `signUp()`의 `save()`를 try/catch로 감싸 `QueryFailedError`(`ER_DUP_ENTRY` + `sqlMessage`에 해당 인덱스명 포함)만 기존과 동일한 `ConflictException`으로 변환. e2e `Promise.all` 동시 가입 테스트 추가, 셰어드 커넥션(`TransactionalTestDataSource`) 특성상 실제로 새 catch 경로를 타는지 임시 프로브 로그로 5회 반복 검증(매번 히트) 후 제거. code-review에서 지적한 마이그레이션의 `DROP INDEX`+`CREATE UNIQUE INDEX` 2단계가 MariaDB DDL 암묵적 커밋으로 원자적이지 않다는 문제를 단일 `ALTER TABLE ... RENAME INDEX`로 교체해 반영. `Challenge.title`/`Feed.title` 제목 중복 레이스(다음 TODO)와 동일 패턴이나 이번 범위는 User만 — 사용자 확인)
- [x] `Challenge.title`/`Feed.title` 생성 시 동일 계열 중복 제목 레이스 보호 검토 (2026-09-16, participation/user와 동일 패턴 재사용. 두 테이블(challenge/feed)의 자동생성 해시 인덱스명을 마이그레이션 하나로 묶어 `idx_unique_challenge_title`/`idx_unique_feed_title`로 rename(각각 원자적 `ALTER TABLE ... RENAME INDEX`), 엔티티를 `@Index` 명시로 전환. 원래 "생성 시"로 한정된 TODO였으나 사용자 확인 하에 동일 구조의 `update()`(제목 변경 시)까지 범위 확장. 각 서비스 내부에 `saveOrThrowDuplicateTitle()` private 헬퍼를 둬 create/update 두 호출부의 중복을 파일 내에서만 줄이되, participation/user와의 교차 파일 공유 헬퍼 추출은 이번에도 보류(사용자 확인, 계속 복붙). e2e `Promise.all` 동시 생성 레이스 테스트 추가(challenge/feed 각 1개), 임시 프로브 로그로 5회 반복 실행해 새 catch 경로가 실제로 히트함을 재확인 후 제거. code-review에서 지적한 "`sqlMessage`에 인덱스명만 bare substring으로 매칭하면 title 값 자체가 우연히 그 문자열을 포함할 때 오탐할 수 있다"는 지점을 반영해 `for key '인덱스명'`까지 포함한 매칭으로 강화(challenge/feed만 — participation/user는 이번 범위 밖, 동일 약점이 남아있어 후속 검토 후보로 기록). 같은 리뷰에서 발견한 "`common/util.ts`의 멀터 파일명이 `Date.now()`(밀리초)만 써서 동시 업로드 시 파일명 충돌 가능"은 업로드 로직 전반의 별도 이슈로 이번 범위 밖(이번 e2e 테스트는 두 업로드 내용이 동일해 충돌해도 무해함을 확인), "`feed.service.ts`의 이미지 경로가 `feed/파일명`으로 반환되는데 실제 서빙 경로는 `/uploads/feed/파일명`이라 프론트에서 그대로 쓰면 404"는 Phase 5 정적 서빙 작업(2026-09-16) 당시 만들어진 기존 버그로 이번 diff와 무관해 범위 밖, 별도 TODO 후보로만 기록)

### Phase 5 — 프론트엔드(frontend-pratice) 연동 준비 (Phase 4 완료 후)
> 2026-09-15 신설. 실제 프론트엔드 개발은 별도 리포지토리 `frontend-pratice`(GitHub 원격명 `react-pratice`)에서 진행하지만, 이 두 항목은 `challenge-api` 쪽 코드 없이는 프론트가 API를 아예 호출/조회할 수 없어 이 리포지토리의 선행 작업으로 등록한다.
- [x] CORS 설정 추가 (`main.ts`에 `app.enableCors()` 없음) — Vite 개발 서버(다른 origin)에서 API 호출 시 브라우저가 CORS로 차단할 것으로 예상, 로그인/회원가입부터 막힘 (2026-09-16, origin을 하드코딩하지 않고 `FRONTEND_ORIGIN` 환경변수로 신설 — 인증이 Authorization 헤더 기반이라 `credentials` 옵션은 불필요. code-review에서 "env var 미설정 시 `cors` 패키지가 origin을 `*`로 열어버리는" 문제를 발견해 부팅 시 `FRONTEND_ORIGIN` 미설정이면 즉시 에러로 죽도록 fail-fast 검증 추가, CLAUDE.md 필수 환경변수 목록도 갱신)
- [x] 업로드 이미지 정적 서빙 설정 (`app.useStaticAssets()` 또는 `ServeStaticModule`, `/uploads` prefix) — `feed.service.ts`가 이미지를 `uploads/feed/{filename}`에 디스크 저장하고 `ResponseFeedDto.images`엔 `"feed/파일명.jpg"` 상대경로 문자열만 담는데, 정적 파일 서빙 설정이 전혀 없어 프론트에서 이미지를 HTTP로 조회할 방법이 없음 (2026-09-16, 신규 의존성 없이 기존 `@nestjs/platform-express`의 `NestExpressApplication.useStaticAssets()`로 해결. 멀터 저장 경로(`common/util.ts`)와 서빙 루트 경로가 각자 계산되던 걸 `UPLOADS_ROOT_DIR` 공유 상수로 통합(code-review 지적 반영). 실 서버 기동으로 `GET /uploads/feed/파일명` 200, 존재하지 않는 파일/path traversal 404 수동 검증 완료. code-review가 지적한 "정적 서빙이 인증 없이 전체 공개되고, soft-delete된 피드 이미지도 영구 노출됨" 문제는 `plan` 단계에서 이미 사용자에게 명시적으로 확인받고 범위 제외한 내용과 동일해 이번엔 코드 변경 없이 기록만 남김 — 인증 필요한 이미지 서빙으로 바꾸려면 `useStaticAssets` 대신 `JwtAuthGuard`가 걸린 전용 컨트롤러 라우트로 스트리밍하는 구조 전환이 필요, 향후 프론트엔드 연동 중 실제로 문제 되면 재검토)

### 범위 제외 / 최소화 (참고용)
- 보안 강화(Rate Limiting, Refresh Token, helmet, 파일 시그니처 검증 등)는 로컬 진행 특성상 작업하지 않음
- `fs`/`path` 불필요 의존성 제거는 비용이 낮으므로 여유 있을 때 처리 (필수 아님)
