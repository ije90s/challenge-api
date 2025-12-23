import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFiles, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { FeedService } from './feed.service';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { multerOptions } from "../common/util";
import { JwtAuthGuard } from '../auth/jwt/jwt.auth.guard';
import { User } from '../common/user.decorator';
import { ResponseFeedDto } from './dto/response-feed.dto';
import { ResponsePagingDto } from '../common/dto/response-paging.dto';
import { RequestQueryDTO } from '../common/dto/request-query.dto';
import { MulterExceptionFilter } from '../common/filter/multer.exception.filter';

@UseGuards(JwtAuthGuard)
@Controller('feed')
export class FeedController {

    constructor(private readonly feedService: FeedService){}

    @Get("challenge/:challengeId/feeds")
    async findAll(@Param("challengeId", ParseIntPipe) challengeId: number, @Query() query: RequestQueryDTO): Promise<ResponsePagingDto<ResponseFeedDto>>{
        return await this.feedService.findAll(challengeId, query.page, query.limit);
    }

    @Get(":feedId")
    async findOne(@Param("feedId", ParseIntPipe) feedId: number): Promise<ResponseFeedDto | null>{
        return await this.feedService.findOneById(feedId);
    }

    @Post()
    @UseFilters(MulterExceptionFilter)
    @UseInterceptors(FilesInterceptor('images', 3, multerOptions("feed")))
    async createFeed(@User() user, @Body() dto: CreateFeedDto, @UploadedFiles() images: Array<Express.Multer.File>): Promise<ResponseFeedDto>{
        return await this.feedService.create(user.id, dto, images);
    }

    @Patch(":feedId")
    @UseFilters(MulterExceptionFilter)
    @UseInterceptors(FilesInterceptor('images', 3, multerOptions("feed")))
    async updateFeed(@Param("feedId", ParseIntPipe) feedId: number, @User() user, @Body() dto: UpdateFeedDto, @UploadedFiles() images: Array<Express.Multer.File>): Promise<ResponseFeedDto>{
        return await this.feedService.update(feedId, user.id, dto, images);
    }

    @Delete(":feedId")
    async deleteFeed(@Param("feedId", ParseIntPipe) feedId: number, @User() user): Promise<void> {
        return await this.feedService.delete(feedId, user.id);
    }
}
