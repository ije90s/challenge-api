### TypeORM VS Mongoose
- Mongoose는 class-validator와 함께 쓸 수 있으나, TypeORM + DTO(with class-validator) 따로 분리

| 특징        | Mongoose (MongoDB ODM)        | TypeORM (SQL ORM)     |
| --------- | ----------------------------- | --------------------- |
| Model 구조  | Schema가 **데이터 정의 + 검증** 모두 담당 | Entity는 **DB 구조만 담당** |
| 스키마 변경 영향 | 비교적 유연                        | DB 마이그레이션 필요          |
| 설계 철학     | Document Schema 중심            | Domain Model 분리 중심    |
| 요청 검증     | Schema에서 가능                   | 보통 DTO에서 처리           |

➡ Mongo는 Schema가 애초에 JSON Validation 개념 포함

➡ SQL은 Schema 변경이 API 구조 변경과 직접 연결되면 위험 

| 위치              | 목적        | 권장 여부         |
| --------------- | --------- | ------------- |
| Entity          | DB 스키마 정의 | ✔             |
| DTO             | 요청 데이터 검증 | ⭐ 권장          |
| Entity + DTO 겸용 | 간단한 프로젝트만 | ⚠ 커지면 유지보수 힘듦 |

🚫 왜 엔티티 → DTO 상속이 비권장인가?

| 항목      | 엔티티(Entity) | DTO          |
| ------- | ----------- | ------------ |
| 역할      | DB 스키마 정의   | 요청/응답 데이터 검증 |
| 변경 시 영향 | DB 변경       | API 검증 로직 변경 |
| 안정성     | 자주 바뀌지 않음   | 변경이 빈번       |

➡️ DTO를 엔티티에 종속시키면 API 변경에 DB 스키마가 영향을 끌려가게 됩니다.

➡️ 유지보수에서 큰 문제를 야기합니다.

### dto 상속 처리

| 유틸               | 역할                  |
| ---------------- | ------------------- |
| PartialType      | 모든 필드를 optional로 변경 |
| PickType         | 특정 필드만 골라서 사용       |
| OmitType         | 특정 필드만 제외           |
| IntersectionType | 여러 DTO를 하나로 결합      |

updateDTO는 주로 ParticalType과 많이 사용하며, optional() 조건이 있기 때문에 함수의 파라미터에서 체크하기 보다는 비지니스 로직에서 실제로 값이 있을 때만 검증 수행 > 이미 CreateDTO에서 isNotEmpty()를 데코레이터를 추가하는 경우, 똑같이 updateDTO에서도 반영 or isNotEmpty() 데코레이터가 없는 경우에는 ? 붙어 명확하게 값 유무를 표시

```typescript
// 올바른 사용 
// IsNotEmpty(): 명확하게 조건 걸어서 체크
if (title) {
  const checkTitle = this.findByTitle(id, title);
  if (checkTitle) {
      throw new UnauthorizedException("중복된 제목입니다.");
  }
}

// IsOptional(): dto에 값 유무 표시 + 비지니스 로직에서 디폴트 값 설정
export class DTO {
  @IsString()
  @IsOptional()
  complete_date?: string;
}

// 비지니스 로직
dto.complete_date = dto.complete_date ?? participation.complete_date;

// 올바르지 사용 X 
findByTitle(id: number, title?: string){
  return this.challenges.find(challenge => challenge.challengeId !== id && challenge.title === title);
}

const checkTitle = this.findByTitle(id, title);
if (checkTitle) {
  throw new UnauthorizedException("중복된 제목입니다.");
}

```
### TDD 

| 테스트 종류            | 범위                | 검증 포인트                     | 작성 난이도 |
| ----------------- | ----------------- | -------------------------- | ------ |
| Unit (Service 중심) | 순수 비즈니스 로직        | 성공 & 실패 케이스                | ★★     |
| Unit (Controller) | Parameter/HTTP 매핑 | ValidationPipe 적용 시        | ★★★    |
| E2E               | 전체 흐름 (DB 포함)     | 인증, 권한, Request → Response | ★★★★   |

mock: Promise로 반환 => async/await 붙어서 처리

