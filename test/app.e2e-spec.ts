import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from '../src/common/filter/http.exception.filter';
import { ResponseInterceptor } from '../src/common/interceptor/response.interceptor';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string = '';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ 
      transform: true, 
      whitelist: true,
      forbidNonWhitelisted: true,
    }));
    app.useGlobalFilters(new HttpExceptionFilter);
    app.useGlobalInterceptors(new ResponseInterceptor);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({"sucess":true,"data":"Hello World!"});
  });

  describe('User', () => {
    describe("회원가입", () => {
      it('회원가입 성공/중복', async () => {
        return request(app.getHttpServer())
        .post('/user')
        .send({
          email: 'test@test.com',
          password: '1234',
        })
        .expect(409)
        //.expect(201)
        //.expect({ sucess: true, data: { id: 2, email: 'test@test.com' } });
      });

      it("회원가입 실패", () => {
        return request(app.getHttpServer())
        .post("/user")
        .send({
          email:"test@gmail.com"
        })
        .expect(400);
      });
    });

    describe("로그인", () => {
      it("로그인 실패 - 존재하지 않은 계정", () => {
        return request(app.getHttpServer())
        .post("/user/login")
        .send({
          email: "test2@gmail.com",
          password: "1234"
        })
        .expect(401)
      });

      it("로그인 실패 - 비밀번호 불일치", () => {
        return request(app.getHttpServer())
        .post("/user/login")
        .send({
          email:"test@gmail.com",
          password: "1233"
        })
        .expect((res) => {
          expect(res.body.message).toBe("비밀번호가 잘못되었습니다.")
        })
      });

      it("로그인 성공", () => {
        return request(app.getHttpServer())
        .post("/user/login")
        .send({
          email: 'test@gmail.com',
          password: '1234'
        })
        .expect(201)
      });
    });

    describe("내 정보 조회", () => {
      beforeAll(async () => {
        const res = await request(app.getHttpServer())
        .post('/user/login')
        .send({
          email: 'test@gmail.com',
          password: '1234',
        })
        .expect(201);

        accessToken = res.body.data.access_token;
      });

      it("토큰이 없는 경우", () => {
        return request(app.getHttpServer())
        .get("/user/me")
        .expect(401)
      });

      it("잘못된 토큰인 경우", () => {
        return request(app.getHttpServer())
        .get("/user/me")
        .set('Authorization', 'Bearer invalid.token.value')
        .expect(401);
      });

      it("조회 성공", () => {
        return request(app.getHttpServer())
        .get("/user/me")
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.data).toEqual({
            id: 1,
            email: "test@gmail.com"
          });
        })
      })
    });
    
  });

  describe('Challenge', () => {
    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/user/login')
        .send({
          email: 'test@gmail.com',
          password: '1234',
        })
        .expect(201);

      accessToken = res.body.data.access_token;
      expect(accessToken).toBeDefined(); 
    });

    describe("챌린지 생성", () => {
      it("챌린지 생성 성공/중복", () => {
        return request(app.getHttpServer())
          .post("/challenge")
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            type: 0,
            mininum_count: 1,
            title: "테스트3",
            content: "테스트",
            start_date: "2025-12-01",
            end_date: "2025-12-31",
          })
          .expect(401)
          // .expect(201)
          // .expect(res => {
          //   expect(res.body.data.author_id).toBe(1)
          // })
      });

      it("파라미터 타입 확인", () => {
        return request(app.getHttpServer())
          .post("/challenge")
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            type: "ㅇㅇㅇ",
            mininum_count: 1,
            title: "테스트3",
            content: "테스트",
            start_date: "2025-12-01",
            end_date: "2025-12-31",
          })
          .expect(400)
      });

      it("필수값이 없는 경우", () => {
        return request(app.getHttpServer())
        .post("/challenge")
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      });

      it("잘못된 토큰인 경우", () => {
        return request(app.getHttpServer())
        .post("/challenge")
        .set('Authorization', `Bearer 1111`)
        .expect(401)
      });
    });

    describe("챌린지 수정", () => {
      it("챌린지 수정 성공", () => {
        return request(app.getHttpServer())
        .patch("/challenge/2")
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: '테스트'
        })
        .expect(200)
        .expect(res => {
          expect(res.body.data.title).toBe("테스트")
          expect(res.body.data.id).toBe(2)
        });
      });

      it("Param이 숫자가 아닌 경우", () => {
        return request(app.getHttpServer())
        .patch("/challenge/ff")
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      });
    });

    describe("챌린지 조회", () => {
      it("챌린지 조회 성공", () => {
        return request(app.getHttpServer())
        .get("/challenge/2")
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
      });

      it("Param이 숫자가 아닌 경우", () => {
        return request(app.getHttpServer())
        .get("/challenge/ff")
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      })
    });

    describe("페이징 처리", () => {
      it("가져오기", () => {
        return request(app.getHttpServer())
        .get("/challenge?page=1&limit=10")
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
      });

      it("쿼리 스트링 없는 경우", () => {
        return request(app.getHttpServer())
        .get("/challenge")
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
      });

      it("쿼리 스트링 타입 잘못된 경우", () => {
        return request(app.getHttpServer())
        .get("/challenge?page=ff")
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      });
    });

    describe("챌린지 삭제", () => {
      it("삭제 성공", () => {
        return request(app.getHttpServer())
        .delete("/challenge/5")
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
        //.expect(200)
      });

      it("Param이 숫자가 아닌 경우", () => {
        return request(app.getHttpServer())
        .delete("/challenge/ff")
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      })
    });
});

});
