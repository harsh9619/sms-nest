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
        : { message: exception.message || "Internal Server Error" };

    let errorMessage: string | string[] = "Internal Server Error";

    if (typeof resObj === "string") {
      errorMessage = resObj;
    } else if (resObj && typeof resObj === "object") {
      const obj = resObj as any;
      errorMessage = obj.message || obj.error || "Internal Server Error";
    }

    response.status(status).json({
      statusCode: status,
      message: errorMessage,
      error: errorMessage,
    });
  }
}
