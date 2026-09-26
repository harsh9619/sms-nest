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

  const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || "";
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5000",
    "https://sms-nest.onrender.com",
    ...rawAllowedOrigins.split(",").map((o) => o.trim()).filter(Boolean),
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      const isWhitelisted =
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(new URL(origin).hostname) ||
        process.env.NODE_ENV !== "production";

      if (isWhitelisted) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization", "X-Requested-With", "academic-year-id", "academic-year"],
  });
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  console.log(`Server listening on http://localhost:${port}`);
}

bootstrap();
