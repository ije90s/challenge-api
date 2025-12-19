import { Test, TestingModule } from '@nestjs/testing';
import { FeedService } from './feed.service';
import { ChallengeService } from '../challenge/challenge.service';
import { checkThePast } from '../common/util';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Feed } from './entity/feed.entity';
import { Not } from 'typeorm';
import { ResponseFeedDto } from './dto/response-feed.dto';

// 올바른 mock 경로
jest.mock('../common/util', () => ({
  checkThePast: jest.fn(),
}));

describe('FeedService', () => {
  let service: FeedService;
  let result: any;
  let feeds: Feed[];

  const mockChallengeService = {
    findOne: jest.fn(),
  }

  const mockFeedRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  }

  const today = new Date();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        {provide: ChallengeService, useValue: mockChallengeService },
        { provide: getRepositoryToken(Feed), useValue: mockFeedRepository },
      ],
    }).compile();

    service = module.get<FeedService>(FeedService);

    // mock reset
    mockChallengeService.findOne.mockReset();
    (checkThePast as jest.Mock).mockReset();

    feeds = [
      {
        id: 1,
        title: "테스트",
        content: "테스트",
        images: [],
        user: {id: 1} as any,
        challenge: {id: 1} as any,
        deleted_at: null, 
        created_at: today,
        updated_at: today,
      },
      {
        id: 2,
        title: "테스트2",
        content: "테스트2",
        images: [],
        user: {id: 2} as any,
        challenge: {id: 1} as any,
        deleted_at: null, 
        created_at: today,
        updated_at: today,
      },
    ];
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe("findAll", () => {
    it("전체 리스트" , async () => {
      jest.spyOn(mockFeedRepository, 'findAndCount').mockResolvedValue([[{} as any], 1]);
      result = await service.findAll(1, 1, 10);
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toHaveProperty('total');
      expect(result.meta).toHaveProperty('page');
      expect(result.meta).toHaveProperty('limit');
      expect(result.meta).toHaveProperty('totalPages');
    });
  });

  describe("findOne", () => {
    it("상세 조회", async () => {
      mockFeedRepository.findOne.mockResolvedValue(feeds[0]);
      result = await service.findOne(1);
      expect(mockFeedRepository.findOne).toHaveBeenCalledWith({ where: {id: 1} });
      expect(result).toBeInstanceOf(ResponseFeedDto);
    });

    it("없는 경우", async () => {
      mockFeedRepository.findOne.mockResolvedValue(null);
      result = await service.findOne(3);
      expect(mockFeedRepository.findOne).toHaveBeenCalledWith({where: {id: 3}});
      expect(result).toBeNull();
    });
  });

  describe("findByTitle", () => {
    it("제목이 있는 경우", async () => {
      mockFeedRepository.findOneBy.mockResolvedValue(feeds[0]);
      result = await service.findByTitle(2, '테스트');
      expect(mockFeedRepository.findOneBy).toHaveBeenCalledWith({ id: Not(2), title: '테스트'});
      //expect(result).toBeTruthy();
      expect(result).toBeInstanceOf(ResponseFeedDto);
    });

    it("제목이 없는 경우", async () => {
      mockFeedRepository.findOneBy.mockResolvedValue(null);
      result = await service.findByTitle(1, '테스트3');
      //expect(mockFeedRepository.findOneBy).toHaveBeenCalledWith({ id: Not(1), title: '테스트3' });
      expect(result).toBeNull();
    });
  })

  describe("create", () => {
    const challenge = {
      id: 1,
      type: 0, 
      mininum_count: 1,
      title: '테스트',
      content: '테스트',
      start_date: '2025-12-01',
      end_date: '2025-12-31',
      author_id: 1,
    };

    let feed: Feed; 

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(mockChallengeService, 'findOne').mockResolvedValue(challenge);                 
      (checkThePast as jest.Mock).mockReturnValue(true);
      feed = {
        id: 3, 
        title: '테스트3',
        content: '테스트3',
        images: [],
        user: { id: 3} as any,
        challenge: { id: 1} as any,
        deleted_at: null,
        created_at: today,
        updated_at: today,
      };
    });

    it("피드 생성", async () => {
      jest.spyOn(service, 'findByTitle').mockResolvedValue(null);
      
      const dto = { challenge_id: 1, title: '테스트3', content: '테스트3' };
      mockFeedRepository.create.mockReturnValue(feed);
      mockFeedRepository.save.mockResolvedValue(feed);

      result = await service.create(3, dto, []);
      expect(mockFeedRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: dto.title,
          content: dto.content,
          images: [],
          user: { id: 3},
          challenge: { id: 1},
        })
      );
      expect(result.id).toBe(3);
      expect(result.title).toBe('테스트3');
      expect(result).toBeInstanceOf(ResponseFeedDto);
    });

    it("챌린지가 없는 경우", async () => {
      jest.spyOn(mockChallengeService, 'findOne').mockResolvedValue(null);
      const dto = { challenge_id: 1, title: '테스트3', content: '테스트3' };

      await expect(service.create(1, dto, [])).rejects.toThrow("챌린지가 없습니다.");
    });

    it("기간 만료인 경우", async () => {
      const dto = { challenge_id: 1, title: '테스트3', content: '테스트3' };
      (checkThePast as jest.Mock).mockReturnValue(false);
      await expect(service.create(1, dto, [])).rejects.toThrow("기간이 지났습니다.");
    });

    it("제목이 중복인 경우", async () => {
      const feed = {
        ...feeds[1],
        user_id: feeds[1].user.id,
        challenge_id: feeds[1].challenge.id,
      }
      jest.spyOn(service, 'findByTitle').mockResolvedValue(feed);
      const dto = { challenge_id: 1, title: '테스트2', content: '테스트' };

      await expect(service.create(1, dto, [])).rejects.toThrow("중복된 제목입니다.");
    });
  });

  describe("update", () => {
    it("피드 수정", async () => {
      const feed = {
        ...feeds[0],
        user_id: feeds[0].user.id,
        challenge_id: feeds[0].challenge.id,
      }
      jest.spyOn(service, 'findOne').mockResolvedValue(feed);
      jest.spyOn(service, 'findByTitle').mockResolvedValue(null);

      const dto = { title: '테스트3', content: '테스트3' };
      const feedId = 1, userId = 1;
      const images = [{ filename: '1.png'}, {filename: '2.png'}] as any;
      
      const savedImages = ['feed/1.png', 'feed/2.png'];
      const savedEntity = { ...feeds[0], ...dto, images: savedImages };
      mockFeedRepository.save.mockResolvedValue(savedEntity);

      result = await service.update(feedId, userId, dto, images);
      expect(mockFeedRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: feeds[0].id,
          title: dto.title,
          content: dto.content,
          images: savedImages,
        })
      );
      expect(result.id).toBe(1);
      expect(result.title).toEqual(dto.title);
      expect(result.images).not.toEqual(images);
      expect(result).toBeInstanceOf(ResponseFeedDto);
    });

    it("피드가 없는 경우", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      const dto = { title: '테스트3', content: '테스트3' };
      await expect(service.update(3, 1, dto, [])).rejects.toThrow("피드가 없습니다.");
    });

    it("제목이 중복인 경우", async () => {
      const feed = {
        ...feeds[0],
        user_id: feeds[0].user.id,
        challenge_id: feeds[0].challenge.id,
      }
      const feed1 = {
        ...feeds[1],
        user_id: feeds[1].user.id,
        challenge_id: feeds[1].challenge.id,
      }
      jest.spyOn(service, 'findOne').mockResolvedValue(feed);
      jest.spyOn(service, 'findByTitle').mockResolvedValue(feed1);

      const dto = { title: '테스트2', content: '테스트2' };
      await expect(service.update(1, 1, dto, [])).rejects.toThrow("중복된 제목입니다.");
    });

    it("작성자 아닌 경우", async () => {
      const feed = {
        ...feeds[0],
        user_id: feeds[0].user.id,
        challenge_id: feeds[0].challenge.id,
      }
      jest.spyOn(service, 'findOne').mockResolvedValue(feed);

      const dto = { title: '테스트2', content: '테스트2' };
      await expect(service.update(1, 2, dto, [])).rejects.toThrow("작성자만 접근 가능합니다.");
    });
  });

  describe("delete", () => {
    it("피드 삭제", async () => {
      const feed = {
        ...feeds[0],
        user_id: feeds[0].user.id,
        challenge_id: feeds[0].challenge.id,
      }
      jest.spyOn(service, 'findOne').mockResolvedValue(feed);

      result = await service.delete(1, 1);
      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(mockFeedRepository.softDelete).toHaveBeenCalledWith({id: 1});
    });

    it("피드가 없는 경우", async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);
      await expect(service.delete(3,1)).rejects.toThrow("피드가 없습니다.");
    });

    it("작성자가 아닌 경우", async () => {
      const feed = {
        ...feeds[0],
        user_id: feeds[0].user.id,
        challenge_id: feeds[0].challenge.id,
      }
      jest.spyOn(service, 'findOne').mockResolvedValue(feed);
      await expect(service.delete(1, 3)).rejects.toThrow("작성자만 접근 가능합니다.");
    })
  });
});
