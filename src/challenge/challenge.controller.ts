import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { ChallengeService } from './challenge.service';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { User } from '../common/user.decorator';
import { JwtAuthGuard } from '../auth/jwt/jwt.auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('challenge')
export class ChallengeController {

    constructor(private readonly challengeService: ChallengeService){}

    @Get()
    findAll(@Query('page') page: number, @Query('limit') limit: number){
        return this.challengeService.findAll(page, limit);
    }

    @Post()
    create(@User() user, @Body() dto: CreateChallengeDto){
        return this.challengeService.create(user.userId, dto);
    }

    @Patch(":challengeId")
    modify(@Param("challengeId") challengeId: number, @User() user, @Body() dto: UpdateChallengeDto){
        return this.challengeService.update(challengeId, user.userId, dto);
    }

    @Delete(":challengeId")
    delete(@Param("challengeId") challengeId: number, @User() user){
        return this.challengeService.delete(challengeId, user.userId);
    }

    @Get(":challengeId")
    findOne(@Param("challengeId") challengeId: number){
        return this.challengeService.findOne(challengeId);
    }
}
