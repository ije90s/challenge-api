import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from '../src/common/filter/http.exception.filter';
import { ResponseInterceptor } from '../src/common/interceptor/response.interceptor';
import { TransactionalTestDataSource } from './utils/transactional-data-source';

// 이미 DB에 존재하는 것으로 가정하는 로그인 전용 계정 (읽기 전용으로만 사용 — 이 계정을 생성/수정하는 테스트는 없음)
const SEED_USER = { email: 'test@gmail.com', password: '1234' };

let uniqueSeq = 0;
const unique = (prefix: string): string => `${prefix}${Date.now()}${uniqueSeq++}`;

// "기간이 지났습니다" 취급되지 않도록 항상 미래인 날짜 범위를 만든다
const futureRange = (): { start_date: string; end_date: string } => {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
};

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let db: TransactionalTestDataSource;

  // 매 테스트가 독립된 트랜잭션에서 시작해서 끝나면 롤백되므로, 서로 다른 it() 사이에 생성한 데이터가
  // 넘어가지 않는다 — 각 it()이 필요한 fixture(로그인, 챌린지 등)를 스스로(또는 자신의 beforeEach에서) 만든다.
  beforeAll(async () => {
    db = new TransactionalTestDataSource();
    await db.initialize();
    await db.beginTransaction();

    const moduleFixture: TestingModule = await db
      .overrideIn(Test.createTestingModule({ imports: [AppModule] }))
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }));
    app.useGlobalFilters(new HttpExceptionFilter);
    app.useGlobalInterceptors(new ResponseInterceptor);
    await app.init();

    await db.rollbackTransaction();
  });

  beforeEach(async () => {
    await db.beginTransaction();
  });

  afterEach(async () => {
    await db.rollbackTransaction();
  });

  // multer가 실제로 디스크에 쓴 업로드 파일 목록 — DB 롤백으로는 지워지지 않으므로 afterAll에서 직접 정리한다.
  const uploadedImagePaths: string[] = [];

  afterAll(async () => {
    for (const imagePath of uploadedImagePaths) {
      try {
        fs.unlinkSync(path.join(__dirname, '..', 'src', 'uploads', imagePath));
      } catch {
        // 이미 없으면 무시 (best-effort 정리)
      }
    }

    await app.close();
    await db.destroy();
  });

  const login = async (email: string, password: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/user/login')
      .send({ email, password })
      .expect(201);
    return res.body.data.access_token;
  };

  const createChallenge = async (accessToken: string) => {
    const { start_date, end_date } = futureRange();
    const res = await request(app.getHttpServer())
      .post('/challenge')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 0,
        mininum_count: 1,
        title: unique('챌린지'),
        content: '테스트',
        start_date,
        end_date,
      })
      .expect(201);
    return res.body.data as { id: number; title: string };
  };

  const joinNewChallenge = async (accessToken: string): Promise<number> => {
    const challenge = await createChallenge(accessToken);
    await request(app.getHttpServer())
      .post(`/participation/challenge/${challenge.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ challenge_id: challenge.id })
      .expect(201);
    return challenge.id;
  };

  const createFeed = async (accessToken: string, challengeId: number): Promise<number> => {
    const res = await request(app.getHttpServer())
      .post('/feed')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('challenge_id', challengeId.toString())
      .field('title', unique('피드'))
      .field('content', '테스트')
      .attach('images', Buffer.from('test'), { filename: 'test.png', contentType: 'image/png' })
      .expect(201);
    uploadedImagePaths.push(...(res.body.data.images ?? []));
    return res.body.data.id;
  };

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({"success":true,"data":"Hello World!"});
  });

  describe('User', () => {
    describe("회원가입", () => {
      it('회원가입 성공/중복', async () => {
        const email = `${unique('signup')}@test.com`;

        await request(app.getHttpServer())
        .post('/user')
        .send({
          email,
          password: '1234',
        })
        .expect(201)
        .expect(res => {
          expect(res.body.data.email).toBe(email);
        });

        return request(app.getHttpServer())
        .post('/user')
        .send({
          email,
          password: '1234',
        })
        .expect(409);
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
          email: `${unique('none')}@gmail.com`,
          password: "1234"
        })
        .expect(401)
      });

      it("로그인 실패 - 비밀번호 불일치", () => {
        return request(app.getHttpServer())
        .post("/user/login")
        .send({
          email: SEED_USER.email,
          password: "wrong-password"
        })
        .expect((res) => {
          expect(res.body.message).toBe("비밀번호가 잘못되었습니다.")
        })
      });

      it("로그인 성공", () => {
        return request(app.getHttpServer())
        .post("/user/login")
        .send(SEED_USER)
        .expect(201)
      });
    });

    describe("내 정보 조회", () => {
      let accessToken: string;

      beforeEach(async () => {
        accessToken = await login(SEED_USER.email, SEED_USER.password);
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
          expect(res.body.data).toEqual({ id: expect.any(Number), email: SEED_USER.email });
        })
      })
    });

  });

  describe('Challenge', () => {
    let accessToken: string;

    beforeEach(async () => {
      accessToken = await login(SEED_USER.email, SEED_USER.password);
    });

    describe("챌린지 생성", () => {
      it("챌린지 생성 성공/중복", async () => {
        const { start_date, end_date } = futureRange();
        const payload = {
          type: 0,
          mininum_count: 1,
          title: unique('챌린지'),
          content: "테스트",
          start_date,
          end_date,
        };

        await request(app.getHttpServer())
          .post("/challenge")
          .set('Authorization', `Bearer ${accessToken}`)
          .send(payload)
          .expect(201)
          .expect(res => {
            expect(res.body.data.title).toBe(payload.title);
            expect(res.body.data.author_id).toBeDefined();
          });

        return request(app.getHttpServer())
          .post("/challenge")
          .set('Authorization', `Bearer ${accessToken}`)
          .send(payload)
          .expect(409)
      });

      it("파라미터 타입 확인", () => {
        const { start_date, end_date } = futureRange();
        return request(app.getHttpServer())
          .post("/challenge")
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            type: "ㅇㅇㅇ",
            mininum_count: 1,
            title: unique('챌린지'),
            content: "테스트",
            start_date,
            end_date,
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
      let challengeId: number;

      beforeEach(async () => {
        challengeId = (await createChallenge(accessToken)).id;
      });

      it("챌린지 수정 성공", () => {
        const newTitle = unique('수정됨');

        return request(app.getHttpServer())
        .patch(`/challenge/${challengeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: newTitle
        })
        .expect(200)
        .expect(res => {
          expect(res.body.data.title).toBe(newTitle)
          expect(res.body.data.id).toBe(challengeId)
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
      let challengeId: number;

      beforeEach(async () => {
        challengeId = (await createChallenge(accessToken)).id;
      });

      it("챌린지 조회 성공", () => {
        return request(app.getHttpServer())
        .get(`/challenge/${challengeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.data.id).toBe(challengeId)
        })
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
      let challengeId: number;

      beforeEach(async () => {
        challengeId = (await createChallenge(accessToken)).id;
      });

      it("삭제 성공", () => {
        return request(app.getHttpServer())
        .delete(`/challenge/${challengeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
      });

      it("Param이 숫자가 아닌 경우", () => {
        return request(app.getHttpServer())
        .delete("/challenge/ff")
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      })
    });
  });

  describe('Participation', () => {
    const baseUrl: string = '/participation/challenge';
    let accessToken: string;

    beforeEach(async () => {
      accessToken = await login(SEED_USER.email, SEED_USER.password);
    });

    describe("챌린지 참가", () => {
      let challengeId: number;

      beforeEach(async () => {
        challengeId = (await createChallenge(accessToken)).id;
      });

      it("참가 성공/중복", async () => {
        await request(app.getHttpServer())
        .post(`${baseUrl}/${challengeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          challenge_id: challengeId,
        })
        .expect(201)
        .expect(res => {
          expect(res.body.data.status).toBe(0);
        });

        return request(app.getHttpServer())
        .post(`${baseUrl}/${challengeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          challenge_id: challengeId,
        })
        .expect(409)
      });

      it("동시에 두 번 참가 요청을 보내도 한 건만 성공한다 (중복 참가 레이스)", async () => {
        const responses = await Promise.all([
          request(app.getHttpServer())
            .post(`${baseUrl}/${challengeId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ challenge_id: challengeId }),
          request(app.getHttpServer())
            .post(`${baseUrl}/${challengeId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ challenge_id: challengeId }),
        ]);

        const statuses = responses.map(res => res.status).sort();
        expect(statuses).toEqual([201, 409]);
      });

      it("잘못된 토큰인 경우", () => {
        return request(app.getHttpServer())
        .post(`${baseUrl}/${challengeId}`)
        .set('Authorization', `Bearer invalid_token`)
        .send({
          challenge_id: challengeId,
        })
        .expect(401)
      });

      it("타입이 잘못된 경우", () => {
        return request(app.getHttpServer())
        .post(`${baseUrl}/ff`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      });
    });

    describe("챌린지 수정", () => {
      let challengeId: number;

      beforeEach(async () => {
        challengeId = await joinNewChallenge(accessToken);
      });

      it("수정 성공", () => {
        return request(app.getHttpServer())
        .patch(`${baseUrl}/${challengeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          score: 1
        })
        .expect(200)
        .expect(res => {
          expect(res.body.data.score).toBe(1)
          expect(res.body.data.complete_date).not.toBeNull();
        })
      });

      it("타입이 잘못된 경우", () => {
        return request(app.getHttpServer())
        .patch(`${baseUrl}/ff`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          score: 1
        })
        .expect(400)
      });

      it("score가 음수인 경우", () => {
        return request(app.getHttpServer())
        .patch(`${baseUrl}/${challengeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          score: -1
        })
        .expect(400)
      });

      it("challenge_count가 음수인 경우", () => {
        return request(app.getHttpServer())
        .patch(`${baseUrl}/${challengeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          challenge_count: -1
        })
        .expect(400)
      });
    });

    describe("챌린지 포기", () => {
      let challengeId: number;

      beforeEach(async () => {
        challengeId = await joinNewChallenge(accessToken);
      });

      it("변경 성공", () => {
        return request(app.getHttpServer())
        .get(`${baseUrl}/${challengeId}/giveup`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.data.status).toBe(2);
        });
      });

      it("타입이 잘못된 경우", () => {
        return request(app.getHttpServer())
        .get(`${baseUrl}//giveup`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
      });
    });

    describe("챌린지 랭킹", () => {
      let challengeId: number;

      beforeEach(async () => {
        challengeId = await joinNewChallenge(accessToken);
      });

      it("조회 성공", () => {
        return request(app.getHttpServer())
        .get(`${baseUrl}/${challengeId}/rank`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.data.items).toBeTruthy();
        })
      });

      it("challengeID가 없는 경우", () => {
        return request(app.getHttpServer())
        .get(`${baseUrl}//rank`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
      });

      it("challengeID 타입이 잘못된 경우", () => {
        return request(app.getHttpServer())
        .get(`${baseUrl}/ff/rank/`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      });

      it("쿼리 스트링 타입이 잘못된 경우", () => {
        return request(app.getHttpServer())
        .get(`${baseUrl}/${challengeId}/rank/?page=1&limit=ff`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      })
    });

    describe("내 순위 조회", () => {
      it("조회 성공", async () => {
        const challengeId = await joinNewChallenge(accessToken);
        return request(app.getHttpServer())
        .get(`${baseUrl}/${challengeId}/rank/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.data.myRank).toBe(1);
        })
      });

      it("참가하지 않은 경우", async () => {
        const challenge = await createChallenge(accessToken);
        return request(app.getHttpServer())
        .get(`${baseUrl}/${challenge.id}/rank/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403)
      });

      it("challengeID 타입이 잘못된 경우", () => {
        return request(app.getHttpServer())
        .get(`${baseUrl}/ff/rank/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      });
    });

    describe("내 챌린지 조회", () => {
      beforeEach(async () => {
        await joinNewChallenge(accessToken);
      });

      it("조회 성공", () => {
        return request(app.getHttpServer())
        .get(`${baseUrl}/mine`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.data.items).toBeTruthy();
        })
      });

      it("쿼리 스트링 타입이 잘못된 경우", () => {
        return request(app.getHttpServer())
        .get(`${baseUrl}/mine?page=ff&limit=10`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      });
    });
  });

  describe('Feed', () => {
    const baseUrl: string = '/feed';
    let accessToken: string;
    let challengeId: number;

    beforeEach(async () => {
      accessToken = await login(SEED_USER.email, SEED_USER.password);
      challengeId = (await createChallenge(accessToken)).id;
    });

    describe("피드 생성", () => {
      it("피드 생성 성공/중복", async () => {
        const title = unique('피드');
        const attachAndSend = () =>
          request(app.getHttpServer())
          .post(baseUrl)
          .set('Authorization', `Bearer ${accessToken}`)
          .field('challenge_id', challengeId.toString())
          .field('title', title)
          .field('content', '테스트')
          .attach(
            'images',
            Buffer.from('test'),
            { filename: 'test.png', contentType: 'image/png' }
          );

        await attachAndSend()
          .expect(201)
          .expect(res => {
            expect(res.body.data.title).toBe(title)
            expect(res.body.data.images).toBeInstanceOf(Array)
            uploadedImagePaths.push(...(res.body.data.images ?? []));
          });

        return attachAndSend().expect(409);
      });

      it("DTO가 없는 경우", () => {
        return request(app.getHttpServer())
        .post(baseUrl)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      });

      it("이미지 파일이 아닌 경우", () => {
        return request(app.getHttpServer())
        .post(baseUrl)
        .set('Authorization', `Bearer ${accessToken}`)
        .field('challenge_id', challengeId.toString())
        .field('title', unique('피드'))
        .field('content', '테스트')
        .attach('images', Buffer.from('test'), { filename: 'test.txt', contentType: 'txt' })
        .attach('images', Buffer.from('test2'), { filename: 'test.png', contentType: 'image/png' })
        .expect(400)
      });

      it("파일 개수 넘는 경우", () => {
        return request(app.getHttpServer())
        .post(baseUrl)
        .set('Authorization', `Bearer ${accessToken}`)
        .field('challenge_id', challengeId.toString())
        .field('title', unique('피드'))
        .field('content', '테스트')
        .attach('images', Buffer.from('1'), { filename: '1.png' })
        .attach('images', Buffer.from('2'), { filename: '2.png' })
        .attach('images', Buffer.from('3'), { filename: '3.png' })
        .attach('images', Buffer.from('4'), { filename: '4.png' })
        .expect(400)
      });
    });

    describe("피드 수정", () => {
      let feedId: number;

      beforeEach(async () => {
        feedId = await createFeed(accessToken, challengeId);
      });

      it("수정 성공", () => {
        const newTitle = unique('수정됨');

        return request(app.getHttpServer())
        .patch(`${baseUrl}/${feedId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .field('title', newTitle)
        .field('content', '테스트-수정')
        .expect(200)
        .expect(res => {
          expect(res.body.data.title).toBe(newTitle);
        })
      });

      it("피드 ID가 없는 경우", () => {
        return request(app.getHttpServer())
        .patch(`${baseUrl}/`)
        .set('Authorization', `Bearer ${accessToken}`)
        .field('title', '테스트2')
        .field('content', '테스트2')
        .expect(404)
      });

      it("피드 ID가 스트링인 경우", () => {
        return request(app.getHttpServer())
        .patch(`${baseUrl}/ff`)
        .set('Authorization', `Bearer ${accessToken}`)
        .field('title', '테스트2')
        .field('content', '테스트2')
        .expect(400)
      });

      it("DTO가 없는 경우", () => {
        return request(app.getHttpServer())
        .patch(`${baseUrl}/${feedId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      });

      it("DTO에 명시된 파라미터가 아닌 게 있는 경우", () => {
        return request(app.getHttpServer())
        .patch(`${baseUrl}/${feedId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .field("title", '테스트2')
        .field("content", '테스트2')
        .field("ff", 'ff')
        .expect(400)
      });

    });

    describe("전체 피드 리스트 가져오기", () => {
      beforeEach(async () => {
        await createFeed(accessToken, challengeId);
      });

      it("조회 성공", () => {
        return request(app.getHttpServer())
        .get(`${baseUrl}/challenge/${challengeId}/feeds`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.data.items.length).toBeGreaterThan(0);
        })
      });

      it("challengeID가 없는 경우", () => {
        return request(app.getHttpServer())
        .get(`${baseUrl}/challenge//feeds`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
      });

      it("challengeID가 스트링인 경우", () => {
        return request(app.getHttpServer())
        .get(`${baseUrl}/challenge/ff/feeds`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      })
    });

    describe("피드 상세 조회", () => {
      let feedId: number;

      beforeEach(async () => {
        feedId = await createFeed(accessToken, challengeId);
      });

      it("조회 성공", () => {
        return request(app.getHttpServer())
        .get(`${baseUrl}/${feedId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.data.id).toBe(feedId);
        })
      });

      it("feedID가 없는 경우", () => {
        return request(app.getHttpServer())
        .get(`${baseUrl}/`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
      });

      it("feedID가 숫자가 아닌 경우", () => {
        return request(app.getHttpServer())
        .get(`${baseUrl}/ff`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      });
    });

    describe("피드 삭제", () => {
      let feedId: number;

      beforeEach(async () => {
        feedId = await createFeed(accessToken, challengeId);
      });

      it("삭제 성공", () => {
        return request(app.getHttpServer())
        .delete(`${baseUrl}/${feedId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
      });

      it("FeedID가 없는 경우", () => {
        return request(app.getHttpServer())
        .delete(`${baseUrl}/`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
      });

      it("FeedID가 스트링인 경우", () => {
        return request(app.getHttpServer())
        .delete(`${baseUrl}/ff`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400)
      });
    })
  });

});
