import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthService } from 'src/auth/auth.service';
import { LoginUserDto } from 'src/auth/dto/login-user.dto';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt/jwt.auth.guard';
import { User } from 'src/common/user.decorator';

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
    login(@Body() dto: LoginUserDto){
        return this.authService.signIn(dto);
    }

}
