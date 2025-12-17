import { Test, TestingModule } from '@nestjs/testing';
import { ParticipationController } from './participation.controller';
import { ParticipationService } from './participation.service';
import { ChallengeModule } from '../challenge/challenge.module';

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
});
