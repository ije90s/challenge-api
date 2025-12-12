import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UserService,
        private readonly jwtService: JwtService
    ){}

    async signIn(dto: LoginUserDto){
        const {email, password } = dto;
        const user = await this.userService.findOneBy(email);
        if(!user){
            throw new UnauthorizedException("존재하지 않은 계정입니다.");
        }

        // TODO: 해시 처리 필요
        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch){
            throw new UnauthorizedException("비밀번호가 잘못되었습니다.");
        }

        const payload = { email: user.email, sub: user.user_id };

        return { access_token: this.jwtService.sign(payload) };
    }
}
