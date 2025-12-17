import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateParticipationDto } from './dto/create-participation.dto';
import { UpdateParticipationDto } from './dto/update-participation.dto';
import { ChallengeService } from '../challenge/challenge.service';
import { checkThePast } from '../common/util';
import { InjectRepository } from '@nestjs/typeorm';
import { Participation } from './entity/participation.entity';
import { Repository } from 'typeorm';


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
            //relations: ['challenge', 'user'],
        });
    }

    async create(userId: number, dto: CreateParticipationDto): Promise<Participation>{

        const challenge = await this.challegneService.findOne(dto.challenge_id);
        if(!challenge){
            throw new ForbiddenException("챌린지가 존재하지 않습니다.");
        }

        if(!checkThePast(challenge.end_date)){
            throw new UnauthorizedException("기간이 지났습니다.");
        }

        const participation = await this.findOne(dto.challenge_id, userId);
        if(participation){
            throw new UnauthorizedException("이미 참가중입니다.");
        }

        const newParticipation = this.participationRepository.create({ 
            challenge: { id: dto.challenge_id },
            user: { id: userId },
        });

        return await this.participationRepository.save(newParticipation);
    }

    async update(userId: number, dto: UpdateParticipationDto): Promise<Participation>{

        const challenge = await this.challegneService.findOne(dto.challenge_id!);
        if(!challenge){
            throw new NotFoundException("챌린지가 존재하지 않습니다.");
        }

        if(!checkThePast(challenge.end_date)){
            throw new BadRequestException("기간이 지났습니다.");
        }
        
        const participation = await this.findOne(dto.challenge_id!, userId);
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

        return await this.participationRepository.save(participation);
    }

    async updateStatus(userId: number, dto: UpdateParticipationDto): Promise<Participation>{
        
        const participation = await this.findOne(dto.challenge_id!, userId);
        if(!participation){
            throw new ForbiddenException("참가하지 않았습니다.");
        }

        if(participation.status === 1){
            throw new ConflictException("이미 챌린지 완료했습니다.");
        }

        const status = participation.status === 2 ? 0 : 2;
        participation.status = status;

        return await this.participationRepository.save(participation);
    }

    async getChallengeRank(challengeId: number, userId: number): Promise<Participation[]>{

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

        return await this.participationRepository
            .createQueryBuilder('p')
            .where('p.challenge_id = :challengeId', { challengeId })
            .orderBy(orderField, 'DESC')
            .addOrderBy('p.created_at', 'DESC')
            .getMany();
    }

    async getMyChallenge(userId: number): Promise<Participation[]>{
        return await this.participationRepository.find({
            where: {
                user: { id: userId },
            },
            order: { created_at: 'DESC' },
        });
    }
}
