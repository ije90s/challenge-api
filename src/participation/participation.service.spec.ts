import { Test, TestingModule } from '@nestjs/testing';
import { ParticipationService } from './participation.service';

describe('ParticipationService', () => {
  let service: ParticipationService;
  let result: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ParticipationService],
    }).compile();

    service = module.get<ParticipationService>(ParticipationService);

  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe("findOne", () => {
    it("한개 조회", () => {
      result = service.findOne(1,3);
      expect(result.participation_id).toBe(3);
    });

    it("없음", () => {
      result = service.findOne(1,4);
      expect(result).toBeUndefined();
    })
  });

  describe("create", () => {
    it("참가 성공 - 값이 없는 경우", async () => {
      result = await service.create(1,4,{});
      expect(result.participation_id).toBe(4);
      expect(result.status).toBe(0);
      expect(result.challenge_count).toBe(0);
      expect(result.score).toBe(0);
    });

    it("참가 성공 - 값이 있는 경우", async () => {
      result = await service.create(1,4,{score: 0, challenge_count: 0});
      expect(result.participation_id).toBe(4);
      expect(result.status).toBe(0);
    });

    it("이미 참가 중인 경우", async () => {
      expect(() => service.create(1, 1, {})).rejects.toThrow("이미 참가중입니다.");
    });
  });

  describe("update", () => {
    it("기록 업데이트 성공 - 값이 없는 경우, 그대로 유지", async() => {
      result = await service.update(1, 1, {});
      const pickOne = result.filter(item => item.challenge_id === 1 && item.user_id === 1);
      expect(pickOne[0].score).toBe(0);
      expect(pickOne[0].challenge_count).toBe(0);
      expect(pickOne[0].status).toBe(0);
    });
    
    it("기록 업데이트 성공 - 값이 있는 경우", async() => {
      result = await service.update(1, 1, {score: 1});
      const pickOne = result.filter(item => item.challenge_id === 1 && item.user_id === 1);
      expect(pickOne[0].score).toBe(1);
    });

    it('참가하지 않은 경우', async () => {
      await expect(() => service.update(1, 4, {})).rejects.toThrow("참가하지 않았습니다.");
    });

    it('챌린지 포기 상태', async () => {
      await expect(() => service.update(1, 3, {})).rejects.toThrow("챌린지 포기 상태입니다.");
    });
  });

  describe("updateStatus", () => {
    it("챌린지 포기 성공", async () => {
      result = await service.updateStatus(1,1);
      const pickOne = result.filter(item => item.challenge_id === 1 && item.user_id === 1);
      expect(pickOne[0].status).toBe(2);
    });

    it("챌린지 포기 취소", async () => {
      result = await service.updateStatus(1, 3);
      const pickOne = result.filter(item => item.challenge_id === 1 && item.user_id === 3);
      expect(pickOne[0].status).toBe(0);
    });

    it("참가하지 않은 경우", async () => {
      await expect(() => service.updateStatus(1, 4)).rejects.toThrow("참가하지 않았습니다.");
    });
  });

  describe("getChallengeRank", () => {
    it("리스트 가져오기", async () => {
      result = await service.getChallengeRank(1, 1);
      expect(result.length).toBe(3);
    });

    it("참가하지 않은 경우", async () => {
      await expect(() => service.updateStatus(1, 4)).rejects.toThrow("참가하지 않았습니다.");
    });
  });

  describe("getMyChallenge", () => {
    it("챌린지 참가한 경우", () => {
      result = service.getMyChallenge(1);
      expect(result).toBeDefined();
    });

    it("없는 경우", () => {
      result = service.getMyChallenge(4);
      expect(result).toBeUndefined();
    });
  })
});
