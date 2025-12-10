import { Module } from '@nestjs/common';
import { ParticipationService } from './participation.service';
import { ParticipationController } from './participation.controller';
import { ChallengeModule } from 'src/challenge/challenge.module';

@Module({
  imports: [ChallengeModule],
  providers: [ParticipationService],
  controllers: [ParticipationController]
})
export class ParticipationModule {}
