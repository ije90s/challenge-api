import { Test, TestingModule } from '@nestjs/testing';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { ChallengeModule } from '../challenge/challenge.module';

describe('FeedController', () => {
  let controller: FeedController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ChallengeModule],
      providers: [FeedService],
      controllers: [FeedController],
    }).compile();

    controller = module.get<FeedController>(FeedController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
