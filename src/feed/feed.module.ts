import { Module } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { ChallengeModule } from '../challenge/challenge.module';

@Module({
  imports: [ChallengeModule],
  providers: [FeedService],
  controllers: [FeedController]
})
export class FeedModule {}
