import { IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateParticipationDto {
    
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    score?: number;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    challenge_count?: number;
}
