import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateParticipationDto } from './dto/create-participation.dto';
import { ParticipationService } from './participation.service';
import { UpdateParticipationDto } from './dto/update-participation.dto';

@Controller('participation')
export class ParticipationController {

    constructor(private readonly participationService: ParticipationService){}
    
    @Post("challenge/:challengeId/:userId")
    joinChallenge(@Param("challengeId") challengeId: number, @Param("userId") userId: number, @Body() dto: CreateParticipationDto){
        return this.participationService.create(challengeId, userId, dto);
    }

    @Patch("challenge/:challengeId/:userId")
    updateChallenge(@Param("challengeId") challengeId: number, @Param("userId") userId: number, @Body() dto: UpdateParticipationDto){
        return this.participationService.update(challengeId, userId, dto);
    }

    @Patch("giveup/:challengeId/:userId")
    giveupChallenge(@Param("challengeId") challengeId: number, @Param("userId") userId: number){
        return this.participationService.updateStatus(challengeId, userId);
    }

    @Get("rank/:challengeId/:userId")
    getChallengeRank(@Param("challengeId") challengeId: number, @Param("userId") userId: number){
        return this.participationService.getChallengeRank(challengeId, userId);
    }

    @Get("mine/:userId")
    getMyChallenge(@Param("userId") userId: number){
        return this.participationService.getMyChallenge(userId);
    }
}
