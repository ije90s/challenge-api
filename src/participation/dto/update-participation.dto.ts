import { PartialType } from '@nestjs/mapped-types';
import { CreateParticipationDto } from './create-participation.dto';
import { IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateParticipationDto extends PartialType(CreateParticipationDto) {
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    score?: number;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    challenge_count?: number;
}
