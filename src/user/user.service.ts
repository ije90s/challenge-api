import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
    private readonly users = [
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

    async signUp(dto: CreateUserDto){
        const { email, password } = dto;
        
        // DB 연결 전 확인 
        const user = this.findOne(email);
        if(user){
            throw new UnauthorizedException("해당 이메일은 존재합니다.");
        }

        //패스워드 해싱 처리
        const hasedPassword = await bcrypt.hash(password, 10);

        return `new account : ${email}, ${hasedPassword}`;
    }

    findOne(email: string){
        const user = this.users.find(u => u.email === email);
        return user;
    }
}
