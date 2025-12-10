import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CreateParticipationDto } from './dto/create-participation.dto';
import { ParticipationService } from './participation.service';
import { UpdateParticipationDto } from './dto/update-participation.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt.auth.guard';
import { User } from '../common/user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('participation')
export class ParticipationController {

    constructor(private readonly participationService: ParticipationService){}
    
    @Post("challenge/:challengeId")
    joinChallenge(@Param("challengeId") challengeId: number, @User() user, @Body() dto: CreateParticipationDto){
        return this.participationService.create(challengeId, user.userId, dto);
    }

    @Patch("challenge/:challengeId")
    updateChallenge(@Param("challengeId") challengeId: number, @User() user, @Body() dto: UpdateParticipationDto){
        return this.participationService.update(user.userId, challengeId, dto);
    }

    @Patch("giveup/:challengeId")
    giveupChallenge(@Param("challengeId") challengeId: number, @User() user){
        return this.participationService.updateStatus(challengeId, user.userId);
    }

    @Get("rank/:challengeId")
    getChallengeRank(@Param("challengeId") challengeId: number, @User() user){
        return this.participationService.getChallengeRank(challengeId, user.userId);
    }

    @Get("mine")
    getMyChallenge(@User() user){
        return this.participationService.getMyChallenge(user.userId);
    }
}
