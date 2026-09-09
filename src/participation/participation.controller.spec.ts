import { Test, TestingModule } from '@nestjs/testing';
import { ParticipationController } from './participation.controller';
import { ParticipationService } from './participation.service';
import { ChallengeModule } from '../challenge/challenge.module';
import { JwtAuthGuard } from '../auth/jwt/jwt.auth.guard';
import { getGuards } from '../common/test/guard-metadata.helper';

describe('ParticipationController', () => {
  let controller: ParticipationController;

  const mockParticipationService = {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    getChallengeRank: jest.fn(),
    getMyChallenge: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ParticipationService,
          useValue: mockParticipationService,
        },
      ],
      controllers: [ParticipationController],
    }).compile();

    controller = module.get<ParticipationController>(ParticipationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('JwtAuthGuard가 클래스 전체에 적용되어 있어야 한다', () => {
    expect(getGuards(ParticipationController)).toContain(JwtAuthGuard);
  });
});
