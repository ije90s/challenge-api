import { Type } from "class-transformer";
import { IsNumber, IsOptional } from "class-validator";

export class CreateParticipationDto {

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    score?: number;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    challenge_count?: number;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    status?: number;
}