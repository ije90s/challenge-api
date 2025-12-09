import { PartialType } from '@nestjs/mapped-types';
import { CreateParticipationDto } from './create-participation.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateParticipationDto extends PartialType(CreateParticipationDto) {
    @IsString()
    @IsOptional()
    complete_date: string;
}
