import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ParticipationService } from './participation.service';
import { UpdateParticipationDto } from './dto/update-participation.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt.auth.guard';
import { User } from '../common/user.decorator';
import { ResponseParticipationDto } from './dto/response-participation.dto';
import { ResponsePagingDto } from '../common/dto/response-paging.dto';
import { RequestQueryDTO } from '../common/dto/request-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('participation/challenge')
export class ParticipationController {

    constructor(private readonly participationService: ParticipationService){}
    
    @Post(":challengeId")
    async joinChallenge(@User() user, @Param("challengeId", ParseIntPipe) challengeId: number): Promise<ResponseParticipationDto>{
        return await this.participationService.create(user.id, challengeId);
    }

    @Patch(":challengeId/giveup")
    async giveupChallenge(@User() user, @Param("challengeId", ParseIntPipe) challengeId: number): Promise<ResponseParticipationDto>{
        return await this.participationService.updateStatus(user.id, challengeId);
    }

    @Patch(":challengeId")
    async updateChallenge(@User() user, @Param("challengeId", ParseIntPipe) challengeId: number, @Body() dto: UpdateParticipationDto): Promise<ResponseParticipationDto>{
        return await this.participationService.update(user.id, challengeId, dto);
    }

    @Get(":challengeId/rank")
    async getChallengeRank(@Param("challengeId", ParseIntPipe) challengeId: number, @User() user, @Query() query: RequestQueryDTO): Promise<ResponsePagingDto<ResponseParticipationDto>>{
        return await this.participationService.getChallengeRank(challengeId, user.id, query.page, query.limit);
    }

    @Get("mine")
    async getMyChallenge(@User() user, @Query() query: RequestQueryDTO): Promise<ResponsePagingDto<ResponseParticipationDto>>{
        return await this.participationService.getMyChallenge(user.id, query.page, query.limit);
    }
}
