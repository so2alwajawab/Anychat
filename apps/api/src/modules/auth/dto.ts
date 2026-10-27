import { Length, Matches, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(1, 100)
  username!: string;

  @IsString()
  @Length(1, 1024)
  password!: string;
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
