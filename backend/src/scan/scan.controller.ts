import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { CreatePieceEventDto } from '../common/dto';
import { Public } from '../common/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequireAnyPermissions } from '../common/permissions.decorator';
import { PERMISSIONS } from '../common/permissions';
import { User } from '../entities/user.entity';

@Controller('scan')
export class ScanController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Public()
  @Get(':token')
  findByToken(@Param('token') token: string) {
    return this.projectsService.findPieceByScanToken(token);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermissions(PERMISSIONS.FIELD_USE, PERMISSIONS.PROJECTS_MANAGE)
  @Post(':token/check-in')
  checkIn(
    @Param('token') token: string,
    @Body() dto: CreatePieceEventDto,
    @Req() req: { user: User },
  ) {
    return this.projectsService.addPieceEventByScanToken(token, dto, req.user);
  }
}