| 상황                     | findOne 반환 | 필요한 처리      |
| ---------------------- | ---------- | ----------- |
| 실제 코드(현재 구현)           | 동기 객체      | await 없어도 됨 |
| 테스트(mockResolvedValue) | Promise    | await 필요    |


✅ 성공 테스트에서 자주 사용하는 Mock 함수들

| 함수                       | 목적                  | 예시                        |
| ------------------------ | ------------------- | ------------------------- |
| `mockResolvedValue()`    | 비동기 함수(Mock) 반환값 설정, 타입 캐스팅 필요 | DB/Service return Promise |
| `mockReturnValue()`      | 동기 반환값 설정           | JWT sign 등                |
| `toHaveBeenCalledWith()` | 메서드 호출 여부 검증        | Service → Repository      |
| `toEqual()`              | 리턴 데이터 비교           | 결과 객체 검증                  |

❌ 실패 테스트에서 주로 사용하는 함수


| 상황             | Jest 함수                    | 예시                      |
| -------------- | -------------------------- | ----------------------- |
| 서비스가 예외 발생해야 함 | `rejects.toThrow()`        | UnauthorizedException 등 |
| 특정 메시지 검증      | `toThrow("error message")` | 커스텀 에러 메시지              |


```typescript
// 예시
describe('signIn', () => {
  it('성공 테스트', async () => {
    mockUserService.findOne.mockResolvedValue(mockUser);
    mockJwtService.sign.mockReturnValue('mock-token');

    const result = await service.signIn(dto);

    expect(mockUserService.findOne).toHaveBeenCalledWith(dto.email);
    expect(mockJwtService.sign).toHaveBeenCalled();
    expect(result).toEqual({ access_token: 'mock-token' });
  });

  it('실패: 비밀번호 인증 실패', async () => {
    mockUserService.findOne.mockResolvedValue(mockUser);
    
    await expect(service.signIn(wrongDto))
      .rejects.toThrow("비밀번호가 잘못되었습니다.");
  });
});
```
비지니스단에서 순수 로직만 체크하는 경우에는, 간단하게 테스팅하고, 레퍼지토리나 다른 모듈 DI를 한 경우에 mock을 이용하여 체크한다. 

mock 값 설정 시에 반복적으로 적어야 하는 경우, 초기에 beforeEach로 디폴트를 해준 다음에 그 값 그대로 사용하거나 아니면 다른 값으로 지정하는 경우에는 특정 테스트에서 mock을 재지정하여 사용한다.

### req 처리
형 변환
  - 에러명: "type must be a number conforming to the specified constraints" => class-validator
  - ValidationPipe => transform : true
  - DTO 필드에 @Type(() => Number) 타입 명시
자동 필드 삭제
  - ValidationPipe => whitelist : true
  - 왜? 보안 강화, 불필요한 데이터 무시, DTO에 정의된 데이터만 서비스 로직으로 전달됨, 실수로 이상한 값 들어오는 걸 방지
정의 안 된 필드 들어오면 에러 
  - ValidationPipe => forbidNonWhitelisted : true

미들웨어 위치

| 항목          | main.ts `app.use()` | AppModule 미들웨어             |
| ----------- | ------------------- | -------------------------- |
| 실행 위치       | Express 미들웨어        | NestJS 미들웨어                |
| Logger DI   | ❌ 불가                | ✔ 가능                       |
| Nest Logger | 직접 생성해야 함           | 자동으로 context와 함께 사용        |
| DI 서비스 사용   | ❌ 불가                | ✔ 가능 (DB, Config, Redis 등) |
| 라우트 선택 적용   | 불가 (전역만 가능)         | 가능 (`forRoutes`)           |
| 구조적 확장성     | 낮음                  | 매우 높음                      |
| Nest 컨텍스트   | 포함 안 됨              | 포함 됨                       |
| 실무 적합성      | 낮음                  | 매우 높음                      |


### TypeORM
셋팅 
- 관련 패키지 설치
- AppModule에 TypeModule import 처리 > DB 셋팅
- TypeOrmModule.forRoot(): TypeORM의 DataSource를 생성·등록해 주는 역할
  - 내부적으로 DataSource 객체를 생성 > initialize() 자동 호출 > NestJS DI 컨테이너에 DataSource 등록

