import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const APPLICATION_ID = '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$';

export class CreateTrackingPartnerDto {
  @Matches(new RegExp(APPLICATION_ID), { message: 'applicationId must be a lowercase slug such as schoolapplication' })
  applicationId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  tenantIds?: string[];
}

export class UpdateTrackingPartnerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsIn(['Active', 'Disabled'])
  status?: 'Active' | 'Disabled';
}

export class PutPartnerTenantsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  tenantIds!: string[];
}

export class PartnerAssetItemDto {
  @IsString()
  tenantId!: string;

  @IsString()
  @MinLength(1)
  deviceId!: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;
}

export class PutPartnerAssetsDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => PartnerAssetItemDto)
  items!: PartnerAssetItemDto[];
}

export class LiveQueryDto {
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class VehicleLiveQueryDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;
}

export class HistoryQueryDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsDateString()
  startDateTime!: string;

  @IsDateString()
  endDateTime!: string;
}

export { APPLICATION_ID };
