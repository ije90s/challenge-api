import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { ChallengeService } from '../challenge/challenge.service';
import { checkThePast } from '../common/util';
import { Feed } from './entity/feed.entity';
import { Not, QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ResponseFeedDto } from './dto/response-feed.dto';
import { ResponsePagingDto } from '../common/dto/response-paging.dto';

const DUPLICATE_TITLE_MESSAGE = "중복된 제목입니다.";
const UNIQUE_TITLE_INDEX = 'idx_unique_feed_title';
// MariaDB 중복키 메시지는 "Duplicate entry '<값>' for key '<인덱스명>'" 형태라, 인덱스명만
// bare substring으로 찾으면 입력값(title) 자체가 우연히 이 문자열을 포함할 때 오탐할 수 있다.
// "for key '...'" 형태까지 포함해 매칭해 값 구간과 키 구간을 구분한다.
const UNIQUE_TITLE_INDEX_KEY_SUFFIX = `for key '${UNIQUE_TITLE_INDEX}'`;

interface MysqlDriverError {
    code?: string;
    sqlMessage?: string;
}

@Injectable()
export class FeedService {

    constructor(
        private readonly challengeService: ChallengeService,
        @InjectRepository(Feed) private feedRepository: Repository<Feed>
    ){}

    // 위 findByTitle 사전 체크와 실제 save 사이의 레이스로 동시 요청이 모두 통과했을 경우,
    // DB 유니크 인덱스(idx_unique_feed_title)가 최종 방어선이 된다.
    private async saveOrThrowDuplicateTitle(feed: Feed): Promise<Feed> {
        try {
            return await this.feedRepository.save(feed);
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

    private getFileArr(images: Express.Multer.File[]): string[]{
        const fileNameArr: string[] = [];
        if(images){
            images.map(item => {
                fileNameArr.push(`uploads/feed/${item.filename}`);
            });
        }
        return fileNameArr;
    }
    
    async findAll(challengeId: number, page: number, limit: number): Promise<ResponsePagingDto<ResponseFeedDto>>{
        const [items, total] = await this.feedRepository.findAndCount({
            where: {challenge: {id : challengeId }},
            relations: ['user', 'challenge'],
            skip: (page-1) * limit,
            take: limit,
            order: { created_at: 'DESC' },
        });
        
        const newItems = ResponseFeedDto.fromEntity(items);
        const meta = ResponsePagingDto.metaOf(total, page, limit);
        
        return ResponsePagingDto.of<ResponseFeedDto>({ items: newItems, meta });
    }

    async findOne(feedId: number): Promise<Feed | null>{
        return await this.feedRepository.findOne({ 
            where: { id: feedId },
            relations: ['user', 'challenge'],
        });
    }

    async findByTitle(title: string, excludeId?: number): Promise<Feed | null>{
        return await this.feedRepository.findOne({
            where: {
                ...(excludeId !== undefined ? { id: Not(excludeId) } : {}),
                title,
            },
            withDeleted: true,
        });
    }

    async findOneById(feedId: number): Promise<ResponseFeedDto | null>{
        const feed = await this.findOne(feedId);
        return feed ? ResponseFeedDto.from(feed) : null;
    }

    async create(userId: number, dto: CreateFeedDto, images: Express.Multer.File[]): Promise<ResponseFeedDto>{
        const challenge = await this.challengeService.findOne(dto.challenge_id);
        if(!challenge){
            throw new NotFoundException("챌린지가 없습니다.");
        }

        if(!checkThePast(challenge.end_date)){
            throw new ConflictException("기간이 지났습니다.");
        }

        const feed = await this.findByTitle(dto.title);
        if(feed){
            throw new ConflictException(DUPLICATE_TITLE_MESSAGE);
        }

        dto.images = this.getFileArr(images);

        const newFeed = this.feedRepository.create({
            title: dto.title,
            content: dto.content,
            images: dto.images,
            user: { id: userId },
            challenge: { id: dto.challenge_id },
        });

        const savedFeed = await this.saveOrThrowDuplicateTitle(newFeed);

        return ResponseFeedDto.from(savedFeed);
    }

    async update(feedId: number, userId: number, dto: UpdateFeedDto, images: Express.Multer.File[]): Promise<ResponseFeedDto>{
        const feed = await this.findOne(feedId);
        if(!feed){
            throw new NotFoundException("피드가 없습니다.");
        }

        if(!feed.user || feed.user.id !== userId){
            throw new ForbiddenException("작성자만 접근 가능합니다.");
        }

        const checkTitle = await this.findByTitle(dto.title, feedId);
        if (checkTitle) {
            throw new ConflictException(DUPLICATE_TITLE_MESSAGE);
        }

        // 새 이미지가 없으면 기존 이미지 유지
        const newImages = this.getFileArr(images);
        dto.images = newImages.length > 0 ? newImages : (feed.images ?? []);

        Object.assign(feed, dto);
        const savedFeed = await this.saveOrThrowDuplicateTitle(feed);

        return ResponseFeedDto.from(savedFeed);
    }

    async delete(feedId: number, userId: number): Promise<void>{
        const feed = await this.findOne(feedId);
        if(!feed){
            throw new NotFoundException("피드가 없습니다.");
        }

        if(!feed.user || feed.user.id !== userId){
            throw new ForbiddenException("작성자만 접근 가능합니다.");
        }

        await this.feedRepository.softDelete({id: feedId });
    }
}
