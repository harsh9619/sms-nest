import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const resObj =
      exception instanceof HttpException
        ? exception.getResponse()
        : { error: exception.message || "Internal Server Error" };

    const errorMsg =
      typeof resObj === "string"
        ? resObj
        : (resObj as any).error || (resObj as any).message || "Internal Server Error";

    response.status(status).json({
      error: errorMsg,
    });
  }
}
