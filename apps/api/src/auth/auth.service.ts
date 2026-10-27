import { ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { normalizeAdminRole, type AdminRole } from '@digi-switchride/shared';
import { AuditService, type AuditActor } from '../audit/audit.service';
import { Customer, CustomerDocument, OtpRecord, OtpRecordDocument, RefreshToken, RefreshTokenDocument } from '../schemas/customer.schema';
import { AdminUser, AdminUserDocument } from '../schemas/admin.schema';
import { generateOtp, hashOtp, hashPassword } from '../common/helpers';
import { AdminLoginDto, CreateAdminUserDto } from './dto/admin-auth.dto';
import { SendOtpDto, VerifyOtpDto, CustomerRegisterDto, CustomerLoginDto } from './dto/auth.dto';
import { TenantsService } from '../tenants/tenants.service';
import { currentTenantId, runWithoutTenant, tenantAls } from '../common/tenant-als';

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
    private tenants: TenantsService,
  ) {}

  async onModuleInit() {
    await runWithoutTenant(async () => {
      try {
        const email = this.config.get<string>('ADMIN_EMAIL', 'admin@digiswitchride.com').toLowerCase();
        const password = this.config.get<string>('ADMIN_PASSWORD', 'Admin@123');
        const salt = this.config.get<string>('PASSWORD_SALT', 'dev-salt');
        const passwordHash = hashPassword(password, salt);

        const existing = await this.adminModel.findOne({ email }).lean();
        if (!existing) {
          await this.adminModel.create({
            email,
            passwordHash,
            fullName: 'Super Admin',
            role: 'SuperAdmin',
            isActive: true,
          });
          return;
        }

        await this.adminModel.collection.updateOne(
          { email },
          { $set: { passwordHash, isActive: true, role: existing.role || 'SuperAdmin' } },
        );
      } catch (err) {
        console.error('Admin bootstrap skipped:', err instanceof Error ? err.message : err);
      }
    });
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
    const email = dto.email.toLowerCase();
    const matches = await runWithoutTenant(() => this.adminModel.find({ email, isActive: true }));
    const superAdmin = matches.find((a) => a.role === 'SuperAdmin');
    const passwordOk = (admin: AdminUserDocument) => admin.passwordHash === hashPassword(dto.password, salt);

    if (!dto.tenantSlug) {
      if (superAdmin && passwordOk(superAdmin)) return this.issueAdminTokens(superAdmin);
      throw new UnauthorizedException('Select an organization to sign in');
    }

    const tenant = await this.tenants.findBySlug(dto.tenantSlug);
    if (!tenant) throw new UnauthorizedException('Unknown organization');
    if (superAdmin && passwordOk(superAdmin)) return this.issueAdminTokens(superAdmin);

    const admin = matches.find((a) => (a as { tenantId?: string }).tenantId === tenant._id.toString());
    if (!admin || !passwordOk(admin)) {
      throw new UnauthorizedException('Invalid email, password, or organization');
    }
    return this.issueAdminTokens(admin);
  }

  async createAdminUser(
    dto: CreateAdminUserDto,
    actor?: AuditActor | null,
    caller?: { role?: string; tenantId?: string },
  ) {
    const callerRole = normalizeAdminRole(caller?.role) ?? caller?.role;
    if (dto.role === 'SuperAdmin' && callerRole !== 'SuperAdmin') {
      throw new ForbiddenException('Only a SuperAdmin can create another SuperAdmin');
    }
    const tenantId =
      callerRole === 'SuperAdmin'
        ? dto.tenantId || currentTenantId() || this.tenants.defaultTenantId()
        : caller?.tenantId || currentTenantId() || this.tenants.defaultTenantId();
    if (!tenantId) throw new ForbiddenException('Choose an organization for this user');
    const org = await this.tenants.peek(tenantId);
    if (org && this.tenants.isParent(org) && dto.role !== 'SuperAdmin') {
      throw new ForbiddenException('Assign company users to a tenant. Fleetel is the parent company.');
    }

    const salt = this.config.get<string>('PASSWORD_SALT', 'dev-salt');
    const existing = await runWithoutTenant(() =>
      this.adminModel.findOne({ email: dto.email.toLowerCase(), tenantId }),
    );
    if (existing) throw new ConflictException('Email already registered for this organization');

    const admin = await tenantAls.run({ tenantId, skip: false }, () =>
      this.adminModel.create({
        email: dto.email.toLowerCase(),
        passwordHash: hashPassword(dto.password, salt),
        fullName: dto.fullName,
        role: dto.role,
        tenantId,
        hubIds: dto.hubIds ?? [],
      }),
    );
    const result = this.toAdminUser(admin);
    await this.auditService.record({
      actor,
      action: 'admin.user.create',
      entityType: 'AdminUser',
      entityId: result.id,
      after: { email: result.email, role: result.role, fullName: result.fullName, tenantId, hubIds: result.hubIds },
    });
    return result;
  }

  async listAdminUsers() {
    const admins = await this.adminModel.find().sort({ createdAt: -1 });
    return admins.map((a) => this.toAdminUser(a));
  }

  async updateAdminUser(
    id: string,
    data: { fullName?: string; role?: AdminRole; password?: string; isActive?: boolean; tenantId?: string; hubIds?: string[] },
    actor?: AuditActor | null,
    caller?: { role?: string },
  ) {
    const admin = await this.adminModel.findById(id);
    if (!admin) throw new NotFoundException('Admin user not found');
    const callerRole = normalizeAdminRole(caller?.role) ?? caller?.role;
    if (data.role === 'SuperAdmin' && callerRole !== 'SuperAdmin') {
      throw new ForbiddenException('Only a SuperAdmin can assign SuperAdmin');
    }
    const before = this.toAdminUser(admin);

    if (data.fullName != null) admin.fullName = data.fullName;
    if (data.role != null) admin.role = data.role;
    if (data.isActive != null) admin.isActive = data.isActive;
    if (data.hubIds != null) admin.hubIds = data.hubIds;
    if (data.tenantId != null && callerRole === 'SuperAdmin') {
      (admin as { tenantId?: string }).tenantId = data.tenantId;
    }
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
    return runWithoutTenant(async () => {
      const found = await this.customerModel.findById(customerId);
      if (found) return found;
      const raw = await this.customerModel.collection.findOne({ $or: this.idFilters(customerId) } as never);
      return raw ? this.customerModel.hydrate(raw) : null;
    });
  }

  async validateAdmin(adminId: string) {
    return runWithoutTenant(async () => {
      const found = await this.adminModel.findById(adminId);
      if (found?.isActive) return found;
      const raw = await this.adminModel.collection.findOne({ $or: this.idFilters(adminId) } as never);
      if (!raw) return null;
      const admin = this.adminModel.hydrate(raw);
      return admin.isActive ? admin : null;
    });
  }

  /** JSON restore stored _id as a string; mongoose findById uses ObjectId and misses the row. */
  private idFilters(id: string): object[] {
    const filters: object[] = [{ _id: id }];
    if (Types.ObjectId.isValid(id)) filters.push({ _id: new Types.ObjectId(id) });
    return filters;
  }

  private async issueCustomerTokens(customer: CustomerDocument, isNewUser: boolean) {
    const payload = {
      sub: customer._id.toString(),
      phone: customer.phone,
      username: customer.username,
      role: 'Customer',
      type: 'customer',
      tenantId: (customer as { tenantId?: string }).tenantId,
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

  private async issueAdminTokens(admin: AdminUserDocument) {
    const tenantId = (admin as { tenantId?: string }).tenantId;
    const tenant = tenantId ? await this.tenants.peek(tenantId) : null;
    const payload = {
      sub: admin._id.toString(),
      email: admin.email,
      role: (normalizeAdminRole(admin.role) ?? admin.role) as AdminRole,
      type: 'admin',
      tenantId,
      hubIds: admin.hubIds ?? [],
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '8h' });
    return {
      accessToken,
      expiresIn: 28800,
      user: {
        ...this.toAdminUser(admin),
        tenantName: tenant?.name ?? (normalizeAdminRole(admin.role) === 'SuperAdmin' ? 'Fleetel' : undefined),
      },
    };
  }

  private toAdminUser(admin: AdminUserDocument) {
    return {
      id: admin._id.toString(),
      email: admin.email,
      fullName: admin.fullName,
      role: normalizeAdminRole(admin.role) ?? admin.role,
      isActive: admin.isActive,
      tenantId: (admin as { tenantId?: string }).tenantId,
      hubIds: admin.hubIds ?? [],
      createdAt: (admin as any).createdAt,
    };
  }
}
