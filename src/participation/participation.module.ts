import { Module } from '@nestjs/common';
import { ParticipationService } from './participation.service';
import { ParticipationController } from './participation.controller';

@Module({
  providers: [ParticipationService],
  controllers: [ParticipationController]
})
export class ParticipationModule {}
