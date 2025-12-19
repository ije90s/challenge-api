import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { ChallengeService } from '../challenge/challenge.service';
import { checkThePast } from '../common/util';
import { Feed } from './entity/feed.entity';
import { Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ResponseFeedDto } from './dto/response-feed.dto';

@Injectable()
export class FeedService {

    constructor(
        private readonly challengeService: ChallengeService,
        @InjectRepository(Feed) private feedRepository: Repository<Feed>
    ){}

    private getFileArr(images: Express.Multer.File[]): string[]{
        const fileNameArr: string[] = [];
        if(images){
            images.map(item => {
                fileNameArr.push(`feed/${item.filename}`);
            });
        }
        return fileNameArr;
    }
    
    async findAll(challengeId: number, page: number, limit: number){
        page = page ?? 1;
        limit = limit ?? 10;
        const [items, total] = await this.feedRepository.findAndCount({
            where: {challenge: {id : challengeId }},
            skip: (page-1) * limit,
            take: limit,
            order: { created_at: 'DESC' },
        });

        return {
            items,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total/limit),
            }
        }
    }

    async findOne(feedId: number): Promise<ResponseFeedDto | null>{
        const feed = await this.feedRepository.findOne({ where: { id: feedId }});
        return feed ? ResponseFeedDto.from(feed) : null;
    }

    async findByTitle(feedId: number, title: string): Promise<ResponseFeedDto | null>{
        const feed = await this.feedRepository.findOneBy({ id: Not(feedId), title });
        return feed ? ResponseFeedDto.from(feed) : null;
    }

    async create(userId: number, dto: CreateFeedDto, images: Express.Multer.File[]): Promise<ResponseFeedDto>{
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
        
        dto.images = this.getFileArr(images);

        const newFeed = this.feedRepository.create({
            title: dto.title,
            content: dto.content,
            images: dto.images,
            user: { id: userId },
            challenge: { id: dto.challenge_id },
        });

        const savedFeed = await this.feedRepository.save(newFeed);

        return ResponseFeedDto.from(savedFeed);
    }

    async update(feedId: number, userId: number, dto: UpdateFeedDto, images: Express.Multer.File[]): Promise<ResponseFeedDto>{
        const feed = await this.findOne(feedId);
        if(!feed){
            throw new UnauthorizedException("피드가 없습니다.");
        }

        if(feed.user_id !== userId){
            throw new ForbiddenException("작성자만 접근 가능합니다.");
        }
        
        const checkTitle = await this.findByTitle(feedId, dto.title);
        if (checkTitle) {
            throw new UnauthorizedException("중복된 제목입니다.");
        }

        // 기존 이미지는 삭제 > 새 이미지 업로드    
        dto.images = this.getFileArr(images) ?? feed.images;
        
        Object.assign(feed, dto);
        const savedFeed = await this.feedRepository.save(feed);

        return ResponseFeedDto.from(savedFeed);
    }

    async delete(feedId: number, userId: number): Promise<void>{
        const feed = await this.findOne(feedId);
        if(!feed){
            throw new UnauthorizedException("피드가 없습니다.");
        }

        if(feed.user_id !== userId){
            throw new ForbiddenException("작성자만 접근 가능합니다.");
        }

        await this.feedRepository.softDelete({id: feedId });
    }
}
