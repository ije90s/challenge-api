import { Test, TestingModule } from '@nestjs/testing';
import { FeedService } from './feed.service';

describe('FeedService', () => {
  let service: FeedService;
  let result: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeedService],
    }).compile();

    service = module.get<FeedService>(FeedService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe("findAll", () => {
    it("전체 리스트" , () => {
      result = service.findAll(1);
      expect(result.length).toBe(2);
    });

    it("없는 경우", () => {
      result = service.findAll(2);
      expect(result.length).toBe(0);
    });
  });

  describe("findOne", () => {
    it("상세 조회", () => {
      result = service.findOne(1);
      expect(result.feed_id).toBe(1);
    });

    it("없는 경우", () => {
      result = service.findOne(3);
      expect(result).toBeUndefined();
    });
  });

  describe("findByTitle", () => {
    it("제목이 있는 경우", () => {
      result = service.findByTitle(1, '테스트2');
      expect(result).toBeDefined();
    });

    it("제목이 없는 경우", () => {
      result = service.findByTitle(1, '테스트');
      expect(result).toBeUndefined();
    });
  })

  describe("create", () => {
    it("피드 생성", async () => {
      const dto = { challenge_id: 1, title: '테스트3', content: '테스트3' };
      result = await service.create(1, dto);

      expect(result.feed_id).toBe(3);
      expect(result.images).toStrictEqual([]);
    });

    it("제목이 중복인 경우", async () => {
      const dto = { challenge_id: 1, title: '테스트2', content: '테스트' };
      await expect(() => service.create(1, dto)).rejects.toThrow("중복된 제목입니다.");
    });
  });

  describe("update", () => {
    it("피드 수정", async () => {
      const dto = { title: '테스트3', content: '테스트3' };
      result = await service.update(1, dto);
      expect(result.title).toBe('테스트3');
      expect(result.content).toBe('테스트3');
      expect(result.images).toStrictEqual([]);
    });

    it("피드가 없는 경우", async () => {
      const dto = { title: '테스트3', content: '테스트3' };
      await expect(() => service.update(3, dto)).rejects.toThrow("피드가 없습니다.");
    });

    it("제목이 중복인 경우", async () => {
      const dto = { title: '테스트2', content: '테스트2' };
      await expect(() => service.update(1, dto)).rejects.toThrow("중복된 제목입니다.");
    });
  });

  describe("delete", () => {
    it("피드 삭제", async () => {
      result = await service.delete(1);
      const pickOne = result.find(item => item.feed_id == 1);
      expect(pickOne).toBeUndefined();
    });

    it("피드가 없는 경우", async () => {
      await expect(() => service.delete(3)).rejects.toThrow("피드가 없습니다.");
    })
  });
});
