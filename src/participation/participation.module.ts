import { Module } from '@nestjs/common';
import { ParticipationService } from './participation.service';
import { ParticipationController } from './participation.controller';
import { ChallengeModule } from 'src/challenge/challenge.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Participation } from './entity/participation.entity';

@Module({
  imports: [ChallengeModule, TypeOrmModule.forFeature([Participation]),],
  providers: [ParticipationService],
  controllers: [ParticipationController]
})
export class ParticipationModule {}
