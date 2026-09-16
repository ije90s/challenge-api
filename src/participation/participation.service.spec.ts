import { Test, TestingModule } from '@nestjs/testing';
import { ParticipationService } from './participation.service';
import { ChallengeService } from '../challenge/challenge.service';
import { checkThePast } from '../common/util';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Participation } from './entity/participation.entity';
import { UpdateParticipationDto } from './dto/update-participation.dto';
import { ResponseParticipationDto } from './dto/response-participation.dto';
import { ResponsePagingDto } from '../common/dto/response-paging.dto';
import { QueryFailedError } from 'typeorm';

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
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getCount: jest.fn(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
  };

  const today = new Date();

  const mockParticipationService = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    increment: jest.fn(),
    findOneByOrFail: jest.fn(),
    update: jest.fn(),
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
        complete_date: null,
        deleted_at: null,
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
        complete_date: null,
        deleted_at: null,
      },
      {
        id: 3,
        score: 0,
        challenge_count: 0,
        status: 2,
        challenge: { id: 1 } as any,
        user: { id: 4 } as any,
        created_at: today,
        updated_at: today,
        complete_date: null,
        deleted_at: null,
      },
      {
        id: 4,
        score: 1,
        challenge_count: 0,
        status: 1,
        challenge: { id: 1 } as any,
        user: { id: 5 } as any,
        created_at: today,
        updated_at: today,
        complete_date: new Date(),
        deleted_at: null,
      }
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
      expect(mockParticipationService.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          challenge: { id: 1 },
          user: { id: 1 },
        },
        relations: ['challenge', 'user'],
      }));
      expect(result).not.toBeNull();
    });

    it("없음", async () => {
      mockParticipationService.findOne.mockResolvedValue(null);
      result = await service.findOne(2, 1);
      expect(mockParticipationService.findOne).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("create", () => {

    const challenge = {
      challenge_id: 1,
      type: 0, 
      mininum_count: 1,
      title: '테스트',
      content: '테스트',
      start_date: '2025-12-01',
      end_date: '2025-12-31',
      author: {id: 1} as any, 
      created_at: today,
      updated_at: today,
      deleted_at: null,
    };

    let participation: Object;
    
    beforeEach(() => {
      jest.clearAllMocks();                 
      jest.spyOn(mockChallengeService, 'findOne').mockResolvedValue(challenge);
      (checkThePast as jest.Mock).mockReturnValue(true);
      participation = {
        id: 3,
        score: 0,
        challenge_count: 0,
        status: 0,
        challenge: { id: 1 } as any,
        user: { id: 3 } as any,
        created_at: today,
        updated_at: today,
      }
    });

    it("참가 성공", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      const challengeId = 1;
      mockParticipationService.create.mockReturnValue(participation);
      mockParticipationService.save.mockResolvedValue(participation);

      result = await service.create(3, challengeId);
      expect(mockParticipationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          challenge: { id: challengeId },
          user: { id: 3 },
        })
      );
      expect(result.id).toBe(3);
      expect(result).not.toHaveProperty("updated_at");
    });

    it("챌린지가 존재하지 않은 경우", async () => {
      jest.spyOn(mockChallengeService,'findOne').mockResolvedValue(null);

      await expect(service.create(3, 2)).rejects.toThrow("챌린지가 존재하지 않습니다.");
    });

    it("기간이 지난 경우", async () => {
      (checkThePast as jest.Mock).mockReturnValue(false);

      await expect(service.create(4, 1)).rejects.toThrow("기간이 지났습니다.");
    });

    it("이미 참가 중인 경우", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[0]);
      await expect(service.create(1, 1)).rejects.toThrow("이미 참가중입니다.");
    });

    const makeDupEntryError = (sqlMessage: string): QueryFailedError => {
      const driverError = Object.assign(new Error(sqlMessage), { code: 'ER_DUP_ENTRY', sqlMessage });
      return new QueryFailedError('INSERT ...', [], driverError);
    };

    it("findOne 통과 후 save에서 유니크 제약 위반이 발생한 경우 (동시 요청 레이스)", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      const dupError = makeDupEntryError("Duplicate entry '3-1' for key 'idx_unique_user_challenge'");
      mockParticipationService.create.mockReturnValue(participation);
      mockParticipationService.save.mockRejectedValue(dupError);

      await expect(service.create(3, 1)).rejects.toThrow("이미 참가중입니다.");
    });

    it("save에서 다른 유니크 제약 위반이 발생하면 그대로 전파한다", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      const dupError = makeDupEntryError("Duplicate entry 'x' for key 'some_other_index'");
      mockParticipationService.create.mockReturnValue(participation);
      mockParticipationService.save.mockRejectedValue(dupError);

      await expect(service.create(3, 1)).rejects.toThrow(dupError);
    });

    it("save에서 유니크 제약과 무관한 에러가 발생하면 그대로 전파한다", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      const otherError = new Error('connection lost');
      mockParticipationService.create.mockReturnValue(participation);
      mockParticipationService.save.mockRejectedValue(otherError);

      await expect(service.create(3, 1)).rejects.toThrow("connection lost");
    });
  });

  describe("update", () => {
    const challenge = {
      challengeId: 1,
      type: 0, 
      mininum_count: 1,
      title: '테스트',
      content: '테스트',
      start_date: '2025-12-01',
      end_date: '2025-12-31'
    };

    let participation: Participation;
    let dto: UpdateParticipationDto;

    beforeEach(() => {
      jest.spyOn(mockChallengeService, 'findOne').mockResolvedValue(challenge);
      (checkThePast as jest.Mock).mockReturnValue(true);
    });

    it("기록 업데이트 성공 - 값이 없는 경우", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[1]);

      const challengeId = 1;

      result = await service.update(2, challengeId, {});
      expect(mockParticipationService.increment).not.toHaveBeenCalled();
      expect(mockParticipationService.findOneByOrFail).not.toHaveBeenCalled();
      expect(mockParticipationService.update).not.toHaveBeenCalled();
      expect(result.score).toBe(0);
      expect(result.complete_date).toBeNull();
      expect(result).toBeInstanceOf(ResponseParticipationDto);
    });

    it("기록 업데이트 성공 - 값이 있는 경우", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[0]);

      const challengeId = 1;
      dto = { score: 1 };
      participation = {
        ...participations[0],
        score: 2,
      }
      mockParticipationService.findOneByOrFail.mockResolvedValue(participation);

      result = await service.update(1, challengeId, dto);
      expect(mockParticipationService.increment).toHaveBeenCalledWith(
        { id: participations[0].id }, 'score', 1,
      );
      expect(mockParticipationService.update).toHaveBeenCalledWith(
        participations[0].id,
        expect.objectContaining({ status: 1 }),
      );
      expect(result.id).toBe(1);
      expect(result.score).toBe(2);
      expect(result.complete_date).not.toBeNull();
    });

    it('참가하지 않은 경우', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);
      await expect(service.update(4, 1, {})).rejects.toThrow("참가하지 않았습니다.");
    });

    it('챌린지 포기 상태', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[2]);
      await expect(service.update(4, 1, {})).rejects.toThrow("챌린지 포기 상태입니다.");
    });
  });

  describe("updateStatus", () => {
    let dto: UpdateParticipationDto;

    it("챌린지 포기 성공", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[0]);
      const challengeId = 1;
      result = await service.updateStatus(1, challengeId);
      expect(service.findOne).toHaveBeenCalledWith(challengeId, 1);
      expect(mockParticipationService.update).toHaveBeenCalledWith(
        participations[0].id,
        { status: 2 },
      );
      expect(result.status).toEqual(2);
    });

    it("챌린지 포기 취소", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[2]);
      const challengeId = 1;

      result = await service.updateStatus(4, challengeId);
      expect(service.findOne).toHaveBeenCalledWith(challengeId, 4);
      expect(mockParticipationService.update).toHaveBeenCalledWith(
        participations[2].id,
        { status: 0 },
      );
      expect(result.status).toBe(0);
    });

    it("참가하지 않은 경우", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);
      await expect(service.updateStatus(3, 1)).rejects.toThrow("참가하지 않았습니다.");
    });

    it("챌린지 완료하는 경우", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[3]);
      await expect(service.updateStatus(5, 1)).rejects.toThrow("이미 챌린지 완료했습니다.");
    });
  });

  describe("getChallengeRank", () => {
    const challenge = {
      challengeId: 1,
      type: 0, 
      mininum_count: 1,
      title: '테스트',
      content: '테스트',
      start_date: new Date('2025-12-01'),
      end_date: new Date('2025-12-31'),
    };

    beforeEach(() => {
      jest.spyOn(mockChallengeService, 'findOne').mockResolvedValue(challenge);
    });

    beforeEach(() => {
      jest.spyOn(mockParticipationService, 'createQueryBuilder').mockReturnValue(mockQueryBuilder);
    });

    it("ResponseDTO 확인", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[0]);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[participations[0]], 1]);

      const challengeId = 1;
      result = await service.getChallengeRank(challengeId, 1, 1, 10);
      expect(result).toBeInstanceOf(ResponsePagingDto);
      expect(result.items[0]).toBeInstanceOf(ResponseParticipationDto);
      expect(result.items).toBeInstanceOf(Array);
      expect(result.meta).toBeInstanceOf(Object);
    });

    it("쿼리 확인 (100위 이내 페이지)", async () => {
      jest.spyOn(mockParticipationService, 'findOne').mockResolvedValue(participations[0]);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[participations[0]], 1]);

      await service.getChallengeRank(1, 1, 1, 10);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'p.challenge_id = :challengeId',
        { challengeId: 1 },
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('p.score', 'DESC');
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('p.created_at', 'DESC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it("100위를 넘는 페이지는 조회 없이 빈 배열 반환", async () => {
      jest.spyOn(mockParticipationService, 'findOne').mockResolvedValue(participations[0]);
      mockQueryBuilder.getCount.mockResolvedValue(150);

      result = await service.getChallengeRank(1, 1, 11, 10); // offset = 100

      expect(mockQueryBuilder.getManyAndCount).not.toHaveBeenCalled();
      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(100); // RANK_VISIBLE_LIMIT으로 클램프
    });
  });

  describe("getMyRank", () => {
    const challenge = {
      challengeId: 1,
      type: 0,
      mininum_count: 1,
      title: '테스트',
      content: '테스트',
      start_date: new Date('2025-12-01'),
      end_date: new Date('2025-12-31'),
    };

    beforeEach(() => {
      jest.spyOn(mockChallengeService, 'findOne').mockResolvedValue(challenge);
      jest.spyOn(mockParticipationService, 'createQueryBuilder').mockReturnValue(mockQueryBuilder);
    });

    it("순위 계산 확인", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[0]);
      mockQueryBuilder.getCount.mockResolvedValue(0);

      result = await service.getMyRank(1, 1);
      expect(result).toBe(1);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'p.challenge_id = :challengeId',
        { challengeId: 1 },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'p.id != :myId',
        { myId: participations[0].id },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '((p.score > :myValue) OR (p.score = :myValue AND p.created_at > :myCreatedAt))',
        { myValue: participations[0].score, myCreatedAt: participations[0].created_at },
      );
    });

    it("챌린지가 존재하지 않은 경우", async () => {
      jest.spyOn(mockChallengeService, 'findOne').mockResolvedValue(null);
      await expect(service.getMyRank(1, 1)).rejects.toThrow("챌린지가 존재하지 않습니다.");
    });

    it("참가하지 않은 경우", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);
      await expect(service.getMyRank(1, 1)).rejects.toThrow("참가하지 않았습니다.");
    });
  });

  describe("getMyChallenge", () => {
    it("ResponseDTO 확인", async () => {
      jest.spyOn(mockParticipationService, 'findAndCount').mockResolvedValue([[{}] as any, 1]);

      result = await service.getMyChallenge(1, 1, 10);
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toHaveProperty('total');
      expect(result.meta).toHaveProperty('page');
      expect(result.meta).toHaveProperty('limit');
      expect(result.meta).toHaveProperty('totalPages');
    });

    it("쿼리 확인", async() => {
      await service.getMyChallenge(1, 1, 10);
      expect(mockParticipationService.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user: { id: 1 }, },
          order: { created_at: 'DESC' },
        })
      );
    });
  });

});
