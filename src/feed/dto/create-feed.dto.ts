import { Transform, Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateFeedDto {
    
    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    challenge_id: number;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsArray()
    @IsString({each: true})
    @IsOptional()
    images?: string[];
}