import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('UserService', () => {
  let service: UserService;
  let users: any[];
  let result: any;
  let dto: any;
 
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService],
    }).compile();

    service = module.get<UserService>(UserService);
    users = [
        {
        userId: 1,
        email: 'test@gmail.com',
        password: '1234',
        },
        {
        userId: 2,
        email: 'test2@gmail.com',
        password: 'guess',
        },
    ];
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    it('회원가입 성공', async () => {
      dto = { userId: 1, email: 'test3@gmail.com', password: '1234'};
      (bcrypt.hash as jest.Mock).mockReturnValue('hashed-1234');

      const result = await service.signUp(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(result).toBe(`new account : test3@gmail.com, hashed-1234`);
    });

    it('계정이 존재하는 경우', async () => {
      dto = users[0];
      await expect(() => service.signUp(dto)).rejects.toThrow('해당 이메일은 존재합니다.');
    });
  });

  describe('findOne', () =>{
    it('계정이 존재하는 경우', async () => {
      const email = 'test@gmail.com';
      result = await service.findOne(email);
      expect(result).toBeDefined();
      expect(result.userId).toBe(1);
    });

    it('계정이 존재하지 않는 경우', async () => {
      const email = 'test3@gmail.com';
      result = await service.findOne(email);
      expect(result).toBeUndefined();
    })
  });

});
