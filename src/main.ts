import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filter/http.exception.filter';
import { ResponseInterceptor } from './common/interceptor/response.interceptor';
import { UPLOADS_ROOT_DIR } from './common/util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (!process.env.FRONTEND_ORIGIN) {
    throw new Error('FRONTEND_ORIGIN is not set');
  }
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN });
  app.useStaticAssets(UPLOADS_ROOT_DIR, { prefix: '/uploads' });
  app.useGlobalPipes(new ValidationPipe({
    transform: true, 
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
  app.useGlobalFilters(new HttpExceptionFilter);
  app.useGlobalInterceptors(new ResponseInterceptor);
  await app.listen(process.env.PORT!);
}
bootstrap();
