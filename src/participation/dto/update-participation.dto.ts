import { IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateParticipationDto {

    @IsNumber()
    @IsOptional()
    @Min(0)
    @Type(() => Number)
    score?: number;

    @IsNumber()
    @IsOptional()
    @Min(0)
    @Type(() => Number)
    challenge_count?: number;
}
