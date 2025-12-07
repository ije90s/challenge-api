import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ChallengeModule } from './challenge/challenge.module';

@Module({
  imports: [ConfigModule.forRoot({isGlobal: true }), UserModule, AuthModule, ChallengeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
