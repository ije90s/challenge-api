import { Type } from "class-transformer";
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateParticipationDto {

    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    challenge_id: number;
}