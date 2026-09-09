import { Test, TestingModule } from '@nestjs/testing';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { ChallengeModule } from '../challenge/challenge.module';
import { JwtAuthGuard } from '../auth/jwt/jwt.auth.guard';
import { getGuards } from '../common/test/guard-metadata.helper';

describe('FeedController', () => {
  let controller: FeedController;

  const mockFeedService = {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByTitle: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: FeedService,
          useValue: mockFeedService,
        },
      ],
      controllers: [FeedController],
    }).compile();

    controller = module.get<FeedController>(FeedController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('JwtAuthGuard가 클래스 전체에 적용되어 있어야 한다', () => {
    expect(getGuards(FeedController)).toContain(JwtAuthGuard);
  });
});
