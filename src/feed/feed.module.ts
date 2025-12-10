import { Module } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { ChallengeModule } from '../challenge/challenge.module';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [   
    MulterModule.register({
      dest: './upload',
    }),
    ChallengeModule],
  providers: [FeedService],
  controllers: [FeedController]
})
export class FeedModule {}
