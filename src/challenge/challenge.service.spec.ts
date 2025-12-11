import { Test, TestingModule } from '@nestjs/testing';
import { ChallengeService } from './challenge.service';

describe('ChallengeService', () => {
  let service: ChallengeService;
  let result: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChallengeService],
    }).compile();

    service = module.get<ChallengeService>(ChallengeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe("findAll", () => {
    it("전체 리스트 조회", () => {
      result = service.findAll();
      expect(result.length).toBe(2);
    });
  });

  describe('findOne', () => {
    it('값이 있는 경우', () => {
      result = service.findOne(1);
      expect(result?.challengeId).toEqual(1);
    });

    it('값이 없는 경우', () => {
      result = service.findOne(3);
      expect(result).toBeUndefined();
    });
  });

  describe('findTitle', () => {
    it('제목이 중복인 경우', () => {
      result = service.findByTitle(0, '테스트');
      expect([result].length).toBe(1);
    });

    it('제목이 중복이 아닌 경우', () => {
      result = service.findByTitle(0, '테스트3');
      expect(result).toBeUndefined();
    });
  });

  describe("create", () => {
    it("챌린지 생성 성공", () => {
      const dto = {
        type: 1, 
        mininum_count: 1,
        title: '테스트3',
        content: '테스트3',
        start_date: '2025-12-01',
        end_date: '2025-12-05'
      };
      result = service.create(1, dto);
      expect(result.challengeId).toBe(3);
      expect(result.title).toBe('테스트3');
    });

    it('제목이 중복인 경우', () => {
      const dto = {
        type: 1, 
        mininum_count: 1,
        title: '테스트2',
        content: '테스트3',
        start_date: '2025-12-01',
        end_date: '2025-12-05'
      };

      expect(() => service.create(1, dto)).toThrow("중복된 제목입니다.");
    });

    it('끝일이 작은 경우', () => {
      const dto = {
        type: 1, 
        mininum_count: 1,
        title: '테스트3',
        content: '테스트3',
        start_date: '2025-12-01',
        end_date: '2025-11-30'
      };

      expect(() => service.create(1, dto)).toThrow("날짜 설정이 잘못되었습니다.");
    });

    it('날짜 포맷이 잘못된 경우', () => {
      const dto = {
        type: 1, 
        mininum_count: 1,
        title: '테스트3',
        content: '테스트3',
        start_date: '2025-122323',
        end_date: '2025-12-05'
      };

      expect(() => service.create(1, dto)).toThrow("날짜 설정이 잘못되었습니다.");
    });
  });

  describe("update", () => {
    it("챌린지 수정 성공", () => {
      const dto = {
        title: '테스트3',
        content: '테스트3',
        start_date: '2025-12-01',
        end_date: '2025-12-05'
      };
      const challengeId = 2;

      result = service.update(challengeId, 2, dto);
      expect(result.title).toBe('테스트3');
    });

    it('챌린지가 없는 경우', () => {
      const dto = {
        title: '테스트3',
        content: '테스트3',
        start_date: '2025-12-01',
        end_date: '2025-12-05'
      };
      const challengeId = 3;

      expect(() => service.update(challengeId, 1, dto)).toThrow("챌린지가 없습니다.");
    });

    it("제목이 중복인 경우", () => {
      const dto = {
        title: '테스트',
        content: '테스트3',
        start_date: '2025-12-01',
        end_date: '2025-12-05'
      };
      const challengeId = 2;
      expect(() => service.update(challengeId, 2, dto)).toThrow("중복된 제목입니다.");
    });

    it("날짜가 잘못된 경우", () => {
      const dto = {
        title: '테스트3',
        content: '테스트3',
        start_date: '2025-12-01',
        end_date: '2025-11-30'
      };
      const challengeId = 2;

      expect(() => service.update(challengeId, 2, dto)).toThrow("날짜 설정이 잘못되었습니다.");
    });
  });

  describe("delete", () => {
    it("챌린지 삭제 성공", () => {
      const result = service.delete(1, 1);
      expect(result.every(item => item.challengeId === 1)).toBeFalsy();
    });

    it('챌린지가 없는 경우', () => {
      expect(() => service.delete(3, 1)).toThrow("챌린지가 없습니다.");
    })
  });
});
