import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateChallengeDto {
    
    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    type: number;
    
    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    mininum_count: number;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsString()
    @IsNotEmpty()
    start_date: string;

    @IsString()
    @IsNotEmpty()
    end_date: string;

}