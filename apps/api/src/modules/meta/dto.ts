import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class MetaConfigDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'appId must be numeric' })
  appId?: string;

  @IsOptional()
  @IsString()
  @Length(8, 512)
  appSecret?: string;

  @IsOptional()
  @IsString()
  @Length(8, 256)
  webhookVerifyToken?: string;

  @IsOptional()
  @IsString()
  @Matches(/^v\d+\.\d+$/, { message: 'graphApiVersion must look like v26.0' })
  graphApiVersion?: string;

  @IsOptional()
  @IsBoolean()
  appsecretProofEnabled?: boolean;
}

export class SelectAssetDto {
  @IsOptional()
  @IsBoolean()
  selected?: boolean;
}
