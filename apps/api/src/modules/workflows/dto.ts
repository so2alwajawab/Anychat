import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  assetId?: string;

  @IsOptional()
  definition?: Record<string, unknown>;
}

export class UpdateWorkflowDraftDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  assetId?: string | null;

  @IsNotEmpty()
  definition!: Record<string, unknown>;

  @IsInt()
  @Min(1)
  lockVersion!: number;
}

export class PublishWorkflowDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  publishedNote?: string;

  @IsOptional()
  definition?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

export class TestRunDto {
  @IsString()
  @IsNotEmpty()
  commentText!: string;

  @IsString()
  @IsOptional()
  platform?: 'facebook' | 'instagram';
}
