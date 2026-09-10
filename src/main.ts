import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  console.log(`Server listening on http://localhost:${port}`);
}

bootstrap();
