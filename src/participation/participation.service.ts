import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateParticipationDto } from './dto/create-participation.dto';
import { UpdateParticipationDto } from './dto/update-participation.dto';
import { ChallengeService } from '../challenge/challenge.service';
import { checkThePast } from '../common/util';


@Injectable()
export class ParticipationService {

    constructor(private readonly challegneService: ChallengeService){}

    private participations = [
        {
            participation_id: 1,
            user_id: 1,
            challenge_id: 1,
            score: 0,
            challenge_count: 0,
            status: 0,
            complete_date: ''
        },
        {
            participation_id: 2,
            user_id: 2,
            challenge_id: 1,
            score: 2,
            challenge_count: 0, 
            status: 0,
            complete_date: ''
        },
        {
            participation_id: 3,
            user_id: 3,
            challenge_id: 1,
            score: 2,
            challenge_count: 0, 
            status: 2,
            complete_date: ''
        }
    ];

    findOne(challengeId: number, userId: number){
        return this.participations.find(item => item.challenge_id === challengeId && item.user_id === userId);
    }

    async create(challengeId: number, userId: number, dto: CreateParticipationDto){

        const challenge = await this.challegneService.findOne(challengeId);
        if(!challenge){
            throw new UnauthorizedException("챌린지가 존재하지 않습니다.");
        }

        if(!checkThePast(challenge.end_date)){
            throw new UnauthorizedException("기간이 지났습니다.");
        }

        const participation = await this.findOne(challengeId, userId);
        if(participation){
            throw new UnauthorizedException("이미 참가중입니다.");
        }

        // 디폴트 지정
        dto.score = dto.score ?? 0;
        dto.challenge_count = dto.challenge_count ?? 0;
        dto.status = dto.status ?? 0;
        dto.complete_date = dto.complete_date ?? '';

        const lastValue = this.participations[this.participations.length-1];
        this.participations.push({
            participation_id: lastValue.participation_id + 1,
            user_id: userId,
            challenge_id: challengeId,
            score: dto.score,
            challenge_count: dto.challenge_count,
            status: dto.status,
            complete_date: dto.complete_date
        });

        return this.participations[this.participations.length-1];
    }

    async update(challengeId: number, userId: number, dto: UpdateParticipationDto){

        const challenge = await this.challegneService.findOne(challengeId);
        if(!challenge){
            throw new UnauthorizedException("챌린지가 존재하지 않습니다.");
        }

        if(!checkThePast(challenge.end_date)){
            throw new UnauthorizedException("기간이 지났습니다.");
        }
        
        const participation = await this.findOne(challengeId, userId);
        if(!participation){
            throw new UnauthorizedException("참가하지 않았습니다.");
        }
        
        if(participation.status === 2){
            throw new UnauthorizedException("챌린지 포기 상태입니다.");
        }

        // 디폴트 지정 - 원 값으로 지정
        dto.score = dto.score ?? participation.score;
        dto.challenge_count = dto.challenge_count ?? participation.challenge_count;
        dto.status = dto.status ?? participation.status;
        dto.complete_date = dto.complete_date ?? participation.complete_date;
        
        const updated = this.participations.map(item => item.challenge_id === challengeId && item.user_id === userId ? 
            { ...item, score: dto.score, challenge_count: dto.challenge_count, status: dto.status, complete_date: dto.complete_date } : item );

        return updated;
    }

    async updateStatus(challengeId: number, userId: number){
        
        const participation = await this.findOne(challengeId, userId);
        if(!participation){
            throw new UnauthorizedException("참가하지 않았습니다.");
        }

        const status = participation.status === 2 ? 0 : 2;

        this.participations = this.participations.map(item =>
        item.challenge_id === challengeId && item.user_id === userId
            ? { ...item, status }
            : item
        );

        return this.participations;

    }

    async getChallengeRank(challengeId: number, userId: number){

        const participation = await this.findOne(challengeId, userId);
        if(!participation){
            throw new UnauthorizedException("참가하지 않았습니다.");
        }

        const list = this.participations.filter(item => item.challenge_id === challengeId).sort((a, b) => b.participation_id - a.participation_id);

        return list;
    }

    getMyChallenge(userId: number){
        return this.participations.find(item => item.user_id == userId);
    }
}
