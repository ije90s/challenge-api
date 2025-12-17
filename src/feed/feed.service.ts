import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { ChallengeService } from '../challenge/challenge.service';
import { checkThePast } from '../common/util';
import { Feed } from './entity/feed.entity';
import { Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class FeedService {

    constructor(
        private readonly challengeService: ChallengeService,
        @InjectRepository(Feed) private feedRepository: Repository<Feed>
    ){}

    async findAll(challengeId: number): Promise<Feed[]>{
        return await this.feedRepository.find({
            where: {challenge: {id : challengeId }},
            order: { created_at: 'DESC' },
        });
    }

    async findOne(feedId: number): Promise<Feed | null>{
        return await this.feedRepository.findOne({ where: { id: feedId }});
    }

    async findByTitle(feedId: number, title: string): Promise<Feed | null>{
        return await this.feedRepository.findOneBy({ id: Not(feedId), title })
    }

    async create(userId: number, dto: CreateFeedDto, images: Express.Multer.File[]): Promise<Feed>{
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

        const newFeed = this.feedRepository.create({
            title: dto.title,
            content: dto.content,
            images: dto.images,
            user: { id: userId },
            challenge: { id: dto.challenge_id },
        });
        return await this.feedRepository.save(newFeed);
    }

    async update(feedId: number, userId: number, dto: UpdateFeedDto, images: Express.Multer.File[]): Promise<Feed>{
        const feed = await this.findOne(feedId);
        if(!feed){
            throw new UnauthorizedException("피드가 없습니다.");
        }

        if(feed.user.id !== userId){
            throw new ForbiddenException("작성자만 접근 가능합니다.");
        }
        
        const checkTitle = await this.findByTitle(feedId, dto.title);
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
        
        Object.assign(feed, dto);
        return await this.feedRepository.save(feed);
    }

    async delete(feedId: number, userId: number): Promise<void>{
        const feed = await this.findOne(feedId);
        if(!feed){
            throw new UnauthorizedException("피드가 없습니다.");
        }

        if(feed.user.id !== userId){
            throw new ForbiddenException("작성자만 접근 가능합니다.");
        }

        await this.feedRepository.softDelete({id: feedId });
    }
}
