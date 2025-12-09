import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ChallengeModule } from './challenge/challenge.module';
import { ParticipationModule } from './participation/participation.module';
import { FeedModule } from './feed/feed.module';

@Module({
  imports: [ConfigModule.forRoot({isGlobal: true }), UserModule, AuthModule, ChallengeModule, ParticipationModule, FeedModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
