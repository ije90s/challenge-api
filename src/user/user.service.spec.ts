import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ResponseUserDto } from "./dto/response-user.dto";
import { User } from './entity/user.entity';
import { QueryFailedError } from 'typeorm';

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
      jest.spyOn(service, 'findOneByEmail').mockResolvedValue(null);           
    });
    
    it('회원가입 성공-ResponseDTO로 출력확인', async () => {
      mockUserRepository.save.mockResolvedValue(userEntity);   
      const result = await service.signUp({ email, password });

      expect(bcrypt.hash).toHaveBeenCalled();
      expect(result).toBeInstanceOf(ResponseUserDto);
      expect(result).toEqual({
        id: userEntity.id,
        email: userEntity.email,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('계정이 존재하는 경우', async () => {
      jest.spyOn(service, 'findOneByEmail').mockResolvedValue(userEntity);
      await expect(service.signUp({email, password})).rejects.toThrow("이미 존재하는 이메일입니다.");
    });

    const makeDupEntryError = (sqlMessage: string): QueryFailedError => {
      const driverError = Object.assign(new Error(sqlMessage), { code: 'ER_DUP_ENTRY', sqlMessage });
      return new QueryFailedError('INSERT ...', [], driverError);
    };

    it('findOneByEmail 통과 후 save에서 유니크 제약 위반이 발생한 경우 (동시 요청 레이스)', async () => {
      const dupError = makeDupEntryError("Duplicate entry 'test@gmail.com' for key 'idx_unique_email'");
      mockUserRepository.save.mockRejectedValue(dupError);

      await expect(service.signUp({ email, password })).rejects.toThrow("이미 존재하는 이메일입니다.");
    });

    it('save에서 다른 유니크 제약 위반이 발생하면 그대로 전파한다', async () => {
      const dupError = makeDupEntryError("Duplicate entry 'x' for key 'some_other_index'");
      mockUserRepository.save.mockRejectedValue(dupError);

      await expect(service.signUp({ email, password })).rejects.toThrow(dupError);
    });

    it('save에서 유니크 제약과 무관한 에러가 발생하면 그대로 전파한다', async () => {
      const otherError = new Error('connection lost');
      mockUserRepository.save.mockRejectedValue(otherError);

      await expect(service.signUp({ email, password })).rejects.toThrow(otherError);
    });
  });

  describe('findOneByEmail', () =>{
    it('계정이 존재하는 경우', async () => {
      const email = 'test2@gmail.com';
      jest.spyOn(mockUserRepository, 'findOneBy').mockResolvedValue({ id: 1, email, password: '1234' });
      result = await service.findOneByEmail(email);
      expect(result.id).toBe(1);
      expect(result.email).toEqual(email);
    });

    it('계정이 존재하지 않는 경우', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);
      const email = 'test3@gmail.com';
      result = await service.findOneByEmail(email);
      expect(result).toBeNull();
    })
  });

  describe('findOneById', () => {
    it("ResponseDTO 확인", async () => {
      jest.spyOn(mockUserRepository, 'findOneBy').mockResolvedValue({id: 1, email: 'test@gmail.com', password:'233'});
      result = await service.findOneById(1);
      expect(result).toBeInstanceOf(ResponseUserDto);
    });
  });

});
