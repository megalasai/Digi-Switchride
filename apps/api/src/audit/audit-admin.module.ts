import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from './audit.module';
import { AuditController } from './audit.controller';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [AuditController],
})
export class AuditAdminModule {}
