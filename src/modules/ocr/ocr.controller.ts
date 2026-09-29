import {
  Controller,
  Post,
  Get,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { OcrService } from "./ocr.service.js";
import { OcrExtractDto, OcrExtractUrlDto } from "./dto/ocr-extract.dto.js";

@Controller("api/ocr")
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  /**
   * GET /api/ocr/status
   * Health check for available OCR LLM providers (Gemini, OpenAI)
   */
  @Get("status")
  getStatus() {
    return {
      status: "active",
      providers: this.ocrService.getProviderStatus(),
    };
  }

  /**
   * POST /api/ocr/extract
   * Extract structured JSON from file upload OR base64 payload
   */
  @Post("extract")
  @UseInterceptors(FileInterceptor("file"))
  async extractJson(
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: OcrExtractDto
  ) {
    if (!file && !body?.imageBase64) {
      throw new BadRequestException(
        "Please upload an image/document file or provide an imageBase64 string in the request body."
      );
    }

    return this.ocrService.extractJsonFromImage({
      buffer: file?.buffer,
      mimeType: file?.mimetype || body?.mimeType,
      base64: body?.imageBase64,
      prompt: body?.prompt,
      schemaDescription: body?.schemaDescription,
      provider: body?.provider,
      model: body?.model,
    });
  }

  /**
   * POST /api/ocr/extract-url
   * Extract structured JSON from image/document URL
   */
  @Post("extract-url")
  async extractFromUrl(@Body() body: OcrExtractUrlDto) {
    if (!body.url) {
      throw new BadRequestException("Image or document URL is required.");
    }

    try {
      const response = await fetch(body.url);
      if (!response.ok) {
        throw new BadRequestException(`Failed to fetch file from URL: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "image/png";
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return this.ocrService.extractJsonFromImage({
        buffer,
        mimeType: contentType,
        prompt: body.prompt,
        schemaDescription: body.schemaDescription,
        provider: body.provider,
        model: body.model,
      });
    } catch (err: any) {
      throw new BadRequestException(`Unable to download image from URL: ${err.message}`);
    }
  }
}
