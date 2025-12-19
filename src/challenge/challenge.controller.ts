import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { ChallengeService } from './challenge.service';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { User } from '../common/user.decorator';
import { JwtAuthGuard } from '../auth/jwt/jwt.auth.guard';
import { ResponseChallengeDto } from './dto/response-challenge.dto';
import { ResponsePagingDto } from '../common/dto/response-paging.dto';

@UseGuards(JwtAuthGuard)
@Controller('challenge')
export class ChallengeController {

    constructor(private readonly challengeService: ChallengeService){}

    @Get()
    async findAll(@Query('page') page: number, @Query('limit') limit: number): Promise<ResponsePagingDto<ResponseChallengeDto>>{
        return await this.challengeService.findAll(page, limit);
    }

    @Post()
    async create(@User() user, @Body() dto: CreateChallengeDto): Promise<ResponseChallengeDto>{
        return await this.challengeService.create(user.userId, dto);
    }

    @Patch(":challengeId")
    async modify(@Param("challengeId") challengeId: number, @User() user, @Body() dto: UpdateChallengeDto): Promise<ResponseChallengeDto>{
        return await this.challengeService.update(challengeId, user.userId, dto);
    }

    @Delete(":challengeId")
    async delete(@Param("challengeId") challengeId: number, @User() user): Promise<void>{
        return await this.challengeService.delete(challengeId, user.userId);
    }

    @Get(":challengeId")
    async findOne(@Param("challengeId") challengeId: number): Promise<ResponseChallengeDto | null>{
        return await this.challengeService.findOne(challengeId);
    }
}
