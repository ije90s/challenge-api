import { Type } from "class-transformer";
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateParticipationDto {

    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    challenge_id: number;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    score?: number;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    challenge_count?: number;
}