| 개념                        | 의미                                   |
| ------------------------- | ------------------------------------ |
| `DataSource`              | TypeORM의 실제 DB 연결 객체                 |
| `TypeOrmModule.forRoot()` | **DataSource를 NestJS 방식으로 만들어주는 래퍼** |
| `@InjectRepository()`     | 해당 DataSource에서 Repository 꺼내 쓰는 것   |

DataSource
- DB 커넥션 관리
- 트랜잭션 관리
- Entity 메타데이터 보관
- Repository 생성
- QueryRunner 생성
- TypeOrmModule.forFeature(): 이미 존재하는 DataSource에서 특정 Entity의 Repository를 꺼내서 해당 Module의 DI 스코프에 등록
- DataSource >> EntityManager >> Repository
- DataSource 직접 쓰는 경우: 트랜잭션, ueryBuilder / Raw Query

| 구분            | 역할         | 언제 쓰나           |
| ------------- | ---------- | --------------- |
| DataSource    | 최상위 관리자    | 트랜잭션, Raw Query |
| EntityManager | 엔티티 범용 관리자 | 여러 엔티티 한 번에     |
| Repository    | 단일 엔티티 전용  | CRUD            |

```
AppModule 로딩
 ↓
TypeOrmModule.forRoot()
 ↓
DataSource initialize()
 ↓
Entity metadata 로딩
 ↓
Repository 준비 완료
 ↓
Service/Controller 실행 가능

```

Looger
  - logging: logger 레벨 지정(모두 다 허용이면, true)
  - logger: logger 스타일 
    
| logger             | 특징                 | 출력 스타일        |
| ------------------ | ------------------ | ------------- |
| `simple-console`   | 최소한의 정보만 출력        | 단순 문자열        |
| `advanced-console` | 컬러 + 포맷팅 + 구조화된 출력 | **예쁘고 보기 쉬움** |
| `file`             | 로그를 파일에 저장         | 파일 기반         |
| `debug`            | 매우 상세한 로그          | 개발용, verbose  |

### Data Mapper vs ActiveRecord
Data Mapper: DB에 직접 접근하지 않고, 가상의 Repository를 생성하여 접근 => 유지보수 용이 & 큰 규모 앱에 적합

ActiveRecord: 직접 DB에 접근하여 쿼리 조회, 커스텀 엔티티는 BaseEntity를 상속 => 작은 규모 앱에 적합
### 공통 엔티티
id, create_at, updated_at 등의 공통의 칼럼을 구성 => 커스텀 엔티티가 상속

BaseEntity는 CRUD만 제공할 뿐, 위의 공통의 칼럼은 따로 공통의 엔티티를 구성해야 한다.
```typescript
// Data Mapper
import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export abstract class CommonEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity()
export class User extends BaseEntity implements IUser {
  @Column()
  email: string;

  @Column()
  password: string;
}

//ActiveRecord 
@Entity()
export class User extends BaseEntity implements IUser {
  @Column()
  email: string;

  @Column()
  password: string;
}

@Entity()
export class User extends CommonEntity {
  @Column()
  email: string;

  @Column()
  password: string;
}
```

### 추상화로 선언하는 이유? 
직접 테이블이 생성되지 않도록 하기 위해
  - BaseEntity는 상속만 목적
  - 만약 abstract가 아니면 TypeORM이 BaseEntity 자체로도 테이블을 만들려고 시도함 → 불필요한 테이블 생성

재사용성을 높이기 위해
  - 여러 엔티티에 공통 컬럼 상속 가능
  - 각 엔티티별로 테이블은 따로 생성되지만, BaseEntity의 컬럼도 함께 포함됨
  - 코드 중복 제거 + 유지보수 용이

추상화 의미
  - BaseEntity 자체는 인스턴스를 만들 필요 없는 클래스
  - “이 클래스는 상속용이며, 구체적인 엔티티에서만 사용된다”는 의미를 코드로 표현
  - abstract 처리 → TS 컴파일러가 직접 생성 못하게 막음
