
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';
import { MulterError } from 'multer';

@Catch(MulterError, Error)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
  
    if(exception instanceof MulterError || exception.message === 'INVALID_FILE_TYPE'){
      let message = exception.message; 

      if (exception.message === 'INVALID_FILE_TYPE'){
        message = '파일 형식이 맞지 않습니다.';
      }
      
      response.status(400).json({
        sucess: false,
        timestamp: new Date().toISOString(),
        path: request.originalUrl,
        error: 'Bad Request',
        message,
      });
    }
    
    // 나머지 에러는 그대로 처리
    throw exception;
  }
}
