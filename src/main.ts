import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter.js";
import express from "express";
import path from "path";
import fs from "fs";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));

  app.enableCors();
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  console.log(`Server listening on http://localhost:${port}`);
}

bootstrap();
