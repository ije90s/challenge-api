import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { checkDate } from '../common/util';

@Injectable()
export class ChallengeService {

    private challenges = [
        {
            challengeId: 1,
            type: 0, 
            mininum_count: 1,
            title: '테스트',
            content: '테스트',
            start_date: '2025-12-01',
            end_date: '2025-12-31'
        },
        {
            challengeId: 2,
            type: 1, 
            mininum_count: 1,
            title: '테스트2',
            content: '테스트2',
            start_date: '2025-12-01',
            end_date: '2025-12-20'
        },
    ];

    findAll(){
        return this.challenges;
    }

    findOne(id: number){
        return this.challenges.find(challenge => challenge.challengeId == id);
    }

    findByTitle(id: number, title: string){
        return this.challenges.find(challenge => challenge.challengeId !== id && challenge.title === title);
    }

    create(dto: CreateChallengeDto){
        const {title, start_date, end_date } = dto;
 
        // 제목 중복 확인
        const challenge = this.findByTitle(0, title);
        if(challenge){
            throw new UnauthorizedException("중복된 제목입니다.");
        }

        // 날짜 확인
        if(!checkDate(start_date, end_date)){
            throw new UnauthorizedException("날짜 설정이 잘못되었습니다.");
        }

        const lastValue = this.challenges[this.challenges.length-1];
        this.challenges.push({
            challengeId: lastValue?.challengeId+1,
            ...dto,
        });

        return this.challenges[this.challenges.length-1];
    }

    update(dto: UpdateChallengeDto, id: number){
        const {title, content, start_date, end_date } = dto;
  
        // 제목 중복 확인
        const challenge = this.findOne(id);
        if(!challenge){
            throw new UnauthorizedException("챌린지가 없습니다.");
        }

        if (title) {
            const checkTitle = this.findByTitle(id, title);
            if (checkTitle) {
                throw new UnauthorizedException("중복된 제목입니다.");
            }
        }

        // 날짜 확인
        if(start_date && end_date && !checkDate(start_date, end_date)){
            throw new UnauthorizedException("날짜 설정이 잘못되었습니다.");
        }

        const updated = this.challenges.map(item => item.challengeId === id ? 
            { ...item, title, content, start_date, end_date } : item );

        return updated;
    }

    delete(id: number){
        // 챌린지 유무 확인
        const challenge = this.findOne(id);
        if(!challenge){
            throw new UnauthorizedException("챌린지가 없습니다.");
        }

        const deleted = this.challenges.filter(item => item.challengeId !== id);

        return deleted;
    }
}
