import { Length, Matches, IsString, IsEmail, IsOptional, MinLength } from 'class-validator';

export class LoginDto {
  /** Email or username — the field name is kept as `username` for compatibility. */
  @IsString()
  @Length(1, 100)
  username!: string;

  @IsString()
  @Length(1, 1024)
  password!: string;
}

export class SignupDto {
  @IsEmail()
  @Length(5, 254)
  email!: string;

  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9._-]{2,30})[a-z0-9]$/i, {
    message: 'username must be 4-32 chars: letters, digits, dot, underscore or dash',
  })
  username!: string;

  @IsString()
  @MinLength(12, { message: 'password must be at least 12 characters' })
  @Length(1, 1024)
  password!: string;

  /** Optional workspace/organization name; defaults to a generated one. */
  @IsOptional()
  @IsString()
  @Length(1, 120)
  organizationName?: string;
}

export class RecoveryDto {
  @IsString()
  @Matches(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, {
    message: 'code must be alphanumeric groups separated by dashes',
  })
  code!: string;

  @IsString()
  @Length(1, 1024)
  newPassword!: string;
}
