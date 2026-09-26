import { ConflictException, Injectable, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { normalizeAdminRole, type AdminRole } from '@digi-switchride/shared';
import { AuditService, type AuditActor } from '../audit/audit.service';
import { Customer, CustomerDocument, OtpRecord, OtpRecordDocument, RefreshToken, RefreshTokenDocument } from '../schemas/customer.schema';
import { AdminUser, AdminUserDocument } from '../schemas/admin.schema';
import { generateOtp, hashOtp, hashPassword } from '../common/helpers';
import { AdminLoginDto, CreateAdminUserDto } from './dto/admin-auth.dto';
import { SendOtpDto, VerifyOtpDto, CustomerRegisterDto, CustomerLoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(OtpRecord.name) private otpModel: Model<OtpRecordDocument>,
    @InjectModel(RefreshToken.name) private refreshTokenModel: Model<RefreshTokenDocument>,
    @InjectModel(AdminUser.name) private adminModel: Model<AdminUserDocument>,
    private jwtService: JwtService,
    private config: ConfigService,
    private auditService: AuditService,
  ) {}

  async onModuleInit() {
    const count = await this.adminModel.countDocuments();
    if (count > 0) return;

    const email = this.config.get<string>('ADMIN_EMAIL', 'admin@digiswitchride.com');
    const password = this.config.get<string>('ADMIN_PASSWORD', 'Admin@123');
    const salt = this.config.get<string>('PASSWORD_SALT', 'dev-salt');

    await this.adminModel.create({
      email,
      passwordHash: hashPassword(password, salt),
      fullName: 'Super Admin',
      role: 'SuperAdmin',
    });
    console.log(`[DEV] Bootstrap admin created: ${email}`);
  }

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

    return this.issueCustomerTokens(customer, isNewUser);
  }

  async registerCustomer(dto: CustomerRegisterDto) {
    const salt = this.config.get<string>('PASSWORD_SALT', 'dev-salt');
    const username = dto.username.trim().toLowerCase();
    const existing = await this.customerModel.findOne({ username });
    if (existing) throw new ConflictException('Username already taken');

    const customer = await this.customerModel.create({
      username,
      passwordHash: hashPassword(dto.password, salt),
      fullName: dto.fullName?.trim(),
      kycStatus: 'NotSubmitted',
      accountStatus: 'Active',
    });

    return this.issueCustomerTokens(customer, true);
  }

  async loginCustomer(dto: CustomerLoginDto) {
    const salt = this.config.get<string>('PASSWORD_SALT', 'dev-salt');
    const username = dto.username.trim().toLowerCase();
    const customer = await this.customerModel.findOne({ username, accountStatus: 'Active' });
    if (!customer?.passwordHash || customer.passwordHash !== hashPassword(dto.password, salt)) {
      throw new UnauthorizedException('Invalid username or password');
    }
    return this.issueCustomerTokens(customer, false);
  }

  async adminLogin(dto: AdminLoginDto) {
    const salt = this.config.get<string>('PASSWORD_SALT', 'dev-salt');
    const admin = await this.adminModel.findOne({ email: dto.email.toLowerCase(), isActive: true });
    if (!admin || admin.passwordHash !== hashPassword(dto.password, salt)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueAdminTokens(admin);
  }

  async createAdminUser(dto: CreateAdminUserDto, actor?: AuditActor | null) {
    const salt = this.config.get<string>('PASSWORD_SALT', 'dev-salt');
    const existing = await this.adminModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) throw new ConflictException('Email already registered');

    const admin = await this.adminModel.create({
      email: dto.email.toLowerCase(),
      passwordHash: hashPassword(dto.password, salt),
      fullName: dto.fullName,
      role: dto.role,
    });
    const result = this.toAdminUser(admin);
    await this.auditService.record({
      actor,
      action: 'admin.user.create',
      entityType: 'AdminUser',
      entityId: result.id,
      after: { email: result.email, role: result.role, fullName: result.fullName },
    });
    return result;
  }

  async listAdminUsers() {
    const admins = await this.adminModel.find().sort({ createdAt: -1 });
    return admins.map((a) => this.toAdminUser(a));
  }

  async updateAdminUser(
    id: string,
    data: { fullName?: string; role?: AdminRole; password?: string; isActive?: boolean },
    actor?: AuditActor | null,
  ) {
    const admin = await this.adminModel.findById(id);
    if (!admin) throw new NotFoundException('Admin user not found');
    const before = this.toAdminUser(admin);

    if (data.fullName != null) admin.fullName = data.fullName;
    if (data.role != null) admin.role = data.role;
    if (data.isActive != null) admin.isActive = data.isActive;
    if (data.password) {
      const salt = this.config.get<string>('PASSWORD_SALT', 'dev-salt');
      admin.passwordHash = hashPassword(data.password, salt);
    }
    await admin.save();
    const after = this.toAdminUser(admin);
    await this.auditService.record({
      actor,
      action: 'admin.user.update',
      entityType: 'AdminUser',
      entityId: id,
      before: { fullName: before.fullName, role: before.role, isActive: before.isActive },
      after: { fullName: after.fullName, role: after.role, isActive: after.isActive, passwordChanged: Boolean(data.password) },
    });
    return after;
  }

  async refreshToken(refreshToken: string) {
    const token = await this.refreshTokenModel
      .findOne({ tokenHash: hashOtp(refreshToken), isRevoked: false, expiresAt: { $gt: new Date() } });
    if (!token) throw new UnauthorizedException('Invalid refresh token');

    token.isRevoked = true;
    await token.save();

    const customer = await this.customerModel.findById(token.customerId);
    if (!customer) throw new UnauthorizedException('Customer not found');

    return this.issueCustomerTokens(customer, false);
  }

  async validateCustomer(customerId: string) {
    return this.customerModel.findById(customerId);
  }

  async validateAdmin(adminId: string) {
    return this.adminModel.findOne({ _id: adminId, isActive: true });
  }

  private async issueCustomerTokens(customer: CustomerDocument, isNewUser: boolean) {
    const payload = {
      sub: customer._id.toString(),
      phone: customer.phone,
      username: customer.username,
      role: 'Customer',
      type: 'customer',
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshTokenValue = randomUUID().replace(/-/g, '');

    await this.refreshTokenModel.create({
      customerId: customer._id.toString(),
      tokenHash: hashOtp(refreshTokenValue),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return { accessToken, refreshToken: refreshTokenValue, expiresIn: 3600, isNewUser };
  }

  private issueAdminTokens(admin: AdminUserDocument) {
    const payload = {
      sub: admin._id.toString(),
      email: admin.email,
      role: (normalizeAdminRole(admin.role) ?? admin.role) as AdminRole,
      type: 'admin',
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '8h' });
    return {
      accessToken,
      expiresIn: 28800,
      user: this.toAdminUser(admin),
    };
  }

  private toAdminUser(admin: AdminUserDocument) {
    return {
      id: admin._id.toString(),
      email: admin.email,
      fullName: admin.fullName,
      role: normalizeAdminRole(admin.role) ?? admin.role,
      isActive: admin.isActive,
      createdAt: (admin as any).createdAt,
    };
  }
}
