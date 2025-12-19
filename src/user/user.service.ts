import { ConflictException, Injectable, } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm/repository/Repository';
import { User } from './entity/user.entity';
import { ResponseUserDto } from './dto/response-user.dto';

@Injectable()
export class UserService {
    constructor(@InjectRepository(User) private userRepository: Repository<User>){}

    async signUp(dto: CreateUserDto): Promise<ResponseUserDto>{
        const { email, password } = dto;
        
        // DB 연결 전 확인 
        const user = await this.findOneByEmail(email);
        if(user){
            throw new ConflictException("이미 존재하는 이메일입니다.");
        }

        //패스워드 해싱 처리
        const hasedPassword = await bcrypt.hash(password, 10);

        const newUser = this.userRepository.create({email, password: hasedPassword });
        const savedUser = await this.userRepository.save(newUser);
       
        return ResponseUserDto.from(savedUser);
    }

    async findOneByEmail(email: string): Promise<User | null>{
        return await this.userRepository.findOneBy({ email });
    }

    async findOneById(id: number): Promise<ResponseUserDto | null>{
        const user = await this.userRepository.findOneBy({id});
        return user ? ResponseUserDto.from(user) : null;
    }
}
