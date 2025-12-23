import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UpdateParticipationDto } from './dto/update-participation.dto';
import { ChallengeService } from '../challenge/challenge.service';
import { checkThePast } from '../common/util';
import { InjectRepository } from '@nestjs/typeorm';
import { Participation } from './entity/participation.entity';
import { Repository } from 'typeorm';
import { ResponseParticipationDto } from './dto/response-participation.dto';
import { ResponsePagingDto } from '../common/dto/response-paging.dto';


@Injectable()
export class ParticipationService {

    constructor(
        private readonly challegneService: ChallengeService,
        @InjectRepository(Participation) private participationRepository: Repository<Participation>
    ){}

    async findOne(challengeId: number, userId: number): Promise<Participation | null>{
        return await this.participationRepository.findOne({
            where: {
                challenge: { id: challengeId },
                user: { id: userId },
            },
            relations: ['challenge', 'user'],
        });
    }

    async create(userId: number, challengeId: number): Promise<ResponseParticipationDto>{

        const challenge = await this.challegneService.findOne(challengeId);
        if(!challenge){
            throw new ForbiddenException("챌린지가 존재하지 않습니다.");
        }

        if(!checkThePast(challenge.end_date)){
            throw new UnauthorizedException("기간이 지났습니다.");
        }

        const participation = await this.findOne(challengeId, userId);
        if(participation){
            throw new UnauthorizedException("이미 참가중입니다.");
        }

        const newParticipation = this.participationRepository.create({ 
            challenge: { id: challengeId },
            user: { id: userId },
        });

        const savedParticipation = await this.participationRepository.save(newParticipation);

        return ResponseParticipationDto.from(savedParticipation);
    }

    async update(userId: number, challengeId: number, dto: UpdateParticipationDto): Promise<ResponseParticipationDto>{

        const challenge = await this.challegneService.findOne(challengeId);
        if(!challenge){
            throw new NotFoundException("챌린지가 존재하지 않습니다.");
        }

        if(!checkThePast(challenge.end_date)){
            throw new BadRequestException("기간이 지났습니다.");
        }
        
        const participation = await this.findOne(challengeId, userId);
        if(!participation){
            throw new ForbiddenException("참가하지 않았습니다.");
        }
        
        if(participation.status === 2){
            throw new ConflictException("챌린지 포기 상태입니다.");
        }

        const score = dto.score ?? 0;
        const count = dto.challenge_count ?? 0;
        const total = challenge.type === 0 ? score + participation.score : count + participation.challenge_count;
        if (participation.status !== 1 && challenge.mininum_count <= total) {
            participation.status = 1;
            participation.complete_date = new Date();
        }
    
        participation.score+=score;
        participation.challenge_count+=count;

        const savedParticipation = await this.participationRepository.save(participation);
        return ResponseParticipationDto.from(savedParticipation);
    }

    async updateStatus(userId: number, challengeId: number): Promise<ResponseParticipationDto>{
        
        const participation = await this.findOne(challengeId, userId);
        if(!participation){
            throw new ForbiddenException("참가하지 않았습니다.");
        }

        if(participation.status === 1){
            throw new ConflictException("이미 챌린지 완료했습니다.");
        }

        const status = participation.status === 2 ? 0 : 2;
        participation.status = status;

        const savedParticipation = await this.participationRepository.save(participation);

        return ResponseParticipationDto.from(savedParticipation);
    }

    async getChallengeRank(challengeId: number, userId: number, page: number, limit: number): Promise<ResponsePagingDto<ResponseParticipationDto>>{

        const challenge = await this.challegneService.findOne(challengeId);
        if(!challenge){
            throw new NotFoundException("챌린지가 존재하지 않습니다.");
        }

        const participation = await this.findOne(challengeId, userId);
        if(!participation){
            throw new ForbiddenException("참가하지 않았습니다.");
        }

        // 타입에 따라 정렬
        const orderField = challenge.type === 0 ? 'p.score' : 'p.challenge_count';
        const [items, total] = await this.participationRepository
            .createQueryBuilder('p')
            .where('p.challenge_id = :challengeId', { challengeId })
            .orderBy(orderField, 'DESC')
            .addOrderBy('p.created_at', 'DESC')
            .skip((page-1)*limit)
            .take(limit)
            .getManyAndCount();

        const newItems = ResponseParticipationDto.fromEntity(items);
        const meta = ResponsePagingDto.metaOf(total, page, limit);
                
        return ResponsePagingDto.of<ResponseParticipationDto>({ items: newItems, meta });
    }

    async getMyChallenge(userId: number, page: number, limit: number): Promise<ResponsePagingDto<ResponseParticipationDto>>{
        const [items, total] = await this.participationRepository.findAndCount({
            where: { user: { id: userId }, },
            skip: (page-1)*limit,
            take: limit,
            order: { created_at: 'DESC' },
        });

        const newItems = ResponseParticipationDto.fromEntity(items);
        const meta = ResponsePagingDto.metaOf(total, page, limit);
                
        return ResponsePagingDto.of<ResponseParticipationDto>({ items: newItems, meta });
    }
}
