import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt/jwt.auth.guard';
import { getGuards } from '../common/test/guard-metadata.helper';

describe('UserController', () => {
  let controller: UserController;

  const mockUserService = {
    signUp: jest.fn(),
  }

  const mockAuthService = {
    signIn: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: AuthService, useValue: mockAuthService }
      ],
      controllers: [UserController],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('회원가입/로그인 라우트는 JwtAuthGuard 없이 공개되어 있어야 한다', () => {
    // 메서드를 호출하지 않고 guard 메타데이터 조회용 대상으로만 참조하므로 unbound-method는 오탐이다.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(getGuards(UserController.prototype.signUp)).not.toContain(JwtAuthGuard);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(getGuards(UserController.prototype.signIn)).not.toContain(JwtAuthGuard);
  });

  it('내 정보 조회(me)에는 JwtAuthGuard가 걸려 있어야 한다', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(getGuards(UserController.prototype.fineOne)).toContain(JwtAuthGuard);
  });
});
