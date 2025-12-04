import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('user')
export class UserController {

    constructor(private readonly userService: UserService){}

    @Post()
    create(@Body() dto: CreateUserDto){
        return this.userService.create(dto);
    }

    @Get("me/:id")
    fineOne(@Param("id") id: string){
        return this.userService.findOne(id);
    }

    @Post("login")
    login(@Body() dto){
        return "login"
    }

}
