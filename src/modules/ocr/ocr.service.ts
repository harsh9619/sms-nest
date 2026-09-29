import { Injectable, BadRequestException, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

export interface OcrProcessingOptions {
  buffer?: Buffer;
  base64?: string;
  mimeType?: string;
  prompt?: string;
  schemaDescription?: string;
  provider?: "gemini" | "openai";
  model?: string;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(private readonly configService: ConfigService) { }

  /**
   * Check status of available LLM providers configured in environment
   */
  getProviderStatus() {
    const geminiKey =
      this.configService.get<string>("GEMINI_API_KEY") ||
      this.configService.get<string>("GOOGLE_API_KEY");
    const openaiKey = this.configService.get<string>("OPENAI_API_KEY");

    return {
      gemini: {
        configured: Boolean(geminiKey),
        defaultModel: "gemini-3.5-flash",
      },
      openai: {
        configured: Boolean(openaiKey),
        defaultModel: "gpt-4o-mini",
      },
    };
  }

  /**
   * Extract structured JSON from document/image using LLM OCR
   */
  async extractJsonFromImage(options: OcrProcessingOptions): Promise<{
    success: boolean;
    data: any;
    provider: string;
    model: string;
  }> {
    let base64Data: string;
    let mimeType = options.mimeType || "image/png";

    if (options.buffer) {
      base64Data = options.buffer.toString("base64");
    } else if (options.base64) {
      // Strip data URI prefix if present (e.g. data:image/jpeg;base64,)
      const matches = options.base64.match(/^data:(.+?);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Data = matches[2];
      } else {
        base64Data = options.base64;
      }
    } else {
      throw new BadRequestException("No image buffer or base64 data provided for OCR.");
    }

    // Determine provider
    const providerStatus = this.getProviderStatus();
    let provider = options.provider;

    if (!provider) {
      if (providerStatus.gemini.configured) {
        provider = "gemini";
      } else if (providerStatus.openai.configured) {
        provider = "openai";
      } else {
        throw new BadRequestException(
          "No LLM API key configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in your environment variables (.env)."
        );
      }
    }

    if (provider === "gemini" && !providerStatus.gemini.configured) {
      throw new BadRequestException(
        "GEMINI_API_KEY or GOOGLE_API_KEY is not configured in environment."
      );
    }
    if (provider === "openai" && !providerStatus.openai.configured) {
      throw new BadRequestException("OPENAI_API_KEY is not configured in environment.");
    }

    if (provider === "gemini") {
      return this.processWithGemini(base64Data, mimeType, options);
    } else {
      return this.processWithOpenAI(base64Data, mimeType, options);
    }
  }

  /**
   * Perform OCR using Google Gemini Vision (Gemini 3.5 Flash / 3.1 Flash Lite)
   */
  private async processWithGemini(
    base64Data: string,
    mimeType: string,
    options: OcrProcessingOptions
  ) {
    const apiKey =
      this.configService.get<string>("GEMINI_API_KEY") ||
      this.configService.get<string>("GOOGLE_API_KEY")!;
    const candidateModels = options.model
      ? [options.model, "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash"]
      : ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash"];

    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
          },
        });

        const promptText = this.buildPrompt(options.prompt, options.schemaDescription);

        const imagePart = {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        };

        const result = await model.generateContent([promptText, imagePart]);
        const responseText = result.response.text();

        const parsedData = this.parseJsonOutput(responseText);

        return {
          success: true,
          data: parsedData,
          provider: "gemini",
          model: modelName,
        };
      } catch (err: any) {
        this.logger.warn(`Gemini model ${modelName} failed, trying next fallback... ${err.message}`);
        lastError = err;
      }
    }

    this.logger.error(`All Gemini model candidates failed: ${lastError?.message}`, lastError?.stack);
    throw new InternalServerErrorException(`Gemini OCR Processing failed: ${lastError?.message}`);
  }

  /**
   * Perform OCR using OpenAI GPT-4o / GPT-4o-mini Vision
   */
  private async processWithOpenAI(
    base64Data: string,
    mimeType: string,
    options: OcrProcessingOptions
  ) {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY")!;
    const modelName = options.model || "gpt-4o-mini";

    try {
      const openai = new OpenAI({ apiKey });
      const promptText = this.buildPrompt(options.prompt, options.schemaDescription);

      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      const response = await openai.chat.completions.create({
        model: modelName,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an expert OCR AI assistant. Analyze the image and extract all text, data, and structured content into clean, valid JSON format.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
      });

      const content = response.choices[0]?.message?.content || "{}";
      const parsedData = this.parseJsonOutput(content);

      return {
        success: true,
        data: parsedData,
        provider: "openai",
        model: modelName,
      };
    } catch (err: any) {
      this.logger.error(`OpenAI OCR failed: ${err.message}`, err.stack);
      throw new InternalServerErrorException(`OpenAI OCR Processing failed: ${err.message}`);
    }
  }

  /**
   * Construct LLM system/user prompt for JSON extraction
   */
  private buildPrompt(userPrompt?: string, schemaDescription?: string): string {
    let prompt = `You are a high-precision OCR and document understanding engine.
Analyze the attached document/image and convert its contents into a structured JSON object.

General Guidelines:
1. Extract all text, labels, values, tables, key-value pairs, dates, numbers, and lists accurately.
2. If tables are present, structure them as arrays of objects.
3. Use sensible camelCase or snake_case key names for extracted fields.
4. Output MUST be strictly valid JSON without any markdown or explanatory text around it.`;

    if (schemaDescription) {
      prompt += `\n\nTarget JSON Schema / Output Structure Requirement:\n${schemaDescription}`;
    }

    if (userPrompt) {
      prompt += `\n\nUser Specific Extraction Instructions:\n${userPrompt}`;
    }

    return prompt;
  }

  /**
   * Safely parse JSON from LLM response string
   */
  private parseJsonOutput(rawOutput: string): any {
    try {
      // Remove markdown code fences if present (```json ... ```)
      let cleaned = rawOutput.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      }
      return JSON.parse(cleaned);
    } catch (e) {
      this.logger.warn("Failed to parse raw LLM output as JSON, returning raw wrapped content.");
      return { rawText: rawOutput };
    }
  }
}
