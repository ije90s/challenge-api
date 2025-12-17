import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ParticipationService } from './participation.service';
import { UpdateParticipationDto } from './dto/update-participation.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt.auth.guard';
import { User } from '../common/user.decorator';
import { CreateParticipationDto } from './dto/create-participation.dto';

@UseGuards(JwtAuthGuard)
@Controller('participation/challenge')
export class ParticipationController {

    constructor(private readonly participationService: ParticipationService){}
    
    @Post()
    joinChallenge(@User() user, dto: CreateParticipationDto){
        return this.participationService.create(user.userId, dto);
    }

    @Patch()
    updateChallenge(@User() user, @Body() dto: UpdateParticipationDto){
        return this.participationService.update(user.userId, dto);
    }

    @Patch("giveup")
    giveupChallenge(@User() user, dto: UpdateParticipationDto){
        return this.participationService.updateStatus(user.userId, dto);
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
