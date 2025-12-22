import { Type } from "class-transformer";
import { IsNumber, Min } from "class-validator";

export class RequestQueryDTO {

    @IsNumber()
    @Min(1)
    @Type(() => Number)
    page: number = 1;

    @IsNumber()
    @Min(10)
    @Type(() => Number)
    limit: number = 10;
}