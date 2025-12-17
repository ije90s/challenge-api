import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { checkDate } from '../common/util';
import { InjectRepository } from '@nestjs/typeorm';
import { Challenge } from './entity/challenge.entity';
import { Not, Repository } from 'typeorm';

@Injectable()
export class ChallengeService {
    constructor(@InjectRepository(Challenge) private challengeRepository: Repository<Challenge>){}

    async findAll(): Promise<Challenge[] | null>{
        return await this.challengeRepository.find({
            order: {created_at: "DESC" },
        });
    }

    async findOne(challengeId: number): Promise<Challenge | null> {
        return await this.challengeRepository.findOne({
            where: { id: challengeId },
            //relations: ['author'],
        });
    }

    async findByTitle(challengeId: number, title: string): Promise<Challenge | null>{
        return await this.challengeRepository.findOneBy({ id: Not(challengeId), title })
    }

    async create(userId: number, dto: CreateChallengeDto): Promise<Challenge>{
        const {title, start_date, end_date } = dto;
 
        // 제목 중복 확인
        const challenge = await this.findByTitle(0, title);
        if(challenge){
            throw new UnauthorizedException("중복된 제목입니다.");
        }

        // 날짜 확인
        if(!checkDate(start_date, end_date)){
            throw new UnauthorizedException("날짜 설정이 잘못되었습니다.");
        }

        const newChallenge = this.challengeRepository.create({ ...dto, author: { id: userId } });

        return await this.challengeRepository.save(newChallenge);
    }

    async update(challengeId: number, userId: number, dto: UpdateChallengeDto): Promise<Challenge> {
        const challenge = await this.findOne(challengeId);

        if (!challenge) {
            throw new NotFoundException("챌린지가 없습니다.");
        }

        if (challenge.author.id !== userId) {
            throw new ForbiddenException("작성자만 접근 가능합니다.");
        }

        // 제목 중복 확인
        if (dto.title && dto.title !== challenge.title) {
            const exists = await this.findByTitle(challengeId, dto.title);
            if (exists) {
                throw new UnauthorizedException("중복된 제목입니다.");
            }
        }

        // 날짜 확인 (부분 수정 고려)
        const startDate = dto.start_date ?? challenge.start_date;
        const endDate = dto.end_date ?? challenge.end_date;

        if (!checkDate(startDate, endDate)) {
            throw new UnauthorizedException("날짜 설정이 잘못되었습니다.");
        }

        Object.assign(challenge, dto);

        return await this.challengeRepository.save(challenge);
    }

    async delete(challengeId: number, userId: number): Promise<void> {
        // 챌린지 유무 확인
        const challenge = await this.findOne(challengeId);
        if(!challenge){
            throw new NotFoundException("챌린지가 없습니다.");
        }

        if(challenge.author.id !== userId){
            throw new ForbiddenException("작성자만 접근 가능합니다.");
        }

        await this.challengeRepository.softDelete({id: challengeId });
    }
}
