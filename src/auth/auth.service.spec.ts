import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service'; 
import { JwtService } from '@nestjs/jwt';
import *  as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  // DI 시킨 provider는 페이크 함수 처리
  const mockUserService = {
   findOneBy: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });


  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signIn', () => {
    const email = 'test@gmail.com';
    const password = '1234';
    const hasedPassword = 'hashed-1234';

    beforeEach(() => {
      jest.clearAllMocks();           
    });

    it('jwt 토큰 성공', async () => {
      mockUserService.findOneBy.mockResolvedValue({user_id: 1, email, password: hasedPassword }); // 응답 주입
      mockJwtService.sign.mockReturnValue('mock-token');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.signIn({ email, password });
      expect(mockUserService.findOneBy).toHaveBeenCalledWith(email);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hasedPassword);
      expect(mockJwtService.sign).toHaveBeenCalledWith({ email, sub: 1 });
      expect(result).toEqual({ access_token: 'mock-token' });
    });

    it('계정이 존재하지 않는 경우', async () => {
      mockUserService.findOneBy.mockResolvedValue(null);

      await expect(service.signIn({email, password })).rejects.toThrow("존재하지 않은 계정입니다.");
    });

    it('비밀번호가 틀린 경우', async () => {
      mockUserService.findOneBy.mockResolvedValue({user_id: 1, email, password: hasedPassword }); // 응답 주입
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      
      await expect(service.signIn({ email, password })).rejects.toThrow("비밀번호가 잘못되었습니다.");
    });
  });

});
