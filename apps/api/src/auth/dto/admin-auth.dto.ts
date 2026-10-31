import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  ADMIN_ROLES,
  ACCOUNT_STATUSES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  WHEEL_CLASSES,
  INDIA_MOBILE_PATTERN,
  INDIA_VEHICLE_REG_PATTERN,
} from '@digi-switchride/shared';
import type { AdminRole } from '@digi-switchride/shared';

const PHONE = INDIA_MOBILE_PATTERN.source;
const VEHICLE_REG = INDIA_VEHICLE_REG_PATTERN.source;
const VEHICLE_NUMBER = '^[A-Za-z0-9][A-Za-z0-9\\s-]{1,31}$';

export class AdminLoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  tenantSlug?: string;
}

export class CreateAdminUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName!: string;

  @IsIn([...ADMIN_ROLES])
  role!: AdminRole;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  hubIds?: string[];
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName?: string;

  @IsOptional()
  @IsIn([...ADMIN_ROLES])
  role?: AdminRole;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  hubIds?: string[];
}

export class CreateCustomerDto {
  @IsString()
  @Matches(new RegExp(PHONE), { message: 'Enter a valid 10-digit Indian mobile number' })
  phone!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName!: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsMongoId()
  tenantId?: string;
}

export class UpdateCustomerDto {
  @IsOptional()
  @Matches(new RegExp(PHONE), { message: 'Enter a valid 10-digit Indian mobile number' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn([...ACCOUNT_STATUSES])
  accountStatus?: string;

  @IsOptional()
  @IsBoolean()
  forceUnassign?: boolean;
}

export class AssignRiderPlanDto {
  @IsMongoId()
  rentalPlanId!: string;
}

export class CreateVehicleDto {
  @IsString()
  @Matches(new RegExp(VEHICLE_NUMBER), { message: 'Enter a vehicle number using letters and digits (e.g. KA01AB1234)' })
  registrationNumber!: string;

  @IsIn([...VEHICLE_TYPES])
  type!: string;

  @IsOptional()
  @IsIn([...WHEEL_CLASSES])
  wheelClass?: string;

  @IsMongoId()
  hubId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  model!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  iotDeviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsMongoId()
  tenantId?: string;
}

export class UpdateVehicleDto {
  @IsOptional()
  @Matches(new RegExp(VEHICLE_NUMBER), { message: 'Enter a vehicle number using letters and digits (e.g. KA01AB1234)' })
  registrationNumber?: string;

  @IsOptional()
  @IsIn([...VEHICLE_TYPES])
  type?: string;

  @IsOptional()
  @IsIn([...WHEEL_CLASSES])
  wheelClass?: string;

  @IsOptional()
  @IsMongoId()
  hubId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsString()
  @MaxLength(64)
  iotDeviceId?: string | null;

  @IsOptional()
  @IsIn([...VEHICLE_STATUSES])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsMongoId()
  tenantId?: string;
}

export class UpdateIoTDeviceDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  vendorType?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsMongoId()
  vehicleId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsMongoId()
  tenantId?: string;
}

export class UpdateVehicleStatusDto {
  @IsIn([...VEHICLE_STATUSES])
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class AssignVehicleDto {
  @IsMongoId()
  riderId!: string;

  @IsOptional()
  @IsBoolean()
  override?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class UnassignVehicleDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class CreateHubDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  address!: string;

  @IsNumber()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @IsString()
  operatingHours?: string;

  @IsOptional()
  @IsNumber()
  geoFenceRadiusM?: number;

  @IsOptional()
  @IsMongoId()
  tenantId?: string;
}

export class ReviewKycDocumentDto {
  @IsIn(['Approve', 'Reject'])
  action!: 'Approve' | 'Reject';

  @ValidateIf((o) => o.action === 'Reject')
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  reason?: string;
}

export class CreateRentalPlanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsNumber()
  @Min(0)
  charges!: number;

  @IsNumber()
  @Min(1)
  durationDays!: number;

  @IsIn(['Weekly', 'Monthly', 'Quarterly'])
  billingFrequency!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  eligibility?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  terms?: string;