```typescript
  // ❌ 잘못된 사용
  const base = new BaseEntity(); // 추상화 처리 안 하면 가능, 그러나 의미 없음
```
요약
| 포인트                | 이유                                  |
| ------------------ | ----------------------------------- |
| abstract           | BaseEntity 자체로 테이블 생성 방지            |
| 공통 컬럼 상속           | 코드 재사용 & 유지보수 용이                    |
| 인스턴스 직접 생성 방지      | 의미 없는 객체 생성 차단                      |
| TypeORM 테이블 동기화 안전 | BaseEntity는 DB에 매핑되지 않고 상속받은 컬럼만 포함 |

### interface vs type vs abstarct class
BaseEntity (abstract class) → 공통 컬럼 + DB 동기화

interface → 클래스 구조/type 강제 (implements)

type → DTO, 함수 파라미터, 유니온/인터섹션 타입 정의

| 구분    | interface                  | type                    | abstract class            |
| ----- | -------------------------- | ----------------------- | ------------------------- |
| 목적    | 객체의 **타입 구조** 정의, 다중 상속 가능 | 객체, 유니온, 튜플 등 **타입 별칭** | 공통 로직 + 컬럼 상속, 인스턴스 생성 불가 |
| 런타임   | 없음                         | 없음                      | 존재 (DB 컬럼 데코레이터 사용 가능)    |
| 상속/구현 | `implements`               | 불가(확장만)                 | `extends`                 |
| 장점    | 명확한 구조 강제                  | 복잡한 타입 정의 가능            | DB 컬럼 상속, 공통 메서드 포함       |
```typescript
// interface: 단순 타입 강제 용도, 클래스에서 implements IUser 사용 가능
interface IUser {
  email: string;
  password: string;
}

// type: DTO나 함수 파라미터 타입 정의에 자주 사용, 유니온, 인터섹션 타입 가능
type UserDTO = {
  email: string;
  password: string;
  age?: number; // optional
}
type AdminOrUser = UserDTO | AdminDTO;

// abstract class: DB 컬럼 포함, User, Post 등에서 상속 가능
export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity()
export class User extends BaseEntity implements IUser {
  @Column()
  email: string;

  @Column()
  password: string;
}
```
### TypeORM BaseEntity 
TypeORM BaseEntity 관점
- 객체지향에서의 부모 클래스(super class) 개념
- CRUD 메서드(save, remove, find, findOne 등)를 제공 → ActiveRecord용
- 인스턴스 생성 가능 (abstract 아님)
- 하지만 실무에서 BaseEntity 자체로 DB에 저장하거나 쓰는 일은 거의 없음

  ```typescript
  const base = new BaseEntity(); // 가능하지만 실무에서는 잘 안 함
  ```

실제 사용 패턴

- 자식 엔티티(User, Post 등)에서 상속
- 부모의 CRUD 메서드를 그대로 사용하거나, 필요하면 오버라이딩 가능
```typescript
@Entity()
export class User extends BaseEntity {
  @Column()
  email: string;

  @Column()
  password: string;
}

// 사용
const user = new User();
user.email = 'a@b.com';
user.password = '1234';
await user.save();   // BaseEntity의 save() 사용
```
- User 엔티티가 구체적인 테이블과 컬럼을 정의
- BaseEntity는 메서드만 제공 → 상속용 역할

핵심 포인트
| 개념         | 설명                                                  |
| ---------- | --------------------------------------------------- |
| BaseEntity | 부모 클래스, CRUD 메서드 제공, abstract 아님, 직접 사용 가능하지만 잘 안 함 |
| 자식 엔티티     | 구체적인 컬럼 정의 + DB 테이블 매핑, BaseEntity 메서드 상속 및 활용      |
| 인스턴스화      | BaseEntity 가능, 실무에서는 자식 엔티티 인스턴스 사용                 |


### findOne vs findOneBy
| 메서드         | 옵션 지원                                | 사용 예            | 특징           |
| ----------- | ------------------------------------ | --------------- | ------------ |
| `findOne`   | where + relations + select + order 등 | 복합 조건, 관계 로딩 가능 | 유연하지만 약간 무거움 |
| `findOneBy` | where 조건만                            | 단순 조회           | 가볍고 단순       |

### create() vs save() vs update()
역할

