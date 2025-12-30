## CI/CD With SCP 
### CI 
- 기존에 풀퀘로 진행한 CI처럼 githubactions의 러너에서 빌드까지 진행
- production에서 필요한 파일들만 압축파일을 생성
- 스토어에 제공하는 scp로 ec2에 압축파일 업로드 

### CD 
- app 폴더를 생성, 그 폴더에 압축파일에 덮어쓰기로 압축해제(그 전에 app에 있던 파일들은 삭제)
- 이미 러너에서 ci로 받았기 때문에 prodcution 모드로 npm 설치
- 마이그레이션 실행 하기 전에 현 위치와 마이그레이션 파일들이 있는지 확인 후, 마이그레이션 실행 
- pm2로 스타트/리로드 

### ETC
- EC2, RDS(mariadb) 셋팅 > node, pm2 설치(2025.12.25)
- github에 ssh 접속 정보 저장
- .env 원본 파일은 미리 서버에 등록
- 압축 파일명을 app_{타입스탬프} 형태로 하여 파일명 중복 방지

### Error
- TypeORM 마이그레이션 부분에서 오류가 발생하여 10번 시도 끝에 배포 성공
    - ❗️마이그레이션 경로, 실행 명령어 점검 필요
- Error: Cannot find module 'ts-node/register'
    - 타입스크립트 기반 ts-node로 실행 대신 js로 실행되도록 변경
    ```text
    # ts 기반 마이그레이션 실행
    node -r ts-node/register ./node_modules/typeorm/cli.js -d typeorm.datasource.ts
    # js 기반 마이그레이션 실행 
    node ./node_modules/typeorm/cli.js -d dist/typeorm.datasource.js migration:run
    ```
- Error: Cannot find module '/home/***/app/node_modules/typeorm/cli.js'
    - cli 파일을 못찾아서 계속 실패하여 npx로 사용
    ```text
    npx typeorm migration:run -d ./dist/typeorm.datasource.js
    ```
- Error: http fetch GET https://registry.npmjs.org/typeorm attempt 1 failed with ETIMEDOUT
    - 보안그룹 개방 안해서 일시적으로 80/443 포트 열어둠
- Error: 마이그레이션이 됐으나, 엔티티/마이그레이션 경로가 맞지 않아서 migrations 테이블만 생성
    - `NODE_ENV`에 따라 구분해서 실행하려고 했으나, api 서버 실행하기 전에 마이그레이션을 진행하기 때문에 모드 구분 없이 {ts,js} 파일 형식만 & path를 이용하여 경로 위치 변경
    ```text
    entities: [join(__dirname, 'src/**/entity/*.entity.{ts,js}')],
    migrations: [join(__dirname, 'src/migrations/*.{ts,js}')],
    ```
