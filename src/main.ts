import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filter/http.exception.filter';
import { ResponseInterceptor } from './common/interceptor/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  if (!process.env.FRONTEND_ORIGIN) {
    throw new Error('FRONTEND_ORIGIN is not set');
  }
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN });
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
