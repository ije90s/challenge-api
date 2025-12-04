import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
    create(dto: CreateUserDto){
        const { email, password } = dto;
        return `new account ${email}, ${password}`;
    }

    findOne(email: string){
        return `it's me: ${email}`;
    }
}
