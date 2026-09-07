# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

Challenge API — NestJS + TypeORM 기반 "챌린지" 앱 REST API (사용자가 챌린지를 만들고, 다른 사용자가 참가해서 기록을 남기고 랭킹을 매기며, 관련 피드를 올리는 서비스). API 개발부터 CI/CD, 배포까지 전체 흐름을 경험하기 위한 학습 프로젝트로 만들었다 (원래의 EC2/CodeDeploy 구성은 README.md 참고, 현재는 서버 종료 상태).

이 프로젝트는 현재 리팩토링 진행 중이다. **`anything/refactor_plan.md`를 먼저 읽을 것** — 현재까지의 소스 분석, 알려진 버그/특이사항, 그리고 진행 중인 단계별 계획이 정리되어 있다: (1) 타입 안전성 강화 + Entity null 가드 + 예외/응답 일관성 + 테스트 격리, (2) 모듈/인증 가드 구조 정리, (3) MariaDB → Supabase PostgreSQL 마이그레이션, (4) 부하 테스트. 보안 강화(Rate Limiting, Refresh Token 등)는 실제 프로덕션이 아니라 로컬에서 운영할 예정이라 의도적으로 범위에서 제외했다. Backend가 안정화되면 React + TypeScript 프론트엔드 개발이 예정되어 있다.

`anything/memo.md`는 작성자 개인의 NestJS/TypeORM 학습 노트다 — 이 저장소에서 쓰인 컨벤션(예: `create()` vs `save()`, soft-delete 패턴, DTO 팩토리 네이밍)을 이해하는 데 참고할만 하지만, 공식 프로젝트 문서는 아니다.

## 커맨드

```bash
# 로컬 DB (Docker 기반 MariaDB, docker/.env에 MYSQL_* 변수 필요)
docker compose -f docker/docker-compose.yml up -d

# 개발 서버
npm run start:dev

# 빌드
npm run build

# Lint / Format
npm run lint
npm run format

# 유닛 테스트 (jest, rootDir=src, *.spec.ts 매칭)
npm test
npm run test:watch
npm run test:cov
npx jest challenge/challenge.service.spec.ts   # 특정 파일만 (src/ 기준 상대경로)
npx jest -t "회원가입 성공"                       # 특정 테스트 이름으로 실행

# E2E 테스트 (실제 AppModule + TypeORM을 띄우므로 DB 연결 필요)
npm run test:e2e
npx jest --config ./test/jest-e2e.json -t "<name>"

# 마이그레이션 (typeorm.datasource.ts를 CLI datasource로 사용)
npm run typeorm:d -- migration:generate src/migrations/<Name>
npm run typeorm:d -- migration:run
npm run typeorm:d -- migration:revert
```

필수 환경변수(`.env` / `.env.dev` / `.env.prod`, gitignore 처리되어 커밋되지 않음): `PORT`, `MODE`, `JWT_SECRET`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`. `docker/.env`는 로컬 Docker MariaDB 컨테이너용 `MYSQL_*` 변수를 별도로 가진다.

## 아키텍처

**모듈 구조**: `src/{user,auth,challenge,participation,feed}/` 각 모듈은 `*.controller.ts`, `*.service.ts`, `*.module.ts`, `dto/`, (auth 제외) `entity/`로 구성된다. `src/common/`은 전역 필터/인터셉터/미들웨어, `@User()` 파라미터 데코레이터, 공용 DTO(`RequestQueryDTO`, `ResponsePagingDto`), `util.ts`(multer 설정, 날짜 검증 헬퍼) 등 공통 요소를 담고 있다.

**요청 파이프라인** (`main.ts`에서 구성): 전역 `ValidationPipe`(`whitelist` + `forbidNonWhitelisted` + `transform`) → 전역 `HttpExceptionFilter` → 전역 `ResponseInterceptor`가 모든 성공 응답을 `{ success: true, data }` 형태로 감싼다. 과거 인터셉터와 `HttpExceptionFilter`의 문자열 에러 분기에서 `sucess`로 오타 나 있던 것을 `success`로 통일했다 (2026-09-07, `anything/refactor_plan.md` 참고).

**인증**: Passport JWT 전략(`auth/jwt/jwt.strategy.ts`)이 매 요청마다 디코딩된 토큰 페이로드의 이메일로 사용자를 다시 조회한다. `@User()` 데코레이터(`common/user.decorator.ts`)는 `request.user`를 읽는다. `JwtAuthGuard`는 `challenge`, `participation`, `feed` 컨트롤러에서 **클래스 단위**로 적용되어 있어, 읽기 전용 `GET` 요청을 포함한 모든 라우트가 현재 Bearer 토큰을 요구한다.

**Entity**: 모두 `common/entity/common.entity.ts`(`CommonEntity`: `id`, `created_at`, `updated_at`)를 상속한다. `Challenge`/`Participation`/`Feed`는 soft delete(`@DeleteDateColumn`)를 사용하며, `User`/`Challenge`로의 `ManyToOne` 관계는 `onDelete: 'SET NULL'`로 설정되어 있다 — 관련 레코드가 삭제되면 관계 필드(`author`, `user`, `challenge`)가 런타임에 `null`이 될 수 있는데, Entity 타입에는 이게 항상 반영되어 있지는 않다.

**DTO 컨벤션**: `Create*Dto`(class-validator 데코레이터 적용), `Update*Dto`는 create DTO로부터 `PartialType`(challenge) 또는 `PickType`(feed — 이 경우 challenge와 달리 필드가 다시 필수가 됨, optional이 아님)으로 생성되고, `Response*Dto`는 **private** 생성자와 static `from()` / `fromEntity()` / `of()` 팩토리 메서드로 Entity → 응답 형태를 매핑한다 (비밀번호 해시 등 민감 필드가 응답에 노출되지 않도록 함).

**페이지네이션**: `common/dto/request-query.dto.ts`(`page`/`limit` 쿼리 파라미터, offset 기반) + 제네릭 `common/dto/response-paging.dto.ts`(`ResponsePagingDto<T>`, `items`/`meta`)를 challenge/participation/feed의 목록 조회 엔드포인트 전반에 일관되게 사용한다.

**서비스 레이어**: 비즈니스 로직과 엔티티 간 검증은 컨트롤러가 아니라 서비스에 있다. 서비스끼리는 이벤트가 아니라 직접 호출로 연결된다 — 예를 들어 `ParticipationService`와 `FeedService`는 `ChallengeService`를 주입받아 챌린지 존재 여부/기간 만료 여부를 확인한 뒤 동작한다.

**DB 접근**: `mysql2` 드라이버로 MariaDB에 접근하는 TypeORM 구조이며, **수동으로 동기화를 유지해야 하는 두 개의 별도 DataSource 설정**이 존재한다: `src/app.module.ts`(`TypeOrmModule.forRoot`, 런타임에 사용, `synchronize: false`)와 `typeorm.datasource.ts`(TypeORM CLI가 마이그레이션에 사용). 마이그레이션 파일은 `src/migrations/`에 있으며, (현재 비활성화된) CI/CD 파이프라인에서는 CodeDeploy의 `AfterInstall` 단계에서 자동 실행된다 — 전체 파이프라인 다이어그램은 README.md 참고.
