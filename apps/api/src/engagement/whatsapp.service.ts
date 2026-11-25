import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PRODUCT_NAME } from '@digi-switchride/shared';
import { normalizeIndiaPhone } from '../common/helpers';
import { currentTenantId } from '../common/tenant-als';
import { TenantsService } from '../tenants/tenants.service';
import { AppNotification, AppNotificationDocument } from '../schemas/engagement.schema';

export type BookingConfirmedWhatsApp = {
  riderPhone?: string;
  tenantId?: string;
  vehicleModel?: string;
  registrationNumber?: string;
  pickupAt: Date;
  returnAt: Date;
  verificationUrl?: string;
};

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private config: ConfigService,
    private tenants: TenantsService,
    @InjectModel(AppNotification.name) private notificationModel: Model<AppNotificationDocument>,
  ) {}

  async notifyBookingConfirmed(data: BookingConfirmedWhatsApp) {
    try {
      const tenantName = await this.tenantName(data.tenantId || currentTenantId() || undefined);
      const body = this.bookingConfirmedMessage({
        tenantName,
        vehicleModel: data.vehicleModel?.trim() || 'Vehicle',
        registrationNumber: data.registrationNumber?.trim() || '',
        pickupAt: data.pickupAt,
        returnAt: data.returnAt,
        verificationUrl: data.verificationUrl || this.config.get<string>('DIGILOCKER_VERIFICATION_URL') || this.defaultVerificationUrl(),
      });
      const sent = await this.sendText(data.riderPhone, body);
      await this.notificationModel.create({
        title: 'Booking confirmed — action needed',
        body,
        audience: 'ActiveRiders',
        channel: 'WhatsApp',
        status: sent ? 'Sent' : 'Queued',
        sentAt: sent ? new Date() : undefined,
      });
      return { sent, body };
    } catch (err) {
      this.logger.warn(`WhatsApp booking message skipped: ${err instanceof Error ? err.message : err}`);
      return { sent: false, body: '' };
    }
  }

  bookingConfirmedMessage(input: {
    tenantName: string;
    vehicleModel: string;
    registrationNumber: string;
    pickupAt: Date;
    returnAt: Date;
    verificationUrl: string;
  }) {
    const vehicleLine = input.registrationNumber
      ? `${input.vehicleModel} (${input.registrationNumber})`
      : input.vehicleModel;
    return [
      'Booking confirmed — action needed',
      '',
      `Hi! Your rental with ${input.tenantName} is confirmed.`,
      '',
      'Vehicle',
      vehicleLine,
      '',
      'Rental Period',
      `Pickup: ${this.formatWhen(input.pickupAt)}`,
      `Return: ${this.formatWhen(input.returnAt)}`,
      '',
      'Please complete your details and DigiLocker verification here before pickup:',
      input.verificationUrl,
      '',
      'This takes a few minutes. Once done, our team can hand over the vehicle.',
      '',
      'Regards,',
      input.tenantName,
    ].join('\n');
  }

  addRentalPeriod(start: Date, bookingType?: string, durationDays?: number) {
    const end = new Date(start);
    if (durationDays && durationDays > 0) {
      end.setDate(end.getDate() + durationDays);
      return end;
    }
    switch (bookingType) {
      case 'Hourly':
        end.setHours(end.getHours() + 1);
        break;
      case 'Daily':
        end.setDate(end.getDate() + 1);
        break;
      case 'Weekly':
        end.setDate(end.getDate() + 7);
        break;
      case 'Quarterly':
        end.setMonth(end.getMonth() + 3);
        break;
      case 'Monthly':
      default:
        end.setMonth(end.getMonth() + 1);
        break;
    }
    return end;
  }

  private formatWhen(value: Date) {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    })
      .format(value)
      .replace(',', ',');
  }

  private async tenantName(tenantId?: string) {
    if (!tenantId) return PRODUCT_NAME;
    try {
      const tenant = await this.tenants.findById(tenantId);
      return tenant?.name || PRODUCT_NAME;
    } catch {
      return PRODUCT_NAME;
    }
  }

  private defaultVerificationUrl() {
    const publicApp = this.config.get<string>('PUBLIC_APP_URL') || this.config.get<string>('CORS_ORIGIN') || '';
    const origin = publicApp.split(',')[0]?.trim().replace(/\/$/, '');
    return origin ? `${origin}/kyc` : 'https://digilocker.gov.in';
  }

  private async sendText(phone: string | undefined, body: string) {
    const token = this.config.get<string>('WHATSAPP_TOKEN')?.trim();
    const phoneId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID')?.trim();
    if (!token || !phoneId || !phone) {
      this.logger.log('WhatsApp is not configured or rider has no phone; message queued.');
      return false;
    }
    const to = `91${normalizeIndiaPhone(phone)}`;
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body, preview_url: true },
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      this.logger.warn(`WhatsApp API ${res.status}: ${detail.slice(0, 400)}`);
      return false;
    }
    return true;
  }
}
