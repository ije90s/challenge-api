import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { ChallengeService } from './challenge.service';
import { UpdateChallengeDto } from './dto/update-challenge.dto';

@Controller('challenge')
export class ChallengeController {

    constructor(private readonly challengeService: ChallengeService){}

    @Get()
    findAll(){
        return this.challengeService.findAll();
    }

    @Post()
    create(@Body() dto: CreateChallengeDto){
        return this.challengeService.create(dto);
    }

    @Put("/:id")
    modify(@Body() dto: UpdateChallengeDto, @Param("id") id: number){
        return this.challengeService.update(dto, id);
    }

    @Delete("/:id")
    delete(@Param("id") id: number){
        return this.challengeService.delete(id);
    }

    @Get("/:id")
    findOne(@Param("id") id: number){
        return this.challengeService.findOne(id);
    }
}
