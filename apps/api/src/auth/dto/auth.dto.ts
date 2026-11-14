import { IsOptional, IsString, Length, Matches, MinLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class SendOtpDto {
  @IsString()
  @Matches(/^\+91[0-9]{10}$/)
  phone!: string;
}

export class VerifyOtpDto {
  @IsString()
  phone!: string;

  @IsString()
  @Length(4, 6)
  otp!: string;
}

export class CustomerRegisterDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @ValidateIf((_, v) => v != null && v !== '')
  @Matches(/^[a-zA-Z0-9._]{3,32}$/, { message: 'Username must be 3–32 letters, numbers, dots or underscores' })
  username?: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+91)?[0-9]{10}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  phone?: string;

  @IsOptional()
  @IsString()
  tenantSlug?: string;
}

export class CustomerLoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  tenantSlug?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}
