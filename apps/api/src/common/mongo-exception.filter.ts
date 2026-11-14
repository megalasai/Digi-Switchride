import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import { mongoDuplicateMessage } from './mongo-error';

@Catch()
export class MongoExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('MongoExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const duplicate = mongoDuplicateMessage(exception);
    const mapped = duplicate
      ? new ConflictException(duplicate)
      : exception instanceof HttpException
        ? exception
        : new InternalServerErrorException('Request failed. Please try again.');
    if (!(exception instanceof HttpException)) {
      this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    }
    const status = mapped.getStatus();
    res.status(status).json(mapped.getResponse());
  }
}