| 메서드        | 역할                                                            |
| ---------- | ------------------------------------------------------------- |
| `create()` | **엔티티 인스턴스 생성**: DB에 바로 저장하지 않고, 메모리상에서 TypeORM Entity 객체를 생성 |
| `save()`   | **DB에 저장**: `create()`로 만든 엔티티를 실제로 DB에 INSERT/UPDATE         |
| `update()`   |**DB 업데이트**: 단순 내용 수정이면, 속도가 빨라 이 방식으로 해도 되나, 안전하지 않아 트랜잭션/find → 검증 → assign → save with Partial Update  |

Data Mapper 패턴 준수
- Data Mapper 패턴에서는 엔티티와 DB 저장이 분리되어야 함
- create()는 엔티티 객체 생성, save()는 영속화(Persistence)
- 한 메서드에서 두 가지 역할을 섞으면 패턴 취지 훼손
  ```typescript
  // BAD
  await repository.save({ email, password }); // 엔티티 객체를 거치지 않고 바로 DB 저장
  ```
- 이렇게 하면 엔티티의 메서드나 getter/setter 등을 활용할 수 없음

엔티티 인스턴스 활용 가능
- DB에 저장하기 전 엔티티 내부 로직을 수행 가능
- 즉, 도메인 로직과 DB 로직 분리
  ```typescript
  const user = repository.create({ email, password });

  // 엔티티 메서드 호출 가능
  user.setPassword(password);
  user.generateToken();

  // DB에 저장
  await repository.save(user);
  ```

타입 안정성과 코드 가독성
- create() → TypeScript에서 Entity 타입 체크 가능
- save() → DB 반영
- save()만 쓰면 타입 추론이 애매해질 수 있음

### relations
- OnetoOne: 1:1
  - OneToOne이므로 UNIQUE 제약도 자동 생성
    ```text
      profile
      ├─ id
      ├─ user_id (UNIQUE + FK)
    ```
  - FK는 부가정보인 엔티티에 붙인다.

  | 항목         | OneToOne |
  | ---------- | -------- |
  | FK owner   | 반드시 필요   |
  | JoinColumn | ✅ 필수     |
  | 위치         | FK 둘 테이블 |
  | Unique     | 자동       |
- OnetoMany: 1:N <> ManytoOne: N:1
  - 양방향인 경우, JoinColumn을 하지 않아도 OnetoMany, ManytoOne으로 가능 (TypeORM이 FK 위치와 기본 컬럼명을 자동으로 추론하기 때문)
    ```text
    @JoinColumn()
    → { propertyName }_{ referencedColumnName }
    ```
  - 단반향인 경우, ManytoOne과 JoinColumn 명시
  - OnetoMany 엄격하게 관계 정의 안해도 됨 > 단순 ORM 편의용 관계
- OnetoMany 꼭 써야 하는 경우
  - user.photos 로 바로 접근하고 싶다
  - relations: ['photos'] 를 자주 쓴다
  - 코드 가독
  - cascade
- JoinColumn: FK. ManytoOne, OnetoOne 한쪽에 사용
- JoinColumn을 언제 사용하는가? 
  - FK 컬럼명 바꾸고 싶을 때
    ```typescript
      @ManyToOne(() => User)
      @JoinColumn({ name: 'author_id' })
      user: User;
    ```
  - 참조 컬럼이 id가 아닐 때 
    ```typescript
      @JoinColumn({ referencedColumnName: 'uuid' })
    ```
- ManytoMany: N:M > 중간 테이블 필수
  - JoinTable(): 붙는 쪽이 주인

| 상황              | where | relations | 결과           |
| --------------- | ----- | --------- | ------------ |
| ManyToOne (단방향) | ✅     | ❌         | FK 기준 필터만 > 빠른 조회 가능 |
| ManyToOne (단방향) | ✅     | ✅         | JOIN + 객체 로딩 |
| OneToMany만 존재   | ❌     | ❌         | 불가능          |
| 양방향             | ✅     | ✅         | 자유롭게 가능      |

