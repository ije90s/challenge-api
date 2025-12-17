import { Module } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { ChallengeModule } from '../challenge/challenge.module';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feed } from './entity/feed.entity';

@Module({
  imports: [   
    MulterModule.register({
      dest: './upload',
    }),
    TypeOrmModule.forFeature([Feed]),
    ChallengeModule],
  providers: [FeedService],
  controllers: [FeedController]
})
export class FeedModule {}
