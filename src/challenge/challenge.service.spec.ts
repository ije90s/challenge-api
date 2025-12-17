import { Test, TestingModule } from '@nestjs/testing';
import { ChallengeService } from './challenge.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Challenge } from './entity/challenge.entity';
import { Not } from 'typeorm';

describe('ChallengeService', () => {
  let service: ChallengeService;
  let result: any;
  let challenges: any[];
  const today = new Date();

  const mockChallengeRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChallengeService,
        { provide: getRepositoryToken(Challenge), useValue: mockChallengeRepository,},
      ],
    }).compile();

    service = module.get<ChallengeService>(ChallengeService);
    jest.clearAllMocks();
    
    challenges = [
      {
        id: 1, 
        type: 0, 
        mininum_count: 1, 
        title: '테스트', 
        content: '테스트',
        start_date: new Date('2025-12-01'),
        end_date: new Date('2025-12-31'),
        author: { id: 1, },
        deleted_at: null,
        create_at: new Date(),
        update_at: new Date(),
      },
      {
        id: 2, 
        type: 1, 
        mininum_count: 1, 
        title: '테스트2', 
        content: '테스트2',
        start_date: new Date('2025-12-01'),
        end_date: new Date('2025-12-20'),
        author: { id: 2, },
        deleted_at: null,
        create_at: new Date(),
        update_at: new Date(),
      }
    ];
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe("findAll", () => {
    it("전체 리스트 조회", async() => {
      mockChallengeRepository.find.mockResolvedValue(challenges);
      result = await service.findAll();
      expect(mockChallengeRepository.find).toHaveBeenCalled();
      expect(result.length).toBe(2);
    });

    it("없는 경우", async() => {
      mockChallengeRepository.find.mockResolvedValue(null);
      result = await service.findAll();
      expect(mockChallengeRepository.find).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('findOne', () => {
    it('값이 있는 경우', async () => {
      mockChallengeRepository.findOne.mockResolvedValue(challenges[0]);

      result = await service.findOne(1);
      expect(mockChallengeRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['author'],
      });
      expect(result.author).toEqual({id: 1});
    });

    it('값이 없는 경우', async () => {
      mockChallengeRepository.findOne.mockResolvedValue(null);

      result = await service.findOne(3);
      expect(mockChallengeRepository.findOne).toHaveBeenCalledWith({
        where: { id: 3 },
        relations: ['author'],
      });
      expect(result).toBeNull();
    });
  });

  describe('findTitle', () => {
    it('제목이 중복인 경우', async () => {
      mockChallengeRepository.findOneBy.mockResolvedValue(challenges[1]);

      result = await service.findByTitle(1, '테스트2');
      expect(mockChallengeRepository.findOneBy).toHaveBeenCalledWith({ id: Not(1), title: '테스트2'});
      expect(result.title).toEqual('테스트2');
    });

    it('제목이 중복이 아닌 경우', async () => {
      mockChallengeRepository.findOneBy.mockResolvedValue(null);
      
      result = await service.findByTitle(3, '테스트3');
      expect(mockChallengeRepository.findOneBy).toHaveBeenCalledWith({ id: Not(3), title: '테스트3' });
      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    let dto = {
        type: 1, 
        mininum_count: 1,
        title: '테스트3',
        content: '테스트3',
        start_date: '2025-12-01',
        end_date: '2025-12-18',
    };
    const challengeEntity = {
      id: 3, 
      author: { id: 3 },
      deleted_at: null, 
      ...dto,
      start_date: new Date(dto.start_date),
      end_date: new Date(dto.end_date),
      create_at: today,
      update_at: today,
    };
    it("챌린지 생성 성공", async () => {
      mockChallengeRepository.findOneBy.mockResolvedValue(null);
      mockChallengeRepository.create.mockReturnValue(challengeEntity);
      mockChallengeRepository.save.mockResolvedValue(challengeEntity);

      result = await service.create(3, dto);
      expect(mockChallengeRepository.findOneBy).toHaveBeenCalledWith({ id: Not(0), title: '테스트3'});
      expect(mockChallengeRepository.create).toHaveBeenCalledWith({ ...dto, author: {id: 3}});
      expect(mockChallengeRepository.save).toHaveBeenCalledWith(challengeEntity);

      expect(result.create_at).toEqual(today);
    });

    it('제목이 중복인 경우', async () => {
      dto = {
        type: 1, 
        mininum_count: 1,
        title: '테스트2',
        content: '테스트3',
        start_date: '2025-12-01',
        end_date: '2025-12-18'
      };

      mockChallengeRepository.findOneBy.mockResolvedValue(challenges[1]);
      await expect(service.create(3, dto)).rejects.toThrow("중복된 제목입니다.");
    });

    it('끝일이 작은 경우', async () => {
      dto = {
        type: 1, 
        mininum_count: 1,
        title: '테스트3',
        content: '테스트3',
        start_date: '2025-12-01',
        end_date: '2025-11-30'
      };

      mockChallengeRepository.findOneBy.mockResolvedValue(null);
      await expect(service.create(3, dto)).rejects.toThrow("날짜 설정이 잘못되었습니다.");
    });

    it('날짜 포맷이 잘못된 경우', async () => {
      dto = {
        type: 1, 
        mininum_count: 1,
        title: '테스트3',
        content: '테스트3',
        start_date: '2025-122323',
        end_date: '2025-12-05'
      };

      mockChallengeRepository.findOneBy.mockResolvedValue(null);
      await expect(service.create(3, dto)).rejects.toThrow("날짜 설정이 잘못되었습니다.");
    });
  });

  describe("update", () => {
    const update_at = new Date();
    let dto = {
      title: '테스트3',
      content: '테스트3',
      start_date: '2025-12-01',
      end_date: '2025-12-31',
    };
    it("챌린지 수정 성공", async () => {
      mockChallengeRepository.findOne.mockResolvedValue(challenges[0]);
      mockChallengeRepository.findOneBy.mockResolvedValue(null);
      mockChallengeRepository.save.mockResolvedValue({ ...challenges[0], title: '테스트3', content: '테스트3', update_at });

      result = await service.update(1, 1, dto);
      expect(mockChallengeRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['author'],
      });
      expect(mockChallengeRepository.findOneBy).toHaveBeenCalledWith({ id: Not(1), title: '테스트3' });
      expect(mockChallengeRepository.save).toHaveBeenCalledWith(Object.assign(challenges[0], dto));
      expect(result.title).toEqual('테스트3');
      expect(result.update_at).not.toEqual(today);
    });

    it('챌린지가 없는 경우', async () => {
      dto = {
        title: '테스트3',
        content: '테스트3',
        start_date: '2025-12-01',
        end_date: '2025-12-05'
      };
      mockChallengeRepository.findOne.mockResolvedValue(null);

      await expect(service.update(3, 1, dto)).rejects.toThrow("챌린지가 없습니다.");
    });

    it("제목이 중복인 경우", async () => {
      dto = {
        title: '테스트',
        content: '테스트3',
        start_date: '2025-12-01',
        end_date: '2025-12-05'
      };

      mockChallengeRepository.findOne.mockResolvedValue(challenges[1]);
      mockChallengeRepository.findOneBy.mockResolvedValue(challenges[0]);

      await expect(service.update(2, 2, dto)).rejects.toThrow("중복된 제목입니다.");
    });

    it("작성자가 아닌 경우", async () => {
      mockChallengeRepository.findOne.mockResolvedValue(challenges[0]);

      await expect(service.update(1, 2, dto)).rejects.toThrow("작성자만 접근 가능합니다.");
    });

    it("날짜가 잘못된 경우", async () => {
      dto = {
        title: '테스트3',
        content: '테스트3',
        start_date: '2025-12-01',
        end_date: '2025-11-30'
      };
      mockChallengeRepository.findOne.mockResolvedValue(challenges[0]);
      mockChallengeRepository.findOneBy.mockResolvedValue(null);
      await expect(service.update(1, 1, dto)).rejects.toThrow("날짜 설정이 잘못되었습니다.");
    });
  });

  describe("delete", () => {
    it("챌린지 삭제 성공", async () => {
      mockChallengeRepository.findOne.mockResolvedValue(challenges[0]);

      result = await service.delete(1, 1);
      expect(mockChallengeRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['author'],
      });
      expect(mockChallengeRepository.softDelete).toHaveBeenCalledWith({ id: 1});
    });

    it('챌린지가 없는 경우', async () => {
      mockChallengeRepository.findOne.mockResolvedValue(null);

      await expect(service.delete(3, 1)).rejects.toThrow("챌린지가 없습니다.");
    })

    it('작성자가 아닌 경우', async () => {
      mockChallengeRepository.findOne.mockResolvedValue(challenges[0]);

      await expect(service.delete(1, 3)).rejects.toThrow("작성자만 접근 가능합니다.");
    });
  });
});
