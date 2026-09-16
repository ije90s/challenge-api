import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { checkDate } from '../common/util';
import { InjectRepository } from '@nestjs/typeorm';
import { Challenge } from './entity/challenge.entity';
import { MoreThanOrEqual, Not, QueryFailedError, Repository } from 'typeorm';
import { ResponseChallengeDto } from './dto/response-challenge.dto';
import { ResponsePagingDto } from '../common/dto/response-paging.dto';

const DUPLICATE_TITLE_MESSAGE = "중복된 제목입니다.";
const UNIQUE_TITLE_INDEX = 'idx_unique_challenge_title';
// MariaDB 중복키 메시지는 "Duplicate entry '<값>' for key '<인덱스명>'" 형태라, 인덱스명만
// bare substring으로 찾으면 입력값(title) 자체가 우연히 이 문자열을 포함할 때 오탐할 수 있다.
// "for key '...'" 형태까지 포함해 매칭해 값 구간과 키 구간을 구분한다.
const UNIQUE_TITLE_INDEX_KEY_SUFFIX = `for key '${UNIQUE_TITLE_INDEX}'`;

interface MysqlDriverError {
    code?: string;
    sqlMessage?: string;
}

@Injectable()
export class ChallengeService {
    constructor(@InjectRepository(Challenge) private challengeRepository: Repository<Challenge>){}

    // 위 findByTitle 사전 체크와 실제 save 사이의 레이스로 동시 요청이 모두 통과했을 경우,
    // DB 유니크 인덱스(idx_unique_challenge_title)가 최종 방어선이 된다.
    private async saveOrThrowDuplicateTitle(challenge: Challenge): Promise<Challenge> {
        try {
            return await this.challengeRepository.save(challenge);
        } catch (error) {
            const driverError = error instanceof QueryFailedError
                ? (error.driverError as MysqlDriverError)
                : undefined;
            if (driverError?.code === 'ER_DUP_ENTRY' && driverError.sqlMessage?.includes(UNIQUE_TITLE_INDEX_KEY_SUFFIX)) {
                throw new ConflictException(DUPLICATE_TITLE_MESSAGE);
            }
            throw error;
        }
    }

    async findAll(page: number, limit: number): Promise<ResponsePagingDto<ResponseChallengeDto>>{
        const today = new Date();

        const [items, total] = await this.challengeRepository.findAndCount({
            where: { end_date: MoreThanOrEqual(today) },
            relations: ["author"],
            skip: (page - 1) * limit, 
            take: limit,
            order: {created_at: "DESC" },
        });

        const newItems = ResponseChallengeDto.fromEntity(items);
        const meta = ResponsePagingDto.metaOf(total, page, limit);
        
        return ResponsePagingDto.of<ResponseChallengeDto>({ items: newItems, meta });
    }

    async findOne(challengeId: number): Promise<Challenge | null> {
        
        return await this.challengeRepository.findOne({
            where: { id: challengeId },
            relations: ["author"]
        });
    }

    async findByTitle(title: string, excludeId?: number): Promise<Challenge | null>{
        return await this.challengeRepository.findOne({
            where: {
                ...(excludeId !== undefined ? { id: Not(excludeId) } : {}),
                title,
            },
            withDeleted: true,
        });
    }

    async findOneById(challengeId: number): Promise<ResponseChallengeDto | null>{
        const challenge = await this.findOne(challengeId);

        return challenge ? ResponseChallengeDto.from(challenge) : null;
    }

    async create(userId: number, dto: CreateChallengeDto): Promise<ResponseChallengeDto>{
        const {title, start_date, end_date } = dto;
 
        // 제목 중복 확인
        const challenge = await this.findByTitle(title);
        if(challenge){
            throw new ConflictException(DUPLICATE_TITLE_MESSAGE);
        }

        // 날짜 확인
        if(!checkDate(start_date, end_date)){
            throw new BadRequestException("날짜 설정이 잘못되었습니다.");
        }

        const newChallenge = this.challengeRepository.create({ ...dto, author: { id: userId } });
        const savedChallenge = await this.saveOrThrowDuplicateTitle(newChallenge);

        return ResponseChallengeDto.from(savedChallenge);
    }

    async update(challengeId: number, userId: number, dto: UpdateChallengeDto): Promise<ResponseChallengeDto> {
        const challenge = await this.findOne(challengeId);

        if (!challenge) {
            throw new NotFoundException("챌린지가 없습니다.");
        }

        if (!challenge.author || challenge.author.id !== userId) {
            throw new ForbiddenException("작성자만 접근 가능합니다.");
        }

        // 제목 중복 확인
        if (dto.title && dto.title !== challenge.title) {
            const exists = await this.findByTitle(dto.title, challengeId);
            if (exists) {
                throw new ConflictException(DUPLICATE_TITLE_MESSAGE);
            }
        }

        // 날짜 확인 (부분 수정 고려)
        const startDate = dto.start_date ?? challenge.start_date;
        const endDate = dto.end_date ?? challenge.end_date;

        if (!checkDate(startDate, endDate)) {
            throw new BadRequestException("날짜 설정이 잘못되었습니다.");
        }

        Object.assign(challenge, dto);
        const savedChallenge = await this.saveOrThrowDuplicateTitle(challenge);

        return ResponseChallengeDto.from(savedChallenge);
    }

    async delete(challengeId: number, userId: number): Promise<void> {
        // 챌린지 유무 확인
        const challenge = await this.findOne(challengeId);
        if(!challenge){
            throw new NotFoundException("챌린지가 없습니다.");
        }

        if(!challenge.author || challenge.author.id !== userId){
            throw new ForbiddenException("작성자만 접근 가능합니다.");
        }

        await this.challengeRepository.softDelete({id: challengeId });
    }
}
