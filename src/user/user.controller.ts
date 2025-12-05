import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthService } from '../auth/auth.service';
import { LoginUserDto } from '../auth/dto/login-user.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt.auth.guard';
import { User } from '../common/user.decorator';

@Controller('user')
export class UserController {

    constructor(
        private readonly userService: UserService,
        private readonly authService: AuthService
    ){}

    @Post()
    signUp(@Body() dto: CreateUserDto){
        return this.userService.signUp(dto);
    }

    @UseGuards(JwtAuthGuard)
    @Get("me")
    fineOne(@User() user){
        return user;
    }

    @Post("login")
    signIn(@Body() dto: LoginUserDto){
        return this.authService.signIn(dto);
    }

}
