import { Test, TestingModule } from '@nestjs/testing';
import { ParticipationService } from './participation.service';
import { ChallengeService } from '../challenge/challenge.service';
import { checkThePast } from '../common/util';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Participation } from './entity/participation.entity';
import { CreateParticipationDto } from './dto/create-participation.dto';
import { UpdateParticipationDto } from './dto/update-participation.dto';

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
    let dto: CreateParticipationDto;

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

      dto = { challenge_id: 1, };
      mockParticipationService.create.mockReturnValue(participation);
      mockParticipationService.save.mockResolvedValue(participation);

      result = await service.create(3, dto);
      expect(mockChallengeService.findOne).toHaveBeenCalledWith(1);
      expect(checkThePast).toHaveBeenCalledWith(challenge.end_date);
      expect(service.findOne).toHaveBeenCalledWith(dto.challenge_id, 3);
      expect(mockParticipationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          challenge: { id: dto.challenge_id },
          user: { id: 3 },
        })
      );
      expect(result.id).toBe(3);
    });

    it("챌린지가 존재하지 않은 경우", async () => {
      jest.spyOn(mockChallengeService,'findOne').mockResolvedValue(null);

      await expect(service.create(3, {challenge_id: 2})).rejects.toThrow("챌린지가 존재하지 않습니다.");
    });

    it("기간이 지난 경우", async () => {
      (checkThePast as jest.Mock).mockReturnValue(false);

      await expect(service.create(4, {challenge_id: 1})).rejects.toThrow("기간이 지났습니다.");
    });

    it("이미 참가 중인 경우", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[0]);
      await expect(service.create(1, {challenge_id: 1})).rejects.toThrow("이미 참가중입니다.");
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

      dto = {challenge_id: 1 };
      participation = { ...participations[1], }

      mockParticipationService.save.mockResolvedValue(participation);

      result = await service.update(2, dto);
      expect(mockChallengeService.findOne).toHaveBeenCalledWith(1);
      expect(checkThePast).toHaveBeenCalledWith(challenge.end_date);
      expect(service.findOne).toHaveBeenCalledWith(dto.challenge_id, 2);
      expect(mockParticipationService.save).toHaveBeenCalledWith(expect.objectContaining({
        id: participations[1].id,
        score: 0,
        challenge_count: 0,
        complete_date: null,
      }));
      expect(result.score).toBe(0);
      expect(result.complete_date).toBeNull();
    });
    
    it("기록 업데이트 성공 - 값이 있는 경우", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[0]);
      
      dto = {challenge_id: 1, score: 1 };
      participation = {
        ...participations[0],
        complete_date: new Date(),
        score: 2,
        status: 1,
      }
      mockParticipationService.save.mockResolvedValue(participation);

      result = await service.update(1, dto);
      expect(mockChallengeService.findOne).toHaveBeenCalledWith(1);
      expect(checkThePast).toHaveBeenCalledWith(challenge.end_date);
      expect(service.findOne).toHaveBeenCalledWith(dto.challenge_id, 1);
      expect(mockParticipationService.save).toHaveBeenCalledWith(expect.objectContaining({
        id: participations[0].id,
        score: participation.score,
        status: participation.status,
        complete_date: participation.complete_date,
      }));
      expect(result.id).toBe(1);
      expect(result.score).toBe(2);
      expect(result.complete_date).not.toBeNull();
    });

    it('참가하지 않은 경우', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);
      await expect(service.update(4, {challenge_id: 1})).rejects.toThrow("참가하지 않았습니다.");
    });

    it('챌린지 포기 상태', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[2]);
      await expect(service.update(4, {challenge_id: 1})).rejects.toThrow("챌린지 포기 상태입니다.");
    });
  });

  describe("updateStatus", () => {
    let dto: UpdateParticipationDto;

    it("챌린지 포기 성공", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[0]);
      dto = {challenge_id: 1};
      const savedEntity = { ...participations[0], status: 2, }
      mockParticipationService.save.mockResolvedValue(savedEntity);
      result = await service.updateStatus(1, dto);
      expect(service.findOne).toHaveBeenCalledWith(dto.challenge_id, 1);
      expect(mockParticipationService.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: participations[0].id,
          status: 2
      }));
      expect(result.status).toEqual(2);
    });

    it("챌린지 포기 취소", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[2]);
      
      dto = {challenge_id: 1};
      const savedEntity = {
        ...participations[2],
        status: 0,
      };
      mockParticipationService.save.mockResolvedValue(savedEntity);
      
      result = await service.updateStatus(4, dto);
      expect(service.findOne).toHaveBeenCalledWith(dto.challenge_id, 4);
      expect(mockParticipationService.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 0,
        })
      );
      expect(result.status).toBe(0);
    });

    it("참가하지 않은 경우", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);
      await expect(service.updateStatus(3, {challenge_id: 1})).rejects.toThrow("참가하지 않았습니다.");
    });

    it("챌린지 완료하는 경우", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[3]);
      await expect(service.updateStatus(5, {challenge_id: 1})).rejects.toThrow("이미 챌린지 완료했습니다.");
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
    it("점수순으로 리스트 가져오기", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(participations[0]);
      
      const challengeId = 1;
      const orderField = 'p.score';
      const orderdParticipations = participations.sort((a,b) => {
        return b.score - a.score;
      });
      mockQueryBuilder.getMany.mockResolvedValue(orderdParticipations);

      result = await service.getChallengeRank(challengeId, 1);
      expect(mockParticipationService.createQueryBuilder).toHaveBeenCalledWith('p');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('p.challenge_id = :challengeId', { challengeId })
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(orderField, 'DESC')
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('p.created_at', 'DESC')
      expect(mockQueryBuilder.getMany).toHaveBeenCalled();
      expect(result).toEqual(orderdParticipations);
    });

    it("참가하지 않은 경우", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);
      await expect(service.getChallengeRank(1, 3)).rejects.toThrow("참가하지 않았습니다.");
    });
  });

  describe("getMyChallenge", () => {
    it("챌린지 참가한 경우", async () => {
      mockParticipationService.find.mockResolvedValue(participations[0]);
      result = await service.getMyChallenge(1);
      expect(mockParticipationService.find).toHaveBeenCalledWith({
        where: {
          user: { id: 1 },
        },
        order: { created_at: 'DESC' },
      });
      expect(result).toBeTruthy();
    });

    it("없는 경우", async () => {
      mockParticipationService.find.mockResolvedValue([]);
      result = await service.getMyChallenge(9);
      expect(mockParticipationService.find).toHaveBeenCalledWith({
        where: {
          user: { id: 9 },
        },
        order: { created_at: 'DESC' },
      });
      expect(result.length).toBe(0);
    });
  });

});
