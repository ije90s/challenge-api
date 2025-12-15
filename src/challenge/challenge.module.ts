import { Module } from '@nestjs/common';
import { ChallengeController } from './challenge.controller';
import { ChallengeService } from './challenge.service';
import { Challenge } from './entity/challenge.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Challenge]),],
  controllers: [ChallengeController],
  providers: [ChallengeService],
  exports: [ChallengeService]
})
export class ChallengeModule {}
