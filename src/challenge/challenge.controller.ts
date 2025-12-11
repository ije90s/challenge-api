import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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
    findAll(){
        return this.challengeService.findAll();
    }

    @Post()
    create(@User() user, @Body() dto: CreateChallengeDto){
        return this.challengeService.create(user.userId, dto);
    }

    @Patch(":challengeId")
    modify(@Body() dto: UpdateChallengeDto, @User() user,  @Param("challengeId") challengeId: number){
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
