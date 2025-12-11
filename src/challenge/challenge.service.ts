import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
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
            author: 1,
            title: '테스트',
            content: '테스트',
            start_date: '2025-12-01',
            end_date: '2025-12-31'
        },
        {
            challengeId: 2,
            type: 1, 
            mininum_count: 1,
            author: 2,
            title: '테스트2',
            content: '테스트2',
            start_date: '2025-12-01',
            end_date: '2025-12-20'
        },
    ];

    findAll(){
        return this.challenges;
    }

    findOne(challengeId: number){
        return this.challenges.find(challenge => challenge.challengeId == challengeId);
    }

    findByTitle(challengeId: number, title: string){
        return this.challenges.find(challenge => challenge.challengeId !== challengeId && challenge.title === title);
    }

    create(userId: number, dto: CreateChallengeDto){
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
            author: userId,
            ...dto,
        });

        return this.challenges[this.challenges.length-1];
    }

    update(challengeId: number, userId: number, dto: UpdateChallengeDto){
        const {title, content, start_date, end_date } = dto;
  
        const challenge = this.findOne(challengeId);
        if(!challenge){
            throw new UnauthorizedException("챌린지가 없습니다.");
        }

        if(challenge.author !== userId){
            throw new ForbiddenException("작성자만 접근 가능힙니다.");
        }

        // 제목 중복 확인
        if (title) {
            const checkTitle = this.findByTitle(challengeId, title);
            if (checkTitle) {
                throw new UnauthorizedException("중복된 제목입니다.");
            }
        }

        // 날짜 확인
        if(start_date && end_date && !checkDate(start_date, end_date)){
            throw new UnauthorizedException("날짜 설정이 잘못되었습니다.");
        }

        // 디폴트 지정 - 원 값으로 지정
        dto.title = title ?? challenge.title;
        dto.content = content ?? challenge.content;
        dto.start_date = start_date ?? challenge.start_date;
        dto.end_date = end_date ?? challenge.end_date;

        for(let item of this.challenges){
            if(item.challengeId === challengeId){
                item.title = dto.title;
                item.content = dto.content; 
                item.start_date = dto.start_date;
                item.end_date = dto.end_date;
            }
        }

        return this.findOne(challengeId);
    }

    delete(challengeId: number, userId: number){
        // 챌린지 유무 확인
        const challenge = this.findOne(challengeId);
        if(!challenge){
            throw new UnauthorizedException("챌린지가 없습니다.");
        }

        if(challenge.author !== userId){
            throw new ForbiddenException("작성자만 접근 가능합니다.");
        }

        const deleted = this.challenges.filter(item => item.challengeId !== challengeId);

        return deleted;
    }
}
