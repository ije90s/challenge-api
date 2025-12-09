import { Test, TestingModule } from '@nestjs/testing';
import { ParticipationController } from './participation.controller';
import { ParticipationService } from './participation.service';

describe('ParticipationController', () => {
  let controller: ParticipationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ParticipationService],
      controllers: [ParticipationController],
    }).compile();

    controller = module.get<ParticipationController>(ParticipationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
