import { Test, TestingModule } from '@nestjs/testing';
import { ParticipationService } from './participation.service';
import { ChallengeService } from '../challenge/challenge.service';
import { checkThePast } from '../common/util';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Participation } from './entity/participation.entity';

// 올바른 mock 경로
jest.mock('../common/util', () => ({
  checkThePast: jest.fn(),
}));

describe('ParticipationService', () => {
  let service: ParticipationService;
  let result: any;
  let participations: Participation[];

  const mockChallengeService = {
    findOne: jest.fn(),
  }

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const today = new Date();

  const mockParticipationService = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParticipationService,
        { provide: ChallengeService, useValue: mockChallengeService },
        { provide: getRepositoryToken(Participation), useValue: mockParticipationService,},
      ],
    }).compile();

    service = module.get<ParticipationService>(ParticipationService);

    participations = [
      {
        id: 1,
        score: 1,
        challenge_count: 0,
        status: 0,
        challenge: { id: 1 } as any,
        user: { id: 1 } as any,
        created_at: today,
        updated_at: today,
      },
      {
        id: 2,
        score: 0,
        challenge_count: 0,
        status: 0,
        challenge: { id: 1 } as any,
        user: { id: 2 } as any,
        created_at: today,
        updated_at: today,
      },
    ];
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe("findOne", () => {
    it("한개 조회", async () => {
      mockParticipationService.findOne.mockResolvedValue(participations[0]);
      result = await service.findOne(1, 1);
      expect(mockParticipationService.findOne).toHaveBeenCalledWith({
          where: {
              challenge: { id: 1 },
              user: { id: 1 },
          },
      });
      expect(result).not.toBeNull();
    });

    it("없음", async () => {
      mockParticipationService.findOne.mockResolvedValue(null);
      result = await service.findOne(2, 1);
      expect(mockParticipationService.findOne).toHaveBeenLastCalledWith({
          where: {
              challenge: { id: 2 },
              user: { id: 1 },
          },
      });
      expect(result).toBeNull();
    });
  });

  describe("create", () => {

    const challenge = {
      challengeId: 1,
      type: 0, 
      mininum_count: 1,
      title: '테스트',
      content: '테스트',
      start_date: '2025-12-01',
      end_date: '2025-12-31'
    };

    beforeEach(() => {
      jest.clearAllMocks();                 
      mockChallengeService.findOne.mockResolvedValue(challenge);
      (checkThePast as jest.Mock).mockReturnValue(true);
    });

    it("참가 성공 - 값이 없는 경우", async () => {
      result = await service.create(1,4,{});

      expect(mockChallengeService.findOne).toHaveBeenCalledWith(1);
      expect(checkThePast).toHaveBeenCalledWith(challenge.end_date);

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

    it("챌린지가 존재하지 않은 경우", async () => {
      mockChallengeService.findOne.mockResolvedValue(null);

      await expect(service.create(4, 4, {}))
        .rejects.toThrow("챌린지가 존재하지 않습니다.");
    });

    it("기간이 지난 경우", async () => {
      (checkThePast as jest.Mock).mockReturnValue(false);

      await expect(service.create(1, 4, {}))
        .rejects.toThrow("기간이 지났습니다.");
    });

    it("이미 참가 중인 경우", async () => {
      await expect(service.create(1, 1, {}))
        .rejects.toThrow("이미 참가중입니다.");
    });
  });

  // // -----------------------------
  // // update
  // // -----------------------------
  // describe("update", () => {
  //   const challenge = {
  //     challengeId: 1,
  //     type: 0, 
  //     mininum_count: 1,
  //     title: '테스트',
  //     content: '테스트',
  //     start_date: '2025-12-01',
  //     end_date: '2025-12-31'
  //   };

  //   beforeEach(() => {
  //     mockChallengeService.findOne.mockResolvedValue(challenge);
  //     (checkThePast as jest.Mock).mockReturnValue(true);
  //   });

  //   it("기록 업데이트 성공 - 값이 없는 경우", async () => {
  //     result = await service.update(1, 1, {});

  //     const pickOne = result.filter(item => item.challenge_id === 1 && item.user_id === 1);
  //     expect(pickOne[0].score).toBe(0);
  //     expect(pickOne[0].challenge_count).toBe(0);
  //     expect(pickOne[0].status).toBe(0);

  //     expect(mockChallengeService.findOne).toHaveBeenCalledWith(1);
  //     expect(checkThePast).toHaveBeenCalledWith(challenge.end_date);
  //   });
    
  //   it("기록 업데이트 성공 - 값이 있는 경우", async () => {
  //     result = await service.update(1, 1, {score: 1});

  //     const pickOne = result.filter(item => item.challenge_id === 1 && item.user_id === 1);
  //     expect(pickOne[0].score).toBe(1);
  //   });

  //   it('참가하지 않은 경우', async () => {
  //     await expect(service.update(1, 4, {}))
  //       .rejects.toThrow("참가하지 않았습니다.");
  //   });

  //   it('챌린지 포기 상태', async () => {
  //     await expect(service.update(1, 3, {}))
  //       .rejects.toThrow("챌린지 포기 상태입니다.");
  //   });
  // });

  // // -----------------------------
  // // updateStatus
  // // -----------------------------
  // describe("updateStatus", () => {
  //   it("챌린지 포기 성공", async () => {
  //     result = await service.updateStatus(1,1);
  //     const pickOne = result.filter(item => item.challenge_id === 1 && item.user_id === 1);
  //     expect(pickOne[0].status).toBe(2);
  //   });

  //   it("챌린지 포기 취소", async () => {
  //     result = await service.updateStatus(1, 3);
  //     const pickOne = result.filter(item => item.challenge_id === 1 && item.user_id === 3);
  //     expect(pickOne[0].status).toBe(0);
  //   });

  //   it("참가하지 않은 경우", async () => {
  //     await expect(service.updateStatus(1, 4))
  //       .rejects.toThrow("참가하지 않았습니다.");
  //   });
  // });

  // // -----------------------------
  // // getChallengeRank
  // // -----------------------------
  // describe("getChallengeRank", () => {
  //   it("리스트 가져오기", async () => {
  //     result = await service.getChallengeRank(1, 1);
  //     expect(result.length).toBe(3);
  //   });

  //   it("참가하지 않은 경우", async () => {
  //     await expect(service.updateStatus(1, 4))
  //       .rejects.toThrow("참가하지 않았습니다.");
  //   });
  // });

  // // -----------------------------
  // // getMyChallenge
  // // -----------------------------
  // describe("getMyChallenge", () => {
  //   it("챌린지 참가한 경우", () => {
  //     result = service.getMyChallenge(1);
  //     expect(result).toBeDefined();
  //   });

  //   it("없는 경우", () => {
  //     result = service.getMyChallenge(4);
  //     expect(result).toBeUndefined();
  //   });
  // });

});
