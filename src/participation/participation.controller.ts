import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ParticipationService } from './participation.service';
import { UpdateParticipationDto } from './dto/update-participation.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt.auth.guard';
import { User } from '../common/user.decorator';
import { CreateParticipationDto } from './dto/create-participation.dto';
import { ResponseParticipationDto } from './dto/response-participation.dto';

@UseGuards(JwtAuthGuard)
@Controller('participation/challenge')
export class ParticipationController {

    constructor(private readonly participationService: ParticipationService){}
    
    @Post()
    async joinChallenge(@User() user, dto: CreateParticipationDto): Promise<ResponseParticipationDto>{
        return await this.participationService.create(user.userId, dto);
    }

    @Patch()
    async updateChallenge(@User() user, @Body() dto: UpdateParticipationDto): Promise<ResponseParticipationDto>{
        return await this.participationService.update(user.userId, dto);
    }

    @Patch("giveup")
    async giveupChallenge(@User() user, dto: UpdateParticipationDto): Promise<ResponseParticipationDto>{
        return await this.participationService.updateStatus(user.userId, dto);
    }

    @Get("rank/:challengeId")
    getChallengeRank(@Param("challengeId") challengeId: number, @User() user, @Query("page") page: number, @Query("limit") limit: number){
        return this.participationService.getChallengeRank(challengeId, user.userId, page, limit);
    }

    @Get("mine")
    getMyChallenge(@User() user, @Query("page") page: number, @Query("limit") limit: number){
        return this.participationService.getMyChallenge(user.userId, page, limit);
    }
}
