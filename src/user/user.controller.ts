import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthService } from '../auth/auth.service';
import { LoginUserDto } from '../auth/dto/login-user.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt.auth.guard';
import { User } from '../common/user.decorator';
import { ResponseUserDto } from './dto/response-user.dto';

@Controller('user')
export class UserController {

    constructor(
        private readonly userService: UserService,
        private readonly authService: AuthService
    ){}

    @Post()
    async signUp(@Body() dto: CreateUserDto): Promise<ResponseUserDto>{
        return await this.userService.signUp(dto);
    }

    @UseGuards(JwtAuthGuard)
    @Get("me")
    async fineOne(@User() user): Promise<ResponseUserDto | null>{
        return await this.userService.findOneById(user.id);
    }

    @Post("login")
    signIn(@Body() dto: LoginUserDto){
        return this.authService.signIn(dto);
    }

}
