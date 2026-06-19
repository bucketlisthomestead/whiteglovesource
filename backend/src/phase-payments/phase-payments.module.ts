import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectPhasePayment } from '../entities/project-phase-payment.entity';
import { ProjectsModule } from '../projects/projects.module';
import { AuditModule } from '../audit/audit.module';
import { RolesModule } from '../roles/roles.module';
import { PhasePaymentsService } from './phase-payments.service';
import { PhasePaymentsController } from './phase-payments.controller';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectPhasePayment]),
    ProjectsModule,
    AuditModule,
    RolesModule,
  ],
  controllers: [PhasePaymentsController],
  providers: [PhasePaymentsService, PermissionsGuard],
  exports: [PhasePaymentsService],
})
export class PhasePaymentsModule {}
