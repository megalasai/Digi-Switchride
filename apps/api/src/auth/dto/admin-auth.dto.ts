import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  ADMIN_ROLES,
  ACCOUNT_STATUSES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  INDIA_MOBILE_PATTERN,
  INDIA_VEHICLE_REG_PATTERN,
} from '@digi-switchride/shared';
import type { AdminRole } from '@digi-switchride/shared';

const PHONE = INDIA_MOBILE_PATTERN.source;
const VEHICLE_REG = INDIA_VEHICLE_REG_PATTERN.source;

export class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
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
  @Matches(new RegExp(VEHICLE_REG), { message: 'Enter a valid Indian registration (e.g. KA01AB1234)' })
  registrationNumber!: string;

  @IsIn([...VEHICLE_TYPES])
  type!: string;

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
}

export class UpdateVehicleDto {
  @IsOptional()
  @Matches(new RegExp(VEHICLE_REG), { message: 'Enter a valid Indian registration (e.g. KA01AB1234)' })
  registrationNumber?: string;

  @IsOptional()
  @IsIn([...VEHICLE_TYPES])
  type?: string;

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
}
