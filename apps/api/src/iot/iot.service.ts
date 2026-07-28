import { Injectable } from '@nestjs/common';
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

  async sendCommand(deviceId: string, command: string) {
    let device = await this.deviceModel.findOne({ deviceId });
    if (!device) {
      device = await this.deviceModel.create({ deviceId, vendorType: 'Simulator' });
    }
    console.log(`[IoT] Command '${command}' sent to device ${deviceId}`);
    return { commandId: randomUUID(), status: 'Sent' };
  }

  async listDevices() {
    const devices = await this.deviceModel.find();
    return devices.map((d) => ({
      id: d.deviceId,
      vehicleId: d.vehicleId,
      vendorType: d.vendorType,
      connectionStatus: d.connectionStatus,
      lastSeenAt: d.lastSeenAt,
      batteryPercent: d.batteryPercent,
      lastLocation: d.lastLat != null && d.lastLng != null ? { lat: d.lastLat, lng: d.lastLng } : null,
    }));
  }

  async updateTelemetry(deviceId: string, lat: number, lng: number, battery: number, odometer: number) {
    await this.deviceModel.findOneAndUpdate(
      { deviceId },
      { lastLat: lat, lastLng: lng, batteryPercent: battery, lastSeenAt: new Date(), connectionStatus: 'Connected' },
    );
    await this.vehicleModel.findOneAndUpdate({ iotDeviceId: deviceId }, { batteryPercent: battery, odometerKm: odometer });
  }
}
