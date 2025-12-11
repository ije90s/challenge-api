import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { ChallengeService } from '../challenge/challenge.service';
import { checkThePast } from '../common/util';

type Feed = {
    feed_id: number;
    author: number;
    challenge_id: number;
    title: string;
    content: string;
    images: string[];
}

@Injectable()
export class FeedService {

    constructor(private readonly challengeService: ChallengeService){}

        private feeds: Feed[] = [
        {
            feed_id: 1,
            author: 1, 
            challenge_id: 1, 
            title: "테스트",
            content: "테스트",
            images: []
        },
        {
            feed_id: 2,
            author: 2, 
            challenge_id: 1, 
            title: "테스트2",
            content: "테스트2",
            images: []
        },
    ];

    findAll(challengeId: number){
        return this.feeds.filter(item => item.challenge_id === challengeId);
    }

    findOne(feedId: number){
        return this.feeds.find(item => item.feed_id === feedId);
    }

    findByTitle(feedId: number, title: string){
        return this.feeds.find(item => item.feed_id !== feedId && item.title === title);
    }

    async create(userId: number, dto: CreateFeedDto, images: Express.Multer.File[]){
        const challenge = await this.challengeService.findOne(dto.challenge_id);
        if(!challenge){
            throw new UnauthorizedException("챌린지가 없습니다.");
        }

        if(!checkThePast(challenge.end_date)){
            throw new UnauthorizedException("기간이 지났습니다.");
        }

        const feed = await this.findByTitle(0, dto.title);
        if(feed){
            throw new UnauthorizedException("중복된 제목입니다.");
        }

        const fileNameArr: string[] = [];
        if(images){
            images.map(item => {
                fileNameArr.push(`feed/${item.filename}`);
            });
        }
        dto.images = fileNameArr;

        const lastValue = this.feeds[this.feeds.length-1];
        this.feeds.push({
            feed_id: lastValue.feed_id+ 1,
            author: userId,
            challenge_id: dto.challenge_id,
            title: dto.title,
            content: dto.content,
            images: dto.images
        });

        return this.feeds[this.feeds.length-1];
    }

    async update(feedId: number, userId: number, dto: UpdateFeedDto, images: Express.Multer.File[]){
        const feed = await this.findOne(feedId);
        if(!feed){
            throw new UnauthorizedException("피드가 없습니다.");
        }

        if(feed.author !== userId){
            throw new ForbiddenException("작성자만 접근 가능합니다.");
        }
        
        const checkTitle = this.findByTitle(feedId, dto.title);
        if (checkTitle) {
            throw new UnauthorizedException("중복된 제목입니다.");
        }

        // 기존 이미지는 삭제 > 새 이미지 업로드
        const fileNameArr: string[] = [];
        if(images){
            images.map(item => {
                fileNameArr.push(`feed/${item.filename}`);
            });
        };
    
        dto.images = fileNameArr ?? feed.images;
        for(let item of this.feeds){
            if (item.feed_id === feedId){
                item.title = dto.title;
                item.content = dto.content;
                item.images = dto.images;
            }
        }
  
        return this.findOne(feedId);

    }

    async delete(feedId: number, userId: number){
        const feed = await this.findOne(feedId);
        if(!feed){
            throw new UnauthorizedException("피드가 없습니다.");
        }

        if(feed.author !== userId){
            throw new ForbiddenException("작성자만 접근 가능합니다.");
        }

        this.feeds = this.feeds.filter(item => item.feed_id !== feedId);

        return this.feeds;
    }


}
