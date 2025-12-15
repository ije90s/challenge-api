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

    beforeEach(() => {
      jest.clearAllMocks();           
    });
    it('회원가입 성공', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hasedPassword);
      mockUserRepository.create.mockReturnValue({ email, password: hasedPassword });
      mockUserRepository.save.mockResolvedValue({ id: 1, email, password: hasedPassword });
  
      result = await service.signUp({ email, password });
      expect(mockUserRepository.findOneBy).toHaveBeenCalledWith({ email });
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(mockUserRepository.create).toHaveBeenCalledWith({ email, password: hasedPassword });
      expect(mockUserRepository.save).toHaveBeenCalledWith({email, password: hasedPassword })
      expect(result).toEqual({ id: 1, email: 'test@gmail.com', password: 'hashed-1234' });
    });

    it('계정이 존재하는 경우', async () => {
      mockUserRepository.findOneBy.mockResolvedValue({ id: 1, email, password: hasedPassword });
      await expect(service.signUp({email, password})).rejects.toThrow("이미 존재하는 이메일입니다.");
    });
  });

  describe('findOne', () =>{
    it('계정이 존재하는 경우', async () => {
      const email = 'test2@gmail.com';
      mockUserRepository.findOneBy.mockResolvedValue({ id: 1, email, password: '1234' });
      result = await service.findOneBy(email);
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('계정이 존재하지 않는 경우', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);
      const email = 'test3@gmail.com';
      result = await service.findOneBy(email);
      expect(result).toBeNull();
    })
  });

});
