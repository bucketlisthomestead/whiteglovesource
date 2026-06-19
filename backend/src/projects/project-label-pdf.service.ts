import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectLabelPdf } from '../entities/project-label-pdf.entity';
import { User } from '../entities/user.entity';
import { StorageService } from '../storage/storage.service';
import {
  DEFAULT_LABEL_TEMPLATE_ID,
  getLabelTemplate,
  LABEL_SHEET_TEMPLATES,
} from '../common/label-sizes';
import {
  formatLabelDate,
  labelPdfFilename,
  LabelPdfGenerator,
} from './label-pdf.generator';
import { ProjectsService } from './projects.service';

const LABEL_TEMPLATE_IDS = new Set(LABEL_SHEET_TEMPLATES.map((t) => t.id));

@Injectable()
export class ProjectLabelPdfService {
  constructor(
    @InjectRepository(ProjectLabelPdf)
    private readonly labelPdfRepo: Repository<ProjectLabelPdf>,
    private readonly projectsService: ProjectsService,
    private readonly generator: LabelPdfGenerator,
    private readonly storage: StorageService,
  ) {}

  async listVersions(projectId: string, user?: User) {
    await this.projectsService.assertProjectAccess(projectId, user);
    const rows = await this.labelPdfRepo.find({
      where: { projectId },
      order: { version: 'DESC' },
    });
    return rows.map((row) => this.serialize(row));
  }

  async generate(
    projectId: string,
    templateId: string | undefined,
    user?: User,
  ) {
    const resolvedTemplateId = templateId ?? DEFAULT_LABEL_TEMPLATE_ID;
    if (!LABEL_TEMPLATE_IDS.has(resolvedTemplateId)) {
      throw new BadRequestException('Invalid label template');
    }
    const template = getLabelTemplate(resolvedTemplateId);

    const labelData = await this.projectsService.getProjectLabels(
      projectId,
      user,
    );
    const items = labelData.labels
      .filter((l) => l.scanToken)
      .map((l) => ({
        scanToken: l.scanToken!,
        pieceName: l.pieceName,
        roomName: l.roomName,
      }));

    if (!items.length) {
      throw new BadRequestException(
        'No pieces with scan codes found for this project',
      );
    }

    const printedAt = formatLabelDate();
    const nextVersion = await this.nextVersionNumber(projectId);
    const filename = labelPdfFilename(
      labelData.projectName,
      resolvedTemplateId,
      nextVersion,
    );

    const buffer = await this.generator.generate(items, template, {
      jobNumber: labelData.jobNumber,
      printedAt,
      projectName: labelData.projectName,
    });

    const timestamp = Date.now();
    const storageKey = `projects/${projectId}/labels/v${nextVersion}-${timestamp}.pdf`;
    const stored = await this.storage.saveAtKey(
      buffer,
      storageKey,
      'application/pdf',
    );

    const saved = await this.labelPdfRepo.save(
      this.labelPdfRepo.create({
        projectId,
        version: nextVersion,
        storageKey: stored.storageKey,
        templateId: resolvedTemplateId,
        pieceCount: items.length,
        jobNumber: labelData.jobNumber,
        printedAt,
        filename,
        createdByUserId: user?.id ?? null,
        createdByName: user?.name ?? null,
      }),
    );

    return this.serialize(saved);
  }

  async getVersion(projectId: string, versionId: string, user?: User) {
    await this.projectsService.assertProjectAccess(projectId, user);
    const row = await this.labelPdfRepo.findOne({
      where: { id: versionId, projectId },
    });
    if (!row) throw new NotFoundException('Label PDF version not found');
    return row;
  }

  async readFile(row: ProjectLabelPdf): Promise<Buffer> {
    return this.storage.readFile(row.storageKey);
  }

  private async nextVersionNumber(projectId: string): Promise<number> {
    const latest = await this.labelPdfRepo.findOne({
      where: { projectId },
      order: { version: 'DESC' },
    });
    return (latest?.version ?? 0) + 1;
  }

  private serialize(row: ProjectLabelPdf) {
    return {
      id: row.id,
      projectId: row.projectId,
      version: row.version,
      templateId: row.templateId,
      templateName: getLabelTemplate(row.templateId).name,
      pieceCount: row.pieceCount,
      jobNumber: row.jobNumber,
      printedAt: row.printedAt,
      filename: row.filename,
      createdByName: row.createdByName,
      createdAt: row.createdAt,
      downloadUrl: `/api/projects/${row.projectId}/labels/pdf/${row.id}/download`,
    };
  }
}
