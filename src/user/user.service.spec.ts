import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';

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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    it('회원가입 성공', () => {
      dto = {email: 'test3@gmail.com', password: '1234'};
      result = service.signUp(dto);
      expect(result).toBe("new account : test3@gmail.com, 1234");
    });

    it('계정이 존재하는 경우', () => {
      dto = users[0];
      expect(() => service.signUp(dto)).toThrow('해당 이메일은 존재합니다.');
    });
  });

  describe('findOne', () =>{
    it('계정이 존재하는 경우', () => {
      const email = 'test@gmail.com';
      result = service.findOne(email);
      expect(result).toBeDefined();
      expect(result.userId).toBe(1);
    });

    it('계정이 존재하지 않는 경우', () => {
      const email = 'test3@gmail.com';
      result = service.findOne(email);
      expect(result).toBeUndefined();
    })
  });

});
