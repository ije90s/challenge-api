import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { FeedService } from './feed.service';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';

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

    @Post(":userId")
    createFeed(@Param("userId") userId: number, @Body() dto: CreateFeedDto){
        return this.feedService.create(userId, dto);
    }

    @Patch(":feedId")
    updateFeed(@Param("feedId") feedId: number, @Body() dto: UpdateFeedDto){
        return this.feedService.update(feedId, dto);
    }

    @Delete(":feedId")
    deleteFeed(@Param("feedId") feedId: number){
        return this.feedService.delete(feedId);
    }
}
