import { Body, Controller, Get, Headers, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard, RolesGuard } from '../auth/admin.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateCustomerDto, RefundPaymentDto, ReviewKycDocumentDto, UpdateCustomerDto } from '../auth/dto/admin-auth.dto';
import { PaymentsService, PromotionsService, ReportsService, DashboardService } from './payments.service';
import { KycService, ProfileService } from '../customers/customers.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import { actorFromRequest } from '../common/actor';
import { AuditService } from '../audit/audit.service';

@Controller('v1/payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('orders')
  @UseGuards(AuthGuard('jwt'))
  createOrder(@Req() req: { user: { customerId: string } }, @Body() body: { bookingId: string; amount: number; currency?: string }) {
    return this.paymentsService.createOrder(req.user.customerId, body.bookingId, body.amount, body.currency);
  }

  @Post('webhooks/razorpay')
  webhook(@Body() body: string, @Headers('x-razorpay-signature') signature: string) {
    return this.paymentsService.handleRazorpayWebhook(JSON.stringify(body), signature);
  }

  @Get('history')
  @UseGuards(AuthGuard('jwt'))
  history(@Req() req: { user: { customerId: string } }, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    return this.paymentsService.getHistory(req.user.customerId, +page, +pageSize);
  }
}

@Controller('v1/admin')
@UseGuards(AuthGuard('jwt'), AdminGuard, RolesGuard)
export class AdminController {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    private profileService: ProfileService,
    private kycService: KycService,
    private promotionsService: PromotionsService,
    private reportsService: ReportsService,
    private paymentsService: PaymentsService,
    private dashboardService: DashboardService,
    private auditService: AuditService,
  ) {}

  @Get('customers')
  async listCustomers(@Query('search') search?: string, @Query('kycStatus') kycStatus?: string, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    const filter: Record<string, unknown> = {};
    if (kycStatus) filter.kycStatus = kycStatus;
    if (search) filter.$or = [{ phone: { $regex: search, $options: 'i' } }, { fullName: { $regex: search, $options: 'i' } }];
    const total = await this.customerModel.countDocuments(filter);
    const items = await this.customerModel.find(filter).sort({ createdAt: -1 }).skip((+page - 1) * +pageSize).limit(+pageSize);
    return {
      items: items.map((c) => this.profileService.toProfile(c)),
      page: +page,
      pageSize: +pageSize,
      totalCount: total,
    };
  }

  @Post('customers')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  createCustomer(@Body() body: CreateCustomerDto) {
    return this.profileService.createCustomer(body);
  }

  @Put('customers/:customerId')
  @Roles('SuperAdmin', 'Administrator', 'Operations')
  updateCustomer(@Param('customerId') customerId: string, @Body() body: UpdateCustomerDto) {
    return this.profileService.updateCustomer(customerId, body);
  }

  @Post('customers/:customerId/kyc/review')
  @Roles('SuperAdmin', 'Administrator', 'KycTeam')
  reviewKyc(@Param('customerId') customerId: string, @Body() body: ReviewKycDocumentDto) {
    return this.kycService.review(customerId, body.action, body.reason);
  }

  @Get('kyc/submissions')
  @Roles('SuperAdmin', 'Administrator', 'KycTeam')
  kycSubmissions(@Query('status') status?: string) {
    return this.kycService.listSubmissions(status);
  }

  @Post('kyc/submissions/:id/review')
  @Roles('SuperAdmin', 'Administrator', 'KycTeam')
  reviewKycDocument(
    @Req() req: Parameters<typeof actorFromRequest>[0],
    @Param('id') id: string,
    @Body() body: ReviewKycDocumentDto,
  ) {
    const actor = actorFromRequest(req);
    return this.kycService.reviewSubmission(id, body.action, body.reason, actor?.actorEmail);
  }

  @Get('payments')
  @Roles('SuperAdmin', 'Administrator', 'Finance')
  listPayments(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
  ) {
    return this.paymentsService.listAdmin({ status, search, page: +page });
  }

  @Post('payments/:id/refund')
  @Roles('SuperAdmin', 'Administrator', 'Finance')
  async refundPayment(
    @Req() req: Parameters<typeof actorFromRequest>[0],
    @Param('id') id: string,
    @Body() body: RefundPaymentDto,
  ) {
    const result = await this.paymentsService.refund(id, body.reason);
    await this.auditService.record({
      actor: actorFromRequest(req),
      action: 'payment.refund',
      entityType: 'Payment',
      entityId: id,
      after: { reason: body.reason, status: result.status },
    });
    return result;
  }

  @Get('promotions')
  listPromotions() {
    return this.promotionsService.list().then((items) => ({ items }));
  }

  @Post('promotions')
  @Roles('SuperAdmin', 'Administrator', 'Finance')
  createPromotion(@Body() body: { code: string; description?: string; discountType: string; discountValue: number; validFrom: string; validTo: string; maxUses?: number }) {
    return this.promotionsService.create({
      ...body,
      validFrom: new Date(body.validFrom),
      validTo: new Date(body.validTo),
    });
  }

  @Put('promotions/:id')
  @Roles('SuperAdmin', 'Administrator', 'Finance')
  updatePromotion(@Param('id') id: string, @Body() body: { description?: string; discountType?: string; discountValue?: number; validFrom?: string; validTo?: string; maxUses?: number; isActive?: boolean }) {
    return this.promotionsService.update(id, {
      ...body,
      validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
      validTo: body.validTo ? new Date(body.validTo) : undefined,
    });
  }

  @Get('reports/summary')
  reportSummary(@Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.getSummary(new Date(from), new Date(to));
  }

  @Get('reports/export')
  reportExport(@Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.exportCsv(new Date(from), new Date(to));
  }

  @Get('dashboard')
  dashboard() {
    return this.dashboardService.getSnapshot();
  }

  @Get('finance/reconciliation')
  reconciliation(@Query('from') from: string, @Query('to') to: string) {
    return this.paymentsService.getReconciliation(new Date(from), new Date(to));
  }
}
