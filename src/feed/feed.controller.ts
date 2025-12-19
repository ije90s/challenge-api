import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FeedService } from './feed.service';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { multerOptions } from "../common/util";
import { JwtAuthGuard } from '../auth/jwt/jwt.auth.guard';
import { User } from '../common/user.decorator';
import { ResponseFeedDto } from './dto/response-feed.dto';
import { ResponsePagingDto } from 'src/common/dto/response-paging.dto';

@UseGuards(JwtAuthGuard)
@Controller('feed')
export class FeedController {

    constructor(private readonly feedService: FeedService){}

    @Get("challenge/:challengeId")
    async findAll(@Param("challengeId") challengeId: number, @Query("page") page: number, @Query("limit") limit: number): Promise<ResponsePagingDto<ResponseFeedDto>>{
        return await this.feedService.findAll(challengeId, page, limit);
    }

    @Get(":feedId")
    async findOne(@Param("feedId") feedId: number): Promise<ResponseFeedDto | null>{
        return await this.feedService.findOne(feedId);
    }

    // TODO: multer 예외 처리 추가 
    @Post()
    @UseInterceptors(FilesInterceptor('images', 3, multerOptions("feed")))
    async createFeed(@User() user, @Body() dto: CreateFeedDto, @UploadedFiles() images: Array<Express.Multer.File>): Promise<ResponseFeedDto>{
        return await this.feedService.create(user.userId, dto, images);
    }

    @Patch(":feedId")
    @UseInterceptors(FilesInterceptor('images', 3, multerOptions("feed")))
    async updateFeed(@Param("feedId") feedId: number, @User() user, @Body() dto: UpdateFeedDto, @UploadedFiles() images: Array<Express.Multer.File>): Promise<ResponseFeedDto>{
        return await this.feedService.update(feedId, user.userId, dto, images);
    }

    @Delete(":feedId")
    async deleteFeed(@Param("feedId") feedId: number, @User() user): Promise<void> {
        return await this.feedService.delete(feedId, user.userId);
    }
}
