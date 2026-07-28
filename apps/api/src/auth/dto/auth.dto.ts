import { IsString, Matches, Length } from 'class-validator';

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

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}
