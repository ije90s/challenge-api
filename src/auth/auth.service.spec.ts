import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service'; 
import { JwtService } from '@nestjs/jwt';
import *  as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let dto: any;
  let result: any;

  // DI 시킨 provider는 페이크 함수 처리
  const mockUserService = {
   findOne: jest.fn(),
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
    it('jwt 토큰 성공', async () => {
      dto = { userId: 1, email: 'test@gmail.com', password: 'hashed-1234' };

      mockUserService.findOne.mockResolvedValue(dto); // 응답 주입
      mockJwtService.sign.mockReturnValue('mock-token');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.signIn({ email: 'test@gmail.com', password: '1234' });
      expect(mockUserService.findOne).toHaveBeenCalledWith('test@gmail.com');
      expect(bcrypt.compare).toHaveBeenCalledWith('1234', dto.password);
      expect(mockJwtService.sign).toHaveBeenCalledWith({ email: dto.email, sub: dto.userId });
      expect(result).toEqual({ access_token: 'mock-token' });
    });

    it('계정이 존재하지 않는 경우', async () => {
      mockUserService.findOne.mockResolvedValue(null);

      await expect(
        service.signIn({ email: 'test@gmail.com', password: '1234' }),
      ).rejects.toThrow('존재하지 않은 계정입니다.');
    });

    it('비밀번호가 틀린 경우', async () => {
      dto = { userId: 1, email: 'test@gmail.com', password: '1234' };
      mockUserService.findOne.mockResolvedValue(dto); // 응답 주입
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      

      await expect(
        service.signIn({email: 'test@gmail.com', password: '1235'})
      ).rejects.toThrow("비밀번호가 잘못되었습니다.");
    });
  });

});
