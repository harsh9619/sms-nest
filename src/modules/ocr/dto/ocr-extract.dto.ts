import { IsOptional, IsString, IsIn } from "class-validator";

export class OcrExtractDto {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  schemaDescription?: string;

  @IsOptional()
  @IsString()
  @IsIn(["gemini", "openai"])
  provider?: "gemini" | "openai";

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  imageBase64?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class OcrExtractUrlDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  schemaDescription?: string;

  @IsOptional()
  @IsString()
  @IsIn(["gemini", "openai"])
  provider?: "gemini" | "openai";

  @IsOptional()
  @IsString()
  model?: string;
}