  @IsOptional()
  @IsMongoId()
  tenantId?: string;
}

export class UpdateRentalPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  charges?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  durationDays?: number;

  @IsOptional()
  @IsIn(['Weekly', 'Monthly', 'Quarterly'])
  billingFrequency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  eligibility?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  terms?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class WalletAdjustDto {
  @IsIn(['Credit', 'Debit'])
  type!: 'Credit' | 'Debit';

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @MinLength(5)
  @MaxLength(300)
  note!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference?: string;
}

export class RefundPaymentDto {
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason!: string;
}

export class CreateBreakdownDto {
  @IsMongoId()
  riderId!: string;

  @IsMongoId()
  vehicleId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  issueType!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  description!: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsMongoId()
  tenantId?: string;
}

export class BreakdownActionDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  note!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  assignedTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  escalatedTo?: string;
}

export class CreateServiceCentreDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  address!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  contactName!: string;

  @IsString()
  @Matches(new RegExp(PHONE), { message: 'Enter a valid 10-digit Indian mobile number' })
  contactPhone!: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}

export class UpdateServiceCentreDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  contactName?: string;

  @IsOptional()
  @Matches(new RegExp(PHONE), { message: 'Enter a valid 10-digit Indian mobile number' })
  contactPhone?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateServiceSlotDto {
  @IsMongoId()
  centreId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD' })
  date!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Start time must be HH:mm' })
  startTime!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'End time must be HH:mm' })
  endTime!: string;

  @IsNumber()
  @Min(1)
  capacity!: number;
}

export class CreateServiceRequestDto {
  @IsMongoId()
  riderId!: string;

  @IsOptional()
  @IsMongoId()
  vehicleId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  category!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  description!: string;
}

export class UpdateServiceRequestDto {
  @IsOptional()
  @IsIn(['Open', 'Assigned', 'InProgress', 'Completed', 'Cancelled'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  assignedTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  progressNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  completionNote?: string;
}

export class CreateAppointmentDto {
  @IsMongoId()
  riderId!: string;

  @IsMongoId()
  centreId!: string;

  @IsMongoId()
  slotId!: string;

  @IsOptional()
  @IsMongoId()
  vehicleId?: string;

  @IsOptional()
  @IsMongoId()
  serviceRequestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

export class RescheduleAppointmentDto {
  @IsMongoId()
  slotId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

export class CancelAppointmentDto {
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason!: string;
}

export class CreateChargingStationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  address!: string;

  @IsNumber()
  @Min(1)
  chargerCount!: number;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  operatingHours?: string;

  @IsOptional()
  @IsMongoId()
  hubId?: string;

  @IsOptional()
  @IsMongoId()
  tenantId?: string;
}

export class UpdateChargingStationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  chargerCount?: number;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  operatingHours?: string;

  @IsOptional()
  @IsIn(['Active', 'Inactive', 'Maintenance'])
  status?: string;

  @IsOptional()
  @IsMongoId()
  hubId?: string;
}

export class CreateNotificationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  body!: string;

  @IsIn(['AllRiders', 'ActiveRiders'])
  audience!: string;
}

export class CreateFeedbackDto {
  @IsMongoId()
  riderId!: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  comment!: string;

  @IsOptional()
  @IsIn(['Ride', 'Service', 'App', 'Vehicle'])
  category?: string;
}

export class CreateAgreementDto {
  @IsMongoId()
  riderId!: string;

  @IsIn(['RentalAgreement', 'ServiceWaiver', 'KYCConsent'])
  type!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(8000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  documentUrl?: string;
}

export class ApplyReferralDto {
  @IsMongoId()
  riderId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(20)
  code!: string;
}

export class UpdateSupportTicketDto {
  @IsOptional()
  @IsIn(['Open', 'InProgress', 'Resolved', 'Closed'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  assignedTo?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  note?: string;
}

export class CreateSupportTicketDto {
  @IsMongoId()
  riderId!: string;

  @IsIn(['Ride', 'Payment', 'KYC', 'Vehicle', 'General'])
  category!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  description!: string;
}
