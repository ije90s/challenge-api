import { Body, Controller, Delete, Get, Param, Patch, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FeedService } from './feed.service';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { multerOptions } from "../common/util";
import { JwtAuthGuard } from '../auth/jwt/jwt.auth.guard';
import { User } from '../common/user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('feed')
export class FeedController {

    constructor(private readonly feedService: FeedService){}

    @Get("challenge/:challengeId")
    findAll(@Param("challengeId") challengeId: number){
        return this.feedService.findAll(challengeId);
    }

    @Get(":feedId")
    findOne(@Param("feedId") feedId: number){
        return this.feedService.findOne(feedId);
    }

    // TODO: multer 예외 처리 추가 
    @Post()
    @UseInterceptors(FilesInterceptor('images', 3, multerOptions("feed")))
    createFeed(@User() user, @Body() dto: CreateFeedDto, @UploadedFiles() images: Array<Express.Multer.File>){
        return this.feedService.create(user.userId, dto, images);
    }

    @Patch(":feedId")
    @UseInterceptors(FilesInterceptor('images', 3, multerOptions("feed")))
    updateFeed(@Param("feedId") feedId: number, @Body() dto: UpdateFeedDto, @UploadedFiles() images: Array<Express.Multer.File>){
        return this.feedService.update(feedId, dto, images);
    }

    @Delete(":feedId")
    deleteFeed(@Param("feedId") feedId: number){
        return this.feedService.delete(feedId);
    }
}
