import { ArgumentsHost } from '@nestjs/common';
import { MulterError } from 'multer';
import { MulterExceptionFilter } from './multer.exception.filter';

describe('MulterExceptionFilter', () => {
  let filter: MulterExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { originalUrl: string };
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new MulterExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockRequest = { originalUrl: '/feed' };

    host = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('MulterError는 400 응답을 보내고 재throw하지 않는다', () => {
    const exception = new MulterError('LIMIT_FILE_COUNT');

    expect(() => filter.catch(exception, host)).not.toThrow();
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        path: '/feed',
        message: exception.message,
      }),
    );
  });

  it('잘못된 파일 형식 에러는 메시지를 변환해 400 응답을 보내고 재throw하지 않는다', () => {
    const exception = new Error('INVALID_FILE_TYPE');

    expect(() => filter.catch(exception, host)).not.toThrow();
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: '파일 형식이 맞지 않습니다.' }),
    );
  });

  it('그 외 에러는 응답을 보내지 않고 그대로 재throw한다', () => {
    const exception = new Error('알 수 없는 에러');

    expect(() => filter.catch(exception, host)).toThrow(exception);
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });
});
