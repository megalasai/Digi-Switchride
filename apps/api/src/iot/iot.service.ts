import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { IoTDevice, IoTDeviceDocument, Vehicle, VehicleDocument } from '../schemas/fleet.schema';

@Injectable()
export class IoTService {
  constructor(
    @InjectModel(IoTDevice.name) private deviceModel: Model<IoTDeviceDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
  ) {}

  async registerDevice(deviceId: string, vendorType = 'Simulator', vehicleId?: string) {
    const existing = await this.deviceModel.findOne({ deviceId });
    if (existing) throw new ConflictException(`Device ${deviceId} already exists`);

    await this.deviceModel.create({ deviceId, vendorType, connectionStatus: 'Unknown' });
    if (vehicleId) {
      await this.linkDeviceToVehicle(deviceId, vehicleId, vendorType);
    }
    return { deviceId, vendorType, vehicleId: vehicleId ?? null };
  }

  async sendCommand(deviceId: string, command: string) {
    await this.deviceModel.findOneAndUpdate(
      { deviceId },
      { deviceId, vendorType: 'Simulator' },
      { upsert: true, setDefaultsOnInsert: true },
    );
    console.log(`[IoT] Command '${command}' sent to device ${deviceId}`);
    return { commandId: randomUUID(), status: 'Sent' };
  }

  async listDevices() {
    const devices = await this.deviceModel.find().sort({ deviceId: 1 });
    return Promise.all(
      devices.map(async (d) => {
        const vehicle = await this.resolveVehicle(d.deviceId);
        return {
          id: d.deviceId,
          vehicleId: vehicle?._id.toString() ?? d.vehicleId,
          vehicleRegistration: vehicle?.registrationNumber,
          vendorType: d.vendorType,
          connectionStatus: d.connectionStatus,
          lastSeenAt: d.lastSeenAt,
          batteryPercent: d.batteryPercent,
          odometerKm: d.odometerKm,
          lastLocation: d.lastLat != null && d.lastLng != null ? { lat: d.lastLat, lng: d.lastLng } : null,
        };
      }),
    );
  }

  /** Establish bidirectional mapping: device ↔ vehicle */
  async linkDeviceToVehicle(deviceId: string, vehicleId: string, vendorType = 'Simulator') {
    const vehicle = await this.vehicleModel.findById(vehicleId);
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const deviceTaken = await this.vehicleModel.findOne({
      iotDeviceId: deviceId,
      _id: { $ne: vehicleId },
    });
    if (deviceTaken) {
      throw new ConflictException(`Device ${deviceId} is already linked to vehicle ${deviceTaken.registrationNumber}`);
    }

    const vehicleTaken = await this.deviceModel.findOne({
      vehicleId,
      deviceId: { $ne: deviceId },
    });
    if (vehicleTaken) {
      throw new ConflictException(`Vehicle is already linked to device ${vehicleTaken.deviceId}`);
    }

    if (vehicle.iotDeviceId && vehicle.iotDeviceId !== deviceId) {
      await this.deviceModel.updateOne({ deviceId: vehicle.iotDeviceId }, { $unset: { vehicleId: 1 } });
    }

    await this.deviceModel.findOneAndUpdate(
      { deviceId },
      { deviceId, vehicleId, vendorType },
      { upsert: true, setDefaultsOnInsert: true },
    );

    vehicle.iotDeviceId = deviceId;
    if (vehicle.status === 'Offline') {
      vehicle.status = 'Available';
    }
    await vehicle.save();

    return {
      deviceId,
      vehicleId,
      vehicleRegistration: vehicle.registrationNumber,
    };
  }

  async updateDevice(deviceId: string, data: { vendorType?: string; vehicleId?: string | null }) {
    const device = await this.deviceModel.findOne({ deviceId });
    if (!device) throw new NotFoundException('Device not found');

    if (data.vendorType != null) device.vendorType = data.vendorType;

    if (data.vehicleId !== undefined) {
      if (data.vehicleId) {
        await this.linkDeviceToVehicle(deviceId, data.vehicleId, device.vendorType);
      } else {
        await this.unlinkDevice(deviceId);
      }
    } else if (data.vendorType != null) {
      await device.save();
    }

    return this.listDevices().then((items) => items.find((d) => d.id === deviceId));
  }

  async unlinkDevice(deviceId: string) {
    const device = await this.deviceModel.findOne({ deviceId });
    if (!device) throw new NotFoundException('Device not found');

    await this.vehicleModel.updateMany({ iotDeviceId: deviceId }, { $unset: { iotDeviceId: 1 } });
    if (device.vehicleId) {
      await this.vehicleModel.updateOne({ _id: device.vehicleId, iotDeviceId: deviceId }, { $unset: { iotDeviceId: 1 } });
    }
    await this.deviceModel.updateOne({ deviceId }, { $unset: { vehicleId: 1 } });

    return { deviceId, unlinked: true };
  }

  async updateTelemetry(deviceId: string, lat: number, lng: number, battery: number, odometer: number) {
    const now = new Date();

    const device = await this.deviceModel.findOneAndUpdate(
      { deviceId },
      {
        lastLat: lat,
        lastLng: lng,
        batteryPercent: battery,
        odometerKm: odometer,
        lastSeenAt: now,
        connectionStatus: 'Connected',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const vehicle = await this.resolveVehicle(deviceId);
    if (!vehicle) {
      return { deviceId, vehicleId: null, updated: false, message: 'No vehicle mapped to this device' };
    }

    if (device.vehicleId !== vehicle._id.toString()) {
      device.vehicleId = vehicle._id.toString();
      await device.save();
    }
    if (vehicle.iotDeviceId !== deviceId) {
      vehicle.iotDeviceId = deviceId;
    }

    vehicle.batteryPercent = battery;
    vehicle.odometerKm = odometer;
    vehicle.lastLat = lat;
    vehicle.lastLng = lng;
    vehicle.lastTelemetryAt = now;
    if (vehicle.status === 'Offline') {
      vehicle.status = 'Available';
    }
    await vehicle.save();

    return {
      deviceId,
      vehicleId: vehicle._id.toString(),
      vehicleRegistration: vehicle.registrationNumber,
      batteryPercent: battery,
      odometerKm: odometer,
      updated: true,
    };
  }

  private async resolveVehicle(deviceId: string): Promise<VehicleDocument | null> {
    const device = await this.deviceModel.findOne({ deviceId });
    if (device?.vehicleId) {
      const byId = await this.vehicleModel.findById(device.vehicleId);
      if (byId) return byId;
    }
    return this.vehicleModel.findOne({ iotDeviceId: deviceId });
  }
}
