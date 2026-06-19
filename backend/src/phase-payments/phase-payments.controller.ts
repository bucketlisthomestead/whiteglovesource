import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermissions } from '../common/permissions.decorator';
import { PERMISSIONS } from '../common/permissions';
import { Roles } from '../common/decorators';
import { UserRole } from '../common/roles';
import { ProjectPhase } from '../common/enums';
import { UpdatePhasePaymentDto } from '../common/phase-payment.dto';
import { User } from '../entities/user.entity';
import { PhasePaymentsService } from './phase-payments.service';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PhasePaymentsController {
  constructor(private readonly phasePaymentsService: PhasePaymentsService) {}

  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.CLIENT)
  @Get(':id/phase-payments')
  list(@Param('id') id: string, @Req() req: { user: User }) {
    return this.phasePaymentsService.listForProject(id, req.user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.CLIENT)
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.PROJECTS_MANAGE)
  @Patch(':id/phase-payments/:phase')
  update(
    @Param('id') id: string,
    @Param('phase') phase: ProjectPhase,
    @Body() dto: UpdatePhasePaymentDto,
    @Req() req: { user: User },
  ) {
    return this.phasePaymentsService.updatePhase(id, phase, dto, req.user);
  }
}
