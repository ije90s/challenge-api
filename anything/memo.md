- TypeORM VS Mongoose: Mongoose는 class-validator와 함께 쓸 수 있으나, TypeORM + DTO(with class-validator) 따로 분리

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

- dto 상속 처리

| 유틸               | 역할                  |
| ---------------- | ------------------- |
| PartialType      | 모든 필드를 optional로 변경 |
| PickType         | 특정 필드만 골라서 사용       |
| OmitType         | 특정 필드만 제외           |
| IntersectionType | 여러 DTO를 하나로 결합      |

updateDTO는 주로 ParticalType과 많이 사용하며, optional() 조건이 있기 때문에 함수의 파라미터에서 체크하기 보다는 비지니스 로직에서 실제로 값이 있을 때만 검증 수행 > 이미 CreateDTO에서 isNotEmpty()를 데코레이터를 추가하는 경우, 똑같이 updateDTO에서도 반영 or isNotEmpty() 데코레이터가 없는 경우에는 ? 붙어 명확하게 값 유무를 표시

```javascript
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

- TDD 

| 테스트 종류            | 범위                | 검증 포인트                     | 작성 난이도 |
| ----------------- | ----------------- | -------------------------- | ------ |
| Unit (Service 중심) | 순수 비즈니스 로직        | 성공 & 실패 케이스                | ★★     |
| Unit (Controller) | Parameter/HTTP 매핑 | ValidationPipe 적용 시        | ★★★    |
| E2E               | 전체 흐름 (DB 포함)     | 인증, 권한, Request → Response | ★★★★   |

- mock: Promise로 반환 => async/await 붙어서 처리

| 상황                     | findOne 반환 | 필요한 처리      |
| ---------------------- | ---------- | ----------- |
| 실제 코드(현재 구현)           | 동기 객체      | await 없어도 됨 |
| 테스트(mockResolvedValue) | Promise    | await 필요    |


✅ 성공 테스트에서 자주 사용하는 Mock 함수들

| 함수                       | 목적                  | 예시                        |
| ------------------------ | ------------------- | ------------------------- |
| `mockResolvedValue()`    | 비동기 함수(Mock) 반환값 설정 | DB/Service return Promise |
| `mockReturnValue()`      | 동기 반환값 설정           | JWT sign 등                |
| `toHaveBeenCalledWith()` | 메서드 호출 여부 검증        | Service → Repository      |
| `toEqual()`              | 리턴 데이터 비교           | 결과 객체 검증                  |

❌ 실패 테스트에서 주로 사용하는 함수


| 상황             | Jest 함수                    | 예시                      |
| -------------- | -------------------------- | ----------------------- |
| 서비스가 예외 발생해야 함 | `rejects.toThrow()`        | UnauthorizedException 등 |
| 특정 메시지 검증      | `toThrow("error message")` | 커스텀 에러 메시지              |


```javascript
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

- 비지니스단에서 순수 로직만 체크하는 경우에는, 간단하게 테스팅하고, 레퍼지토리나 다른 모듈 DI를 한 경우에 mock을 이용하여 체크한다. 
- mock 값 설정 시에 반복적으로 적어야 하는 경우, 초기에 beforeEach로 셋팅을 해준 다음에 각각의 테스트에서 재 설정 처리한다. 

- req 처리
  - 형 변환
    - 에러명: "type must be a number conforming to the specified constraints" => class-validator
    - ValidationPipe => transform : true
    - DTO 필드에 @Type(() => Number) 타입 명시
  - 자동 필드 삭제
    - ValidationPipe => whitelist : true
    - 왜? 보안 강화, 불필요한 데이터 무시, DTO에 정의된 데이터만 서비스 로직으로 전달됨, 실수로 이상한 값 들어오는 걸 방지
  - 정의 안 된 필드 들어오면 에러 
    - ValidationPipe => forbidNonWhitelisted : true
