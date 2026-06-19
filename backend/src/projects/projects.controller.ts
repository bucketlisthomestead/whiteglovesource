import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProjectsService } from './projects.service';
import { ProjectAuditService } from './project-audit.service';
import { ProjectLabelPdfService } from './project-label-pdf.service';
import { CreatePieceEventDto } from '../common/dto';
import { CreateProjectMessageDto } from '../common/project-message.dto';
import { GenerateLabelPdfDto } from '../common/label-pdf.dto';
import { Public } from '../common/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../common/decorators';
import { RequireAnyPermissions } from '../common/permissions.decorator';
import { PERMISSIONS } from '../common/permissions';
import { UserRole } from '../common/roles';
import { User } from '../entities/user.entity';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly auditService: ProjectAuditService,
    private readonly labelPdfService: ProjectLabelPdfService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Req() req: { user: User }) {
    return this.projectsService.findAll(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  findMy(@Req() req: { user: User }) {
    return this.projectsService.findForUser(req.user);
  }

  @Public()
  @Get('demo')
  findDemo() {
    return this.projectsService.findDemo();
  }

  @Public()
  @Get('pieces/:pieceId')
  findPiece(@Param('pieceId') pieceId: string) {
    return this.projectsService.findPiece(pieceId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermissions(PERMISSIONS.PROJECTS_MANAGE, PERMISSIONS.FIELD_USE)
  @Get(':id/labels')
  getLabels(@Param('id') id: string, @Req() req: { user: User }) {
    return this.projectsService.getProjectLabels(id, req.user);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermissions(PERMISSIONS.PROJECTS_MANAGE, PERMISSIONS.FIELD_USE)
  @Get(':id/labels/pdf')
  listLabelPdfs(@Param('id') id: string, @Req() req: { user: User }) {
    return this.labelPdfService.listVersions(id, req.user);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermissions(PERMISSIONS.PROJECTS_MANAGE, PERMISSIONS.FIELD_USE)
  @Post(':id/labels/pdf')
  generateLabelPdf(
    @Param('id') id: string,
    @Body() dto: GenerateLabelPdfDto,
    @Req() req: { user: User },
  ) {
    return this.labelPdfService.generate(id, dto.templateId, req.user);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermissions(PERMISSIONS.PROJECTS_MANAGE, PERMISSIONS.FIELD_USE)
  @Post(':id/labels/pdf/regenerate')
  regenerateLabelPdf(
    @Param('id') id: string,
    @Body() dto: GenerateLabelPdfDto,
    @Req() req: { user: User },
  ) {
    return this.labelPdfService.generate(id, dto.templateId, req.user);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermissions(PERMISSIONS.PROJECTS_MANAGE, PERMISSIONS.FIELD_USE)
  @Get(':id/labels/pdf/:versionId/download')
  async downloadLabelPdf(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Req() req: { user: User },
    @Res({ passthrough: true }) res: Response,
  ) {
    const version = await this.labelPdfService.getVersion(
      id,
      versionId,
      req.user,
    );
    const buffer = await this.labelPdfService.readFile(version);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${version.filename}"`,
    });
    return new StreamableFile(buffer);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DESIGNER)
  @Post('pieces/:pieceId/events')
  addPieceEvent(
    @Param('pieceId') pieceId: string,
    @Body() dto: CreatePieceEventDto,
    @Req() req: { user: User },
  ) {
    return this.projectsService.addPieceEvent(pieceId, dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/activity')
  getActivity(@Param('id') id: string, @Req() req: { user: User }) {
    return this.auditService.getActivity(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/quote')
  getQuote(@Param('id') id: string, @Req() req: { user: User }) {
    return this.auditService.getLinkedQuote(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/messages')
  getMessages(@Param('id') id: string, @Req() req: { user: User }) {
    return this.auditService.getMessages(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/messages')
  postMessage(
    @Param('id') id: string,
    @Body() dto: CreateProjectMessageDto,
    @Req() req: { user: User },
  ) {
    return this.auditService.createMessage(id, req.user, dto);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: { user?: User }) {
    return this.projectsService.findOne(id, req.user);
  }
}
