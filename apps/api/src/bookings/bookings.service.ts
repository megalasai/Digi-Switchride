import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { BookingType } from '@digi-switchride/shared';
import { Booking, BookingDocument, Payment, PaymentDocument, Promotion, PromotionDocument, Ride, RideDocument } from '../schemas/booking.schema';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import { Vehicle, VehicleDocument } from '../schemas/fleet.schema';
import { calculateGst, calculateRideFare, estimateFare, toGeoLocation } from '../common/helpers';
import { IoTService } from '../iot/iot.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Ride.name) private rideModel: Model<RideDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(Promotion.name) private promotionModel: Model<PromotionDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private iotService: IoTService,
  ) {}

  async create(customerId: string, vehicleId: string, bookingType: BookingType, promoCode?: string) {
    const customer = await this.customerModel.findById(customerId);
    if (!customer || customer.kycStatus !== 'Approved') {
      throw new BadRequestException('KYC must be approved before booking');
    }

    const vehicle = await this.vehicleModel.findById(vehicleId);
    if (!vehicle || vehicle.status !== 'Available') {
      throw new BadRequestException('Vehicle is not available');
    }

    let estimated = estimateFare(bookingType);
    if (promoCode) {
      const promo = await this.promotionModel.findOne({
        code: promoCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validTo: { $gte: new Date() },
      });
      if (promo) {
        estimated = promo.discountType === 'Percentage'
          ? estimated * (1 - promo.discountValue / 100)
          : Math.max(0, estimated - promo.discountValue);
        promo.currentUses += 1;
        await promo.save();
      }
    }

    const booking = await this.bookingModel.create({
      customerId,
      vehicleId,
      hubId: vehicle.hubId,
      bookingType,
      status: 'Confirmed',
      estimatedAmount: estimated,
      promoCode,
    });

    const ride = await this.rideModel.create({
      bookingId: booking._id.toString(),
      vehicleId,
      customerId,
    });

    vehicle.status = 'Reserved';
    await vehicle.save();

    return this.toBooking(booking, ride._id.toString());
  }

  async get(bookingId: string) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');
    const ride = await this.rideModel.findOne({ bookingId });
    return this.toBooking(booking, ride?._id.toString());
  }

  async list(customerId: string, status?: string, page = 1, pageSize = 20) {
    const filter: Record<string, unknown> = { customerId };
    if (status) filter.status = status;
    const total = await this.bookingModel.countDocuments(filter);
    const items = await this.bookingModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize);
    const result = await Promise.all(items.map(async (b) => {
      const ride = await this.rideModel.findOne({ bookingId: b._id.toString() });
      return this.toBooking(b, ride?._id.toString());
    }));
    return { items: result, page, pageSize, totalCount: total };
  }

  async cancel(bookingId: string) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');
    if (['Completed', 'Cancelled'].includes(booking.status)) {
      throw new BadRequestException('Cannot cancel this booking');
    }
    booking.status = 'Cancelled';
    await booking.save();
    await this.vehicleModel.findByIdAndUpdate(booking.vehicleId, { status: 'Available' });
    const ride = await this.rideModel.findOne({ bookingId });
    return this.toBooking(booking, ride?._id.toString());
  }

  async adminList(status?: string, page = 1, pageSize = 20) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const total = await this.bookingModel.countDocuments(filter);
    const items = await this.bookingModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize);
    const result = await Promise.all(items.map(async (b) => {
      const ride = await this.rideModel.findOne({ bookingId: b._id.toString() });
      return this.toBooking(b, ride?._id.toString());
    }));
    return { items: result, page, pageSize, totalCount: total };
  }

  async startRide(rideId: string, customerId: string, idempotencyKey?: string, location?: { lat: number; lng: number }) {
    const ride = await this.rideModel.findById(rideId);
    if (!ride || ride.customerId !== customerId) throw new NotFoundException('Ride not found');

    if (ride.status === 'InProgress') return this.toRide(ride);
    if (idempotencyKey) {
      const existing = await this.rideModel.findOne({ startIdempotencyKey: idempotencyKey });
      if (existing) return this.toRide(existing);
    }

    ride.status = 'InProgress';
    ride.startedAt = new Date();
    ride.startIdempotencyKey = idempotencyKey;
    if (location) ride.startLocation = toGeoLocation(location.lat, location.lng);
    await ride.save();

    const booking = await this.bookingModel.findByIdAndUpdate(ride.bookingId, { status: 'Active', startTime: ride.startedAt }, { new: true });
    const vehicle = await this.vehicleModel.findById(ride.vehicleId);
    if (vehicle) {
      vehicle.status = 'InRide';
      await vehicle.save();
      if (vehicle.iotDeviceId) await this.iotService.sendCommand(vehicle.iotDeviceId, 'Unlock');
    }

    return this.toRide(ride);
  }

  async endRide(rideId: string, customerId: string, idempotencyKey?: string, location?: { lat: number; lng: number }) {
    const ride = await this.rideModel.findById(rideId);
    if (!ride || ride.customerId !== customerId) throw new NotFoundException('Ride not found');

    if (ride.status === 'Ended') {
      return { ride: this.toRide(ride), fare: ride.finalFare ?? 0, paymentId: null, invoiceUrl: null };
    }

    ride.status = 'Ended';
    ride.endedAt = new Date();
    ride.endIdempotencyKey = idempotencyKey;
    if (location) ride.endLocation = toGeoLocation(location.lat, location.lng);
    ride.durationMinutes = ride.startedAt ? Math.floor((ride.endedAt.getTime() - ride.startedAt.getTime()) / 60000) : 0;

    const booking = await this.bookingModel.findById(ride.bookingId);
    ride.finalFare = calculateRideFare(ride.durationMinutes ?? 0, booking?.bookingType ?? 'PerMinute');
    await ride.save();

    if (booking) {
      booking.status = 'Completed';
      booking.endTime = ride.endedAt;
      await booking.save();
    }

    const vehicle = await this.vehicleModel.findById(ride.vehicleId);
    if (vehicle) {
      vehicle.status = 'Available';
      await vehicle.save();
      if (vehicle.iotDeviceId) await this.iotService.sendCommand(vehicle.iotDeviceId, 'Lock');
    }

    const gst = calculateGst(ride.finalFare ?? 0);
    const payment = await this.paymentModel.create({
      customerId,
      bookingId: ride.bookingId,
      amount: (ride.finalFare ?? 0) + gst,
      gstAmount: gst,
      status: 'Created',
    });

    return { ride: this.toRide(ride), fare: ride.finalFare ?? 0, paymentId: payment._id.toString(), invoiceUrl: null };
  }

  async getActiveRide(customerId: string) {
    const ride = await this.rideModel.findOne({ customerId, status: 'InProgress' });
    return ride ? this.toRide(ride) : null;
  }

  async getHistory(customerId: string, page = 1, pageSize = 20) {
    const filter = { customerId, status: 'Ended' };
    const total = await this.rideModel.countDocuments(filter);
    const items = await this.rideModel.find(filter).sort({ endedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize);
    return { items: items.map((r) => this.toRide(r)), page, pageSize, totalCount: total };
  }

  async getActiveRidesAdmin() {
    const rides = await this.rideModel.find({ status: 'InProgress' });
    return rides.map((r) => this.toRide(r));
  }

  private toBooking(b: BookingDocument, rideId?: string) {
    return {
      id: b._id.toString(),
      customerId: b.customerId,
      vehicleId: b.vehicleId,
      hubId: b.hubId,
      bookingType: b.bookingType,
      status: b.status,
      estimatedAmount: b.estimatedAmount,
      currency: b.currency,
      rideId,
      createdAt: (b as any).createdAt,
      startTime: b.startTime,
      endTime: b.endTime,
    };
  }

  private toRide(r: RideDocument) {
    const start = r.startLocation?.coordinates;
    const end = r.endLocation?.coordinates;
    return {
      id: r._id.toString(),
      bookingId: r.bookingId,
      vehicleId: r.vehicleId,
      status: r.status,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      startLocation: start ? { lat: start[1], lng: start[0] } : null,
      endLocation: end ? { lat: end[1], lng: end[0] } : null,
      durationMinutes: r.durationMinutes,
      distanceKm: r.distanceKm,
    };
  }
}