```typescript
// OneToOne
// User
@OneToOne(() => Profile, (profile) => profile.user)
profile: Profile;

// Profile
@OneToOne(() => User, (user) => user.profile)
@JoinColumn({ name: 'owner_id' })
user: User;

// OneToMany, ManyToOne
// 타입을 지정할 경우에는 데코레이터의 To 다음의 단어로 지정
@ManyToOne(() => User, (user) => user.photos) // N
user: User

@OneToMany(() => Photo, (photo) => photo.user) // 1
photos: Photo[]

// ManyToMany
// JoinTable: 가상의 테이블을 만들고, User나 Role 둘 다 가질 수 있음
// User
@ManyToMany(() => Role)
@JoinTable()
roles: Role[];

// Role
@ManyToMany(() => User, (user) => user.roles)
users: User[];
```

### 물리삭제 vs 논리삭제
물리삭제
- 언제 쓰는가? 
  - 테스트 데이터
  - 로그
  - 복구 필요 없는 데이터
- 단점
  - 복구 불가
  - 연관 데이터 깨질 위험
  - 감사 로그 불가
```typescript
const result = await this.challengeRepo.delete({
  challenge_id: challengeId,
  author: userId,
});

if (result.affected === 0) {
  throw new ForbiddenException();
}
```

논리삭제
- 장점
  - 복구 가능
  - 감사 로그 가능
  - 연관 관계 안전
  - 조회 시에 자동 제외
```typescript
//엔티티 설정
@Entity()
export class Challenge {
  @PrimaryGeneratedColumn()
  challenge_id: number;

  @DeleteDateColumn()
  deleted_at?: Date;
}

//서비스단 처리
async delete(challengeId: number, userId: number) {
  const challenge = await this.challengeRepo.findOne({
    where: { challenge_id: challengeId },
  });

  if (!challenge) {
    throw new NotFoundException();
  }

  if (challenge.author !== userId) {
    throw new ForbiddenException();
  }

  await this.challengeRepo.softDelete(challengeId);
}

// 삭제 포함하여 조회
this.challengeRepo.find({
  withDeleted: true,
});

// 복구 했을 시에 unique값이 있는지를 유효검사해서 바로 업데이트 되지않도록 처리 & unique 인덱스(마이그레이션)
await this.challengeRepo.restore(challengeId);
```

### delete vs remove
| 메서드          | 특징                 |
| ------------ | ------------------ |
| delete()     | 쿼리 직접 실행           |
| remove()     | 엔티티 기반, 훅 실행       |
| softDelete() | deleted_at 업데이트    |
| softRemove() | 엔티티 기반 soft delete |

### QueryBuilder
- 복잡한 쿼리를 원하는 경우에는 사용 
```typescript
// 데이터가 적은 경우에는 find로 가능하지만, 데이터가 많아 지는 경우에는 쿼리빌더로 쿼리조회한다.
this.participationRepository
  .createQueryBuilder('p')
  .where('p.challenge_id = :challengeId', { challengeId })
  .orderBy(orderField, 'DESC')
  .addOrderBy('p.created_at', 'DESC')
  .getMany();
```

### 컨트롤러 테스트 파일에서 오류난다면? 
특정 모듈에서 TypeORM 모듈을 import되어져 있는 경우에 `TypeOrmModule.forFeature → DataSource 필요 → DB 연결 시도`하기 때문에 에러 발생 
```text
Is TypeOrmModule a valid NestJS module?
If DataSource is a provider, is it part of the current TypeOrmModule?
```
TDD에서는 외부 실행(ex> DB)을 배제하므로, mock으로 만들어서 처리

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

