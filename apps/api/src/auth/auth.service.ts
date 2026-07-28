import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { Customer, CustomerDocument, OtpRecord, OtpRecordDocument, RefreshToken, RefreshTokenDocument } from '../schemas/customer.schema';
import { generateOtp, hashOtp } from '../common/helpers';
import { SendOtpDto, VerifyOtpDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(OtpRecord.name) private otpModel: Model<OtpRecordDocument>,
    @InjectModel(RefreshToken.name) private refreshTokenModel: Model<RefreshTokenDocument>,
    private jwtService: JwtService,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    const otp = generateOtp();
    await this.otpModel.create({
      phone: dto.phone,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    console.log(`[DEV] OTP for ${dto.phone}: ${otp}`);
    return { message: 'OTP sent successfully', expiresInSeconds: 300 };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const record = await this.otpModel
      .findOne({ phone: dto.phone, isUsed: false, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 });

    if (!record || record.otpHash !== hashOtp(dto.otp)) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    record.isUsed = true;
    await record.save();

    let customer = await this.customerModel.findOne({ phone: dto.phone });
    const isNewUser = !customer;

    if (!customer) {
      customer = await this.customerModel.create({ phone: dto.phone });
    }

    return this.issueTokens(customer, isNewUser);
  }

  async refreshToken(refreshToken: string) {
    const token = await this.refreshTokenModel
      .findOne({ tokenHash: hashOtp(refreshToken), isRevoked: false, expiresAt: { $gt: new Date() } });
    if (!token) throw new UnauthorizedException('Invalid refresh token');

    token.isRevoked = true;
    await token.save();

    const customer = await this.customerModel.findById(token.customerId);
    if (!customer) throw new UnauthorizedException('Customer not found');

    return this.issueTokens(customer, false);
  }

  async validateCustomer(customerId: string) {
    return this.customerModel.findById(customerId);
  }

  private async issueTokens(customer: CustomerDocument, isNewUser: boolean) {
    const payload = { sub: customer._id.toString(), phone: customer.phone, role: 'Customer' };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshTokenValue = randomUUID().replace(/-/g, '');

    await this.refreshTokenModel.create({
      customerId: customer._id.toString(),
      tokenHash: hashOtp(refreshTokenValue),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return { accessToken, refreshToken: refreshTokenValue, expiresIn: 3600, isNewUser };
  }
}
