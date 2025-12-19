import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { checkDate } from '../common/util';
import { InjectRepository } from '@nestjs/typeorm';
import { Challenge } from './entity/challenge.entity';
import { MoreThanOrEqual, Not, Repository } from 'typeorm';
import { ResponseChallengeDto } from './dto/response-challenge.dto';
import { ResponsePagingDto } from '../common/dto/response-paging.dto';

@Injectable()
export class ChallengeService {
    constructor(@InjectRepository(Challenge) private challengeRepository: Repository<Challenge>){}

    async findAll(page: number, limit: number): Promise<ResponsePagingDto<ResponseChallengeDto>>{
        page = page ?? 1;
        limit = limit ?? 10;
        const today = new Date();

        const [items, total] = await this.challengeRepository.findAndCount({
            where: { end_date: MoreThanOrEqual(today) },
            skip: (page - 1) * limit, 
            take: limit,
            order: {created_at: "DESC" },
        });

        const newItems = ResponseChallengeDto.fromEntity(items);
        const meta = ResponsePagingDto.metaOf(total, page, limit);
        
        return ResponsePagingDto.of<ResponseChallengeDto>({ items: newItems, meta });
    }

    async findOne(challengeId: number): Promise<ResponseChallengeDto | null> {
        const challenge = await this.challengeRepository.findOne({
            where: { id: challengeId },
        });
        return challenge ? ResponseChallengeDto.from(challenge) : null;
    }

    async findByTitle(challengeId: number, title: string): Promise<Challenge | null>{
        return await this.challengeRepository.findOneBy({ id: Not(challengeId), title })
    }

    async create(userId: number, dto: CreateChallengeDto): Promise<ResponseChallengeDto>{
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
        const savedChallenge = await this.challengeRepository.save(newChallenge);

        return ResponseChallengeDto.from(savedChallenge);
    }

    async update(challengeId: number, userId: number, dto: UpdateChallengeDto): Promise<ResponseChallengeDto> {
        const challenge = await this.findOne(challengeId);

        if (!challenge) {
            throw new NotFoundException("챌린지가 없습니다.");
        }

        if (challenge.author_id !== userId) {
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
        const savedChallenge = await this.challengeRepository.save(challenge);

        return ResponseChallengeDto.from(savedChallenge);
    }

    async delete(challengeId: number, userId: number): Promise<void> {
        // 챌린지 유무 확인
        const challenge = await this.findOne(challengeId);
        if(!challenge){
            throw new NotFoundException("챌린지가 없습니다.");
        }

        if(challenge.author_id !== userId){
            throw new ForbiddenException("작성자만 접근 가능합니다.");
        }

        await this.challengeRepository.softDelete({id: challengeId });
    }
}
