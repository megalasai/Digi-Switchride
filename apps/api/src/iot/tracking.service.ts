import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from '../schemas/customer.schema';
import { Booking, BookingDocument, Ride, RideDocument } from '../schemas/booking.schema';
import { IoTDevice, IoTDeviceDocument, RentalHub, RentalHubDocument, Vehicle, VehicleDocument } from '../schemas/fleet.schema';
import { toGeoLocation } from '../common/helpers';
import { IoTService } from './iot.service';

export const SAMPLE_TRACK = {
  registrationNumber: 'KA01SR9999',
  deviceId: 'SIM-TRACK-DEMO',
  riderPhone: '9999900001',
  riderName: 'Demo Track Rider',
  hubName: 'Indiranagar Demo Hub',
};

const LOOP: { lat: number; lng: number }[] = [
  { lat: 12.9784, lng: 77.6408 },
  { lat: 12.9796, lng: 77.6431 },
  { lat: 12.9781, lng: 77.6456 },
  { lat: 12.9758, lng: 77.6468 },
  { lat: 12.9734, lng: 77.6452 },
  { lat: 12.9722, lng: 77.6424 },
  { lat: 12.9736, lng: 77.6401 },
  { lat: 12.9761, lng: 77.6392 },
];

@Injectable()
export class TrackingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackingService.name);
  private timer: NodeJS.Timeout | null = null;
  private track360Timer: NodeJS.Timeout | null = null;
  private step = 0;

  constructor(
    @InjectModel(RentalHub.name) private hubModel: Model<RentalHubDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(IoTDevice.name) private deviceModel: Model<IoTDeviceDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Ride.name) private rideModel: Model<RideDocument>,
    private iotService: IoTService,
  ) {}

  async onModuleInit() {
    await this.relaxDeviceVehicleIndex();
    await this.stringifyTenantIds();
    try {
      await this.ensureSampleActiveRide();
      this.timer = setInterval(() => {
        void this.tickSampleVehicle();
      }, 5000);
      this.logger.log(`Sample active vehicle ${SAMPLE_TRACK.registrationNumber} is moving every 5s with a 90s location trail`);
    } catch (error) {
      this.logger.warn(`Could not seed sample tracking vehicle: ${error instanceof Error ? error.message : error}`);
    }
    try {
      await this.iotService.provisionAllDevices();
    } catch (error) {
      this.logger.warn(`Could not provision IoT vehicles: ${error instanceof Error ? error.message : error}`);
    }
    void this.iotService.syncTrack360({ allTenants: true }).catch((error) => {
      this.logger.warn(`Track360 first sync skipped: ${error instanceof Error ? error.message : error}`);
    });
    this.track360Timer = setInterval(() => {
      void this.iotService.syncTrack360({ allTenants: true }).catch((error) => {
        this.logger.warn(`GPS sync skipped: ${error instanceof Error ? error.message : error}`);
      });
    }, 30000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.track360Timer) clearInterval(this.track360Timer);
  }

  private async stringifyTenantIds() {
    const db = this.deviceModel.db;
    for (const name of ['iot_devices', 'vehicles', 'gps_integrations', 'rental_hubs']) {
      try {
        const col = db.collection(name);
        const rows = await col.find({ tenantId: { $type: 'objectId' } }).toArray();
        for (const row of rows) {
          await col.updateOne({ _id: row._id }, { $set: { tenantId: String(row.tenantId) } });
        }
        if (rows.length) this.logger.log(`Normalized ${rows.length} ${name} tenantId values to strings`);
      } catch (error) {
        this.logger.warn(`Could not normalize ${name} tenantId: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  private async relaxDeviceVehicleIndex() {
    try {
      const deviceIndexes = await this.deviceModel.collection.indexes();
      for (const index of deviceIndexes) {
        const keys = index.key as Record<string, number>;
        const only = Object.keys(keys);
        if (index.unique && keys?.vehicleId === 1 && only.length === 1) {
          await this.deviceModel.collection.dropIndex(index.name as string);
          this.logger.log('Dropped unique iot_devices.vehicleId index that caused duplicate-key errors');
        }
        if (index.unique && keys?.deviceId === 1 && only.length === 1) {
          await this.deviceModel.collection.dropIndex(index.name as string);
          this.logger.log('Dropped global unique iot_devices.deviceId so each tenant can own its GPS devices');
        }
      }
      await this.deviceModel.collection.createIndex({ vehicleId: 1 }, { sparse: true, background: true });
      await this.deviceModel.collection.createIndex({ tenantId: 1, deviceId: 1 }, { unique: true, background: true });
    } catch (error) {
      this.logger.warn(`Could not relax IoT device indexes: ${error instanceof Error ? error.message : error}`);
    }
    try {
      const vehicleIndexes = await this.vehicleModel.collection.indexes();
      for (const index of vehicleIndexes) {
        const keys = index.key as Record<string, number>;
        if (index.unique && keys?.iotDeviceId === 1 && Object.keys(keys).length === 1) {
          await this.vehicleModel.collection.dropIndex(index.name as string);
          this.logger.log('Dropped global unique vehicles.iotDeviceId so GPS vehicles stay on their tenant');
        }
      }
      await this.vehicleModel.collection.createIndex(
        { tenantId: 1, iotDeviceId: 1 },
        { unique: true, sparse: true, background: true },
      );
    } catch (error) {
      this.logger.warn(`Could not relax vehicle IoT indexes: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async ensureSampleActiveRide() {
    const hub =
      (await this.hubModel.findOne({ name: SAMPLE_TRACK.hubName })) ??
      (await this.hubModel.findOne({ status: 'Active' })) ??
      (await this.hubModel.create({
        name: SAMPLE_TRACK.hubName,
        address: '100 Feet Road, Indiranagar, Bengaluru',
        location: toGeoLocation(12.9784, 77.6408),
        capacity: 20,
        status: 'Active',
      }));

    const rider =
      (await this.customerModel.findOne({ phone: SAMPLE_TRACK.riderPhone })) ??
      (await this.customerModel.create({
        phone: SAMPLE_TRACK.riderPhone,
        fullName: SAMPLE_TRACK.riderName,
        email: 'demo.track@digiswitchride.com',
        kycStatus: 'Approved',
        accountStatus: 'Active',
        address: 'Indiranagar, Bengaluru',
      }));

    let vehicle = await this.vehicleModel.findOne({ registrationNumber: SAMPLE_TRACK.registrationNumber });
    if (!vehicle) {
      vehicle = await this.vehicleModel.create({
        registrationNumber: SAMPLE_TRACK.registrationNumber,
        type: 'EScooter',
        model: 'Switch Metro Demo',
        hubId: hub._id.toString(),
        status: 'InRide',
        batteryPercent: 86,
        odometerKm: 412,
        iotDeviceId: SAMPLE_TRACK.deviceId,
        assignedRiderId: rider._id.toString(),
        lastLat: LOOP[0].lat,
        lastLng: LOOP[0].lng,
        lastTelemetryAt: new Date(),
        lastPlace: 'Indiranagar, Bengaluru',
        wheelClass: 'TwoWheeler',
        notes: 'Sample vehicle for live ride tracking',
      });
    } else {
      vehicle.hubId = hub._id.toString();
      vehicle.status = 'InRide';
      vehicle.iotDeviceId = SAMPLE_TRACK.deviceId;
      vehicle.assignedRiderId = rider._id.toString();
      if (vehicle.lastLat == null) vehicle.lastLat = LOOP[0].lat;
      if (vehicle.lastLng == null) vehicle.lastLng = LOOP[0].lng;
      await vehicle.save();
    }

    rider.assignedVehicleId = vehicle._id.toString();
    if (rider.kycStatus !== 'Approved') rider.kycStatus = 'Approved';
    if (rider.accountStatus !== 'Active') rider.accountStatus = 'Active';
    await rider.save();

    await this.deviceModel.findOneAndUpdate(
      { deviceId: SAMPLE_TRACK.deviceId },
      {
        deviceId: SAMPLE_TRACK.deviceId,
        vehicleId: vehicle._id.toString(),
        vendorType: 'Simulator',
        connectionStatus: 'Connected',
        lastSeenAt: new Date(),
        lastLat: vehicle.lastLat,
        lastLng: vehicle.lastLng,
        batteryPercent: vehicle.batteryPercent,
        odometerKm: vehicle.odometerKm,
      },
      { upsert: true, setDefaultsOnInsert: true },
    );

    let ride = await this.rideModel.findOne({ vehicleId: vehicle._id.toString(), status: 'InProgress' });
    if (!ride) {
      const booking = await this.bookingModel.create({
        customerId: rider._id.toString(),
        vehicleId: vehicle._id.toString(),
        hubId: hub._id.toString(),
        bookingType: 'PerMinute',
        status: 'Active',
        estimatedAmount: 50,
        startTime: new Date(),
      });
      ride = await this.rideModel.create({
        bookingId: booking._id.toString(),
        vehicleId: vehicle._id.toString(),
        customerId: rider._id.toString(),
        status: 'InProgress',
        startedAt: new Date(),
        startLocation: toGeoLocation(LOOP[0].lat, LOOP[0].lng),
      });
    }

    await this.iotService.updateTelemetry(SAMPLE_TRACK.deviceId, LOOP[0].lat, LOOP[0].lng, vehicle.batteryPercent, vehicle.odometerKm, {
      speedKmh: 18,
      ignition: 'ON',
    });
    this.logger.log(`Sample ride ${ride._id.toString()} is active for ${SAMPLE_TRACK.registrationNumber}`);
  }

  private async tickSampleVehicle() {
    try {
      const vehicle = await this.vehicleModel.findOne({ registrationNumber: SAMPLE_TRACK.registrationNumber });
      if (!vehicle || vehicle.status !== 'InRide') return;
      this.step = (this.step + 1) % LOOP.length;
      const point = LOOP[this.step];
      const battery = Math.max(18, (vehicle.batteryPercent ?? 86) - 0.05);
      const odometer = (vehicle.odometerKm ?? 412) + 0.04;
      await this.iotService.updateTelemetry(SAMPLE_TRACK.deviceId, point.lat, point.lng, Number(battery.toFixed(2)), Number(odometer.toFixed(2)), {
        speedKmh: 12 + (this.step % 8),
        ignition: 'ON',
      });
    } catch (error) {
      this.logger.debug(`Sample telemetry tick skipped: ${error instanceof Error ? error.message : error}`);
    }
  }
}