describe('FeedController', () => {
  let controller: FeedController;

  const mockFeedService = {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByTitle: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedController],
      providers: [
        {
          provide: FeedService,
          useValue: mockFeedService,
        },
      ],
    }).compile();

    controller = module.get<FeedController>(FeedController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
```

### jest.fn() vs jest.mock() vs jest.spyOn()
jest.fn()
- 함수가 많지 않은 경우, 각각 mock() 처리 

jest.mock()
- 이 서비스가 “직접 호출해서 side-effect를 만드는 대상”을 가짜로 만드는 것으로, 함수가 많은 경우에는 jest.fn() 대신 jest.mock()으로 선언해서 사용
- 역할: 서비스 ↔ DB
  - 실제 DB 접근 방지
  - side-effect 제어
  - 입력 → 출력 관계 검증
```typescript
mockChallengeRepository.findOneBy.mockResolvedValue(null);
mockChallengeRepository.save.mockResolvedValue(entity);
```

jest.spyOn()
- 이 서비스가 의존하는 다른 책임의 결과를 통제해서 현재 서비스의 책임만 검증하기 위한 도구
- 역할: 서비스 ↔ 서비스
  - 이 서비스가 의존하는 다른 서비스 책임
  - 구현은 관심 없음
  - 결과만 필요
```typescript
jest.spyOn(service, 'findByTitle').mockResolvedValue(null);
```

```text
[ Controller ]
      ↓
[ Service ]  ←── spyOn 대상 (다른 서비스 메서드)
      ↓
[ Repository ] ←── mock 대상 (DB side-effect)
      ↓
[ DB ]
```

참조: https://inpa.tistory.com/entry/JEST-%F0%9F%93%9A-%EB%AA%A8%ED%82%B9-mocking-jestfn-jestspyOn

### 관계 옵션값
이 옵션값들은 모두 FK쪽에서 어떻게 처리할 것인지를 결졍하는 옵션값
- eager: boolean(default: false) 연결된 관계를 자동으로 가져올 것인가?에 대한 옵션값
  - 관계가 많은 경우에는 쿼리 조회가 느려질 수 있음
- cascade: boolean | ("insert" | "update")[](default: false) 새 엔티티 객체가 추가되는 경우에 자동으로 추가/수정 등의 액션들을 연쇄적으로 처리할 것인가?에 대한 옵션값
- onDelete: "RESTRICT"|"CASCADE"|"SET NULL" (default: RESTRICT) 소유자가 삭제되는 경우에는 FK쪽도 삭제할 때, 어떻게 처리할 것인가?에 대한 옵션값
  - RESTRICT: 삭제되도 거부(데이터 값 그대로) 
  - CASCADE: 자동 삭제(데이터 많은 경우에는 처리가 느려질 수 있음)
  - SET NULL: NULL로 변경(데이터 무결점 원칙 유지)

### 응답값 가공
mogoose
- 스키마 내의 virtual()를 이용하여 노출하고 싶지 않은 데이터들을 제외시켜 전달
```typescript
  
  // 스키마 내에서 선언
  @Virtual({
    get: function (this: Cat) {
      return {
        id: this._id,
        email: this.email,
        name: this.name,
        imgUrl: this.imgUrl,
        comments: this.comments,
      }
    },
  })
  readonly readOnlyData: {id: string; email: string; name:string, imgUrl: string, comments: Comments[]};

  //스키마 변수를 이용한 선언
  CatSchema.virtual('comments', { //첫번째 필드값은 조인해서 쓰이는 칼럼명
    ref: 'Comments',     //컬렉션명
    localField: '_id',
    foreignField: 'info'
  });
  CatSchema.set('toObject', { virtuals: true});
  CatSchema.set('toJSON', {virtuals: true});
```

typeORM
- 응답 DTO를 이용하여 노출하고 싶지 않은 데이터들을 제외시켜 전달
- from(), of(), create(), fromEntity() 이렇게 사용

| 메소드          | 뉘앙스            |
| ------------ | -------------- |
| `from`       | **변환** (A → B) |
| `of`         | **구성/생성**      |
| `create`     | 생성 의도 명확       |
| `fromEntity` | 가장 명시적         |

```typescript
  export class ResponseUserDto {
    readonly id: number;
    readonly email: string;

    private constructor(entity: User) {
      this.id = entity.id;
      this.email = entity.email;
    }

    // 규칙 기반 변환(엔티티 > DTO)
    static from(user: User): ResponseUserDto {
      return new ResponseUserDto(user);
    }

    // 암묵적인 표준 규칙이 작성자의 주관에 따라 조합해서 전달
    // 결과: 이 값들로 응답 하나 만들어”
    // 입력 타입이 자유로움
    // Entity일 수도 있고 
    // 여러 값의 조합일 수도 있고
    // 계산 결과일 수도 있음
    // 메소드 내부를 봐야 알 수 있음
    static of(id: string, email: string){
      return { id, email };
    }
  }
```

```text
from   : 명확한 source → target 변환
of     : 여러 값의 조합 / 응답 전용 팩토리
create : 도메인 객체 생성 (DTO보단 Entity)

```