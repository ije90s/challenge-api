import { ConflictException, Injectable, } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm/repository/Repository';
import { QueryFailedError } from 'typeorm';
import { User } from './entity/user.entity';
import { ResponseUserDto } from './dto/response-user.dto';

const ALREADY_EXISTING_EMAIL_MESSAGE = "이미 존재하는 이메일입니다.";
const UNIQUE_EMAIL_INDEX = 'idx_unique_email';

interface MysqlDriverError {
    code?: string;
    sqlMessage?: string;
}

@Injectable()
export class UserService {
    constructor(@InjectRepository(User) private userRepository: Repository<User>){}

    async signUp(dto: CreateUserDto): Promise<ResponseUserDto>{
        const { email, password } = dto;

        // DB 연결 전 확인
        const user = await this.findOneByEmail(email);
        if(user){
            throw new ConflictException(ALREADY_EXISTING_EMAIL_MESSAGE);
        }

        //패스워드 해싱 처리
        const hasedPassword = await bcrypt.hash(password, 10);

        const newUser = this.userRepository.create({email, password: hasedPassword });

        try {
            const savedUser = await this.userRepository.save(newUser);
            return ResponseUserDto.from(savedUser);
        } catch (error) {
            // 위 findOneByEmail 사전 체크와 실제 insert 사이의 레이스로 동시 요청이 모두
            // 통과했을 경우, DB 유니크 인덱스(idx_unique_email)가 최종 방어선이 된다.
            const driverError = error instanceof QueryFailedError
                ? (error.driverError as MysqlDriverError)
                : undefined;
            if (driverError?.code === 'ER_DUP_ENTRY' && driverError.sqlMessage?.includes(UNIQUE_EMAIL_INDEX)) {
                throw new ConflictException(ALREADY_EXISTING_EMAIL_MESSAGE);
            }
            throw error;
        }
    }

    async findOneByEmail(email: string): Promise<User | null>{
        return await this.userRepository.findOneBy({ email });
    }

    async findOneById(id: number): Promise<ResponseUserDto | null>{
        const user = await this.userRepository.findOneBy({id});
        return user ? ResponseUserDto.from(user) : null;
    }
}
