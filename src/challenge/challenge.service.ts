import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';

@Injectable()
export class ChallengeService {

    private readonly challenges = [
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

    async findOne(id: number){
        return await this.challenges.find(challenge => challenge.challengeId == id);
    }

    async findByTitle(title: string){
        return await this.challenges.find(challenge => challenge.title === title);
    }

    async create(dto: CreateChallengeDto){
        const {type, mininum_count, title, content, start_date, end_date } = dto;
        console.log(type, mininum_count, title, content, start_date, end_date);

        if(start_date > end_date){
            throw new UnauthorizedException();
        }

        // 제목 중복 확인
        const challenge = await this.findByTitle(title);
        if(challenge){
            throw new UnauthorizedException("중복된 제목입니다.");
        }

        return 'new challenge';
    }

    async update(dto: UpdateChallengeDto, id: number){
        const {title, content, start_date, end_date } = dto;
        console.log(title, content, start_date, end_date);
        // 제목 중복 확인
        const challenge = await this.findOne(id);
        if(!challenge){
            throw new UnauthorizedException("챌린지가 없습니다.");
        }

        if(challenge.title == title){
            throw new UnauthorizedException("중복된 제목입니다.");
        }

        // 날짜 체크 
        return `update challenge ${id}`;
    }

    async delete(id: number){
        // 챌린지 유무 확인
        const challenge = await this.findOne(id);
        if(!challenge){
            throw new UnauthorizedException("챌린지가 없습니다.");
        }

        return `delete challenge ${id}`;
    }

    async getRank(id: number){
        //챌린지 유무 확인
        const challenge = await this.findOne(id);
        if(!challenge){
            throw new UnauthorizedException("챌린지가 없습니다.");
        }
        return `rank in fo ${id}`;
    }
}
