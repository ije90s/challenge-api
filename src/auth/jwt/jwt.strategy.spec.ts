import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UserService } from '../../user/user.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockUserService = {
    findOneByEmail: jest.fn(),
  };

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const payload = { email: 'test@gmail.com', sub: '1' };

    it('사용자가 존재하면 사용자를 반환한다', async () => {
      const user = { id: 1, email: payload.email };
      mockUserService.findOneByEmail.mockResolvedValue(user);

      const result = await strategy.validate(payload);
      expect(result).toEqual(user);
    });

    it('사용자가 존재하지 않으면 예외를 던진다 (await 누락 시 죽은 코드가 되던 분기)', async () => {
      mockUserService.findOneByEmail.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });
  });
});
