import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PdfService } from './pdf.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators';
import { UserRole } from '../common/roles';
import { ProjectsService } from '../projects/projects.service';
import { PHASE_ORDER, ProjectPhase } from '../common/enums';
import { User } from '../entities/user.entity';
import { SaveProjectPdfDto } from '../common/pdf.dto';

@Controller('pdf')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.CLIENT)
  @Get('project/:id/inventory')
  async exportInventory(
    @Param('id') id: string,
    @Query('note') note: string | undefined,
    @Req() req: { user: User },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.projectsService.assertProjectAccess(id, req.user);
    const buffer = await this.pdfService.generateInventoryPdf(id, { note });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="inventory-${id.slice(0, 8)}.pdf"`,
    });
    return new StreamableFile(buffer);
  }

  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.CLIENT)
  @Get('project/:id/status-report')
  async exportStatusReport(
    @Param('id') id: string,
    @Query('phase') phase: string | undefined,
    @Query('note') note: string | undefined,
    @Req() req: { user: User },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.projectsService.assertProjectAccess(id, req.user);
    let parsedPhase: ProjectPhase | undefined;
    if (phase) {
      if (!PHASE_ORDER.includes(phase as ProjectPhase)) {
        throw new BadRequestException(
          'Invalid phase. Use planning, pickup_storage, or installation.',
        );
      }
      parsedPhase = phase as ProjectPhase;
    }

    const buffer = await this.pdfService.generateStatusReportPdf(
      id,
      parsedPhase,
      { note },
    );
    const suffix = parsedPhase ? `-${parsedPhase}` : '-full';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="status-report-${id.slice(0, 8)}${suffix}.pdf"`,
    });
    return new StreamableFile(buffer);
  }

  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.CLIENT)
  @Get('project/:id/documents')
  async listDocuments(@Param('id') id: string, @Req() req: { user: User }) {
    await this.projectsService.assertProjectAccess(id, req.user);
    return this.pdfService.listProjectDocuments(id);
  }

  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.CLIENT)
  @Post('project/:id/documents')
  async saveDocument(
    @Param('id') id: string,
    @Body() dto: SaveProjectPdfDto,
    @Req() req: { user: User },
  ) {
    await this.projectsService.assertProjectAccess(id, req.user);
    if (dto.documentType === 'status_phase' && !dto.phase) {
      throw new BadRequestException(
        'Phase is required for status_phase documents.',
      );
    }
    return this.pdfService.saveProjectDocument(
      id,
      dto.documentType,
      req.user,
      dto.phase,
      dto.note,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.CLIENT)
  @Get('documents/:documentId')
  async downloadDocument(
    @Param('documentId') documentId: string,
    @Req() req: { user: User },
    @Res({ passthrough: true }) res: Response,
  ) {
    const document = await this.pdfService.getProjectDocument(documentId);
    await this.projectsService.assertProjectAccess(
      document.projectId,
      req.user,
    );
    const buffer = await this.pdfService.readDocumentFile(document);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${document.filename}"`,
    });
    return new StreamableFile(buffer);
  }
}
