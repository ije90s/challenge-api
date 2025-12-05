import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { LoginUserDto } from './dto/login-user.dto';

@Injectable()
export class AuthService {
    constructor(private readonly userService: UserService){}

    signIn(dto: LoginUserDto){
        const {email, password } = dto;
        const user = this.userService.findOne(email);
        if(!user){
            throw new UnauthorizedException("존재하지 않은 계정입니다.");
        }

        // TODO: 해시 처리 필요
        if(password !== user.password){
            throw new UnauthorizedException("비밀번호가 잘못되었습니다.");
        }

        return user;
    }
}
