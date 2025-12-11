
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl } = req;
    const ip = req.ip;
    const ua = req.headers['user-agent'] || '';

    //this.logger.log(`➡️ ${method} ${originalUrl} | IP: ${ip} | UA: ${ua}`);

    res.on('finish', () => {
        const ms = Date.now() - start;
        const { statusCode } = res;
        this.logger.log(
        `⬅️ ${method} ${originalUrl} - ${statusCode} (${ms}ms) | IP: ${ip}`
        );
    });

    next();
}

}
