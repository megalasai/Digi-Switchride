import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService, PromotionsService, ReportsService } from './payments.service';
import { KycService, ProfileService } from '../customers/customers.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from '../schemas/customer.schema';

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
@UseGuards(AuthGuard('jwt'))
export class AdminController {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    private profileService: ProfileService,
    private kycService: KycService,
    private promotionsService: PromotionsService,
    private reportsService: ReportsService,
    private paymentsService: PaymentsService,
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

  @Post('customers/:customerId/kyc/review')
  reviewKyc(@Param('customerId') customerId: string, @Body() body: { action: 'Approve' | 'Reject'; reason?: string }) {
    return this.kycService.review(customerId, body.action, body.reason);
  }

  @Get('promotions')
  listPromotions() {
    return this.promotionsService.list().then((items) => ({ items }));
  }

  @Post('promotions')
  createPromotion(@Body() body: { code: string; description?: string; discountType: string; discountValue: number; validFrom: string; validTo: string; maxUses?: number }) {
    return this.promotionsService.create({
      ...body,
      validFrom: new Date(body.validFrom),
      validTo: new Date(body.validTo),
    });
  }

  @Get('reports/summary')
  reportSummary(@Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.getSummary(new Date(from), new Date(to));
  }

  @Get('finance/reconciliation')
  reconciliation(@Query('from') from: string, @Query('to') to: string) {
    return this.paymentsService.getReconciliation(new Date(from), new Date(to));
  }
}
