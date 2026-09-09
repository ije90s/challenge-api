import { Test, TestingModule } from '@nestjs/testing';
import { ChallengeController } from './challenge.controller';
import { ChallengeService } from './challenge.service';
import { JwtAuthGuard } from '../auth/jwt/jwt.auth.guard';
import { getGuards } from '../common/test/guard-metadata.helper';

describe('ChallengeController', () => {
  let controller: ChallengeController;

  const mockChallengeService = {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: ChallengeService, useValue: mockChallengeService, },],
      controllers: [ChallengeController],
    }).compile();

    controller = module.get<ChallengeController>(ChallengeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('JwtAuthGuard가 클래스 전체에 적용되어 있어야 한다', () => {
    expect(getGuards(ChallengeController)).toContain(JwtAuthGuard);
  });
});
