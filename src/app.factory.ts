import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "./app.module.js";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter.js";
import express from "express";
import path from "path";
import fs from "fs";

// Builds and configures the Nest app without binding to a port, so it can be
// shared by the long-running server (main.ts) and the Netlify Function.
export async function createApp(): Promise<INestApplication> {
    const app = await NestFactory.create(AppModule);

    app.use(express.json({ limit: "15mb" }));
    app.use(express.urlencoded({ limit: "15mb", extended: true }));

    const uploadsDir = path.join(process.cwd(), "uploads");
    try {
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
    } catch (err) {
        // Serverless filesystems are read-only; serve whatever uploads were deployed.
        console.warn("Could not create uploads directory:", err);
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

    return app;
}