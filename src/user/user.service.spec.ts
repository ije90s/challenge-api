import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entity/user.entity';

jest.mock('bcrypt');

describe('UserService', () => {
  let service: UserService;
  let result: any;
  
  const mockUserRepository = {
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }
 
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository,
        },],
    }).compile();

    service = module.get<UserService>(UserService);

  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    const email = 'test@gmail.com';
    const password = '1234';
    const hasedPassword = 'hashed-1234';
    const today = new Date();
    const userEntity = { id: 1, email, password: hasedPassword, created_at: today, updated_at: today };

    beforeEach(() => {
      jest.clearAllMocks();
      (bcrypt.hash as jest.Mock).mockResolvedValue(hasedPassword);
      jest.spyOn(service, 'findOneBy').mockResolvedValue(null);           
    });
    
    it('회원가입 성공-ResponseDTO로 출력확인', async () => {
      mockUserRepository.save.mockResolvedValue(userEntity);   
      const result = await service.signUp({ email, password });

      expect(bcrypt.hash).toHaveBeenCalled();
      expect(result).toEqual({
        id: userEntity.id,
        email: userEntity.email,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('계정이 존재하는 경우', async () => {
      jest.spyOn(service, 'findOneBy').mockResolvedValue(userEntity);
      await expect(service.signUp({email, password})).rejects.toThrow("이미 존재하는 이메일입니다.");
    });
  });

  describe('findOne', () =>{
    it('계정이 존재하는 경우', async () => {
      const email = 'test2@gmail.com';
      jest.spyOn(mockUserRepository, 'findOneBy').mockResolvedValue({ id: 1, email, password: '1234' });
      result = await service.findOneBy(email);
      expect(result.id).toBe(1);
      expect(result.email).toEqual(email);
    });

    it('계정이 존재하지 않는 경우', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);
      const email = 'test3@gmail.com';
      result = await service.findOneBy(email);
      expect(result).toBeNull();
    })
  });

});
