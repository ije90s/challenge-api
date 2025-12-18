import { Type } from "class-transformer";
import { IsDate, IsNotEmpty, IsNumber, IsString } from "class-validator";

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

    @IsDate()
    @IsNotEmpty()
    @Type(() => Date)
    start_date: Date;

    @IsDate()
    @IsNotEmpty()
    @Type(() => Date)
    end_date: Date;

}