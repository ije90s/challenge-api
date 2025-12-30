## Challenge API

### 개요
- Challenge API는 챌린지 기능을 관리하는 NestJS 기반 REST API입니다.
- 단일 EC2 환경에서 **API 개발부터 CI/CD 파이프라인 구성, 서버 배포까지의 전체 흐름을 경험**하는 것을 목표로 개발했습니다.
- CI/CD 자동화, 마이그레이션 실행 전략, 헬스 체크 기반 배포 검증 등  
  **운영 관점에서의 의사결정과 구조 설계**에 중점을 두었습니다.
- 현재 서버는 종료된 상태입니다. (2025.12.30 기준)

### 기술 스택
| 구분 | 기술 |
| --- | --- |
| Programming Language | Node.js 20.15.1 |
| Framework | NestJS 11.0.6 |
| Database | MariaDB 10.6 |
| ORM | TypeORM |
| Testing | Jest |
| Version Control | Git |
| Cloud | AWS (EC2, RDS, S3, CodeDeploy, Parameter Store) |
| CI/CD | GitHub Actions, CodeDeploy |
| Process Manager | PM2 |
| API | RESTful API |


### 시스템 구성
- EC2 단일 인스턴스 환경
- RDS(MariaDB) 사용
- GitHub Actions → S3 → CodeDeploy 기반 배포

### CI/CD 파이프라인
- **배포 방식**: All-at-Once
- **배포 검증**: `/health` 엔드포인트 기반 상태 확인
- 개인 프로젝트 특성상 단일 서버 환경으로 운영하여 **마이그레이션은 CD 단계에서 실행**하도록 구성
- SCP, CodeDeploy 두가지 방식으로 연습했으며, 이에 대한 내용은 [scp](/anything/cicd_scp.md), [codeDeploy](/anything/cicd_codedeploy.md)에 기재

```text
GitHub Actions
 ├─ Test, Build
 ├─ S3에 빌드 파일 업로드
 └─ CodeDeploy 실행
    ├─ ApplicationStop
    │   └─ PM2 프로세스 중지
    ├─ BeforeInstall
    │   └─ AWS Parameter Store 기반 환경 변수 생성
    ├─ AfterInstall
    │   ├─ 패키지 설치
    │   └─ TypeORM 마이그레이션 실행
    ├─ ApplicationStart
    │   └─ PM2 startOrReload
    └─ ValidateService
        └─ /health 엔드포인트 호출
```

### 주요 구현 기능
- 인증
  - JWT + Passport 기반 인증 처리
  - Access Token 기반 API 보호
- 데이터베이스
  - TypeORM Entity 구성
  - 마이그레이션 파일 기반 스키마 관리
- 테스트
  - Jest 기반 서비스 레이어 유닛 테스트
  - E2E 테스트를 통한 API 흐름 검증
- Health Check
  - /health 엔드포인트 제공
  - 배포 성공/실패 판단 기준으로 활용

### 의도적 선택 및 제한 사항
- 마이그레이션 중복 방지 미구현
  - 단일 서버 환경에서 운영하므로, CD 단계에서 1회 실행하는 방식으로 관리
  - 멀티 인스턴스 환경에서 필요한 중복 방지 로직은 범위에서 제외
- Prometheus & Grafana 미적용
  - 단일 EC2 환경에서는 CloudWatch로 기본적인 서버 상태 확인이 가능하다고 판단

### 회고
- 실무에서 경험은 있었지만 개념적으로 불명확했던 부분들을 공식 문서와 직접 실습을 통해 다시 정리하는 계기가 되었다.
- 생성형 AI를 보조 수단으로 활용하면서, OOP, TypeScript, Shell Script와 같은 기본 개념에 대한 이해가 있어야 AI의 결과를 판단하고 설계에 반영할 수 있다는 점을 체감했다.
