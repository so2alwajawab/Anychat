import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** GET /admin/orgs query — offset pagination + optional name/owner search. */
export class AdminOrgsQueryDto {
  /** Free-text match against organization name or owner username. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class UpdateTrackingSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  facebookPixelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  googleAnalyticsId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  googleTagManagerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tiktokPixelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  snapchatPixelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  customHeadScripts?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  customBodyScripts?: string;
}
