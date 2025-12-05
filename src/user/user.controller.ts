import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthService } from 'src/auth/auth.service';
import { LoginUserDto } from 'src/auth/dto/login-user.dto';

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

    @Get("me/:id")
    fineOne(@Param("id") id: string){
        return this.userService.findOne(id);
    }

    @Post("login")
    login(@Body() dto: LoginUserDto){
        return this.authService.signIn(dto);
    }

}
