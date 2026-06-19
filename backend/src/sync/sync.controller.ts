import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators';
import { UserRole } from '../common/roles';
import { SyncBatchDto } from '../common/auth.dto';
import { User } from '../entities/user.entity';

@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.DESIGNER)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  sync(@Req() req: { user: User }, @Body() dto: SyncBatchDto) {
    return this.syncService.processBatch(req.user, dto.mutations || []);
  }
}
