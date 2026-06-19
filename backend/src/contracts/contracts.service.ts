import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import {
  ContractProposal,
  ContractProposalStatus,
  ContractSignatureMetadata,
} from '../entities/contract-proposal.entity';
import { Project } from '../entities/project.entity';
import { Piece } from '../entities/piece.entity';
import { StorageService } from '../storage/storage.service';
import { SettingsService } from '../settings/settings.service';
import { ProjectsService } from '../projects/projects.service';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/roles';
import { CaptureContractSignatureDto } from '../common/contract.dto';
import { INSTALL_DEST_LABELS, PROJECT_STATUS_LABELS } from '../common/enums';

const SIGNED_UPLOAD_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export interface ContractProposalDto {
  id: string;
  projectId: string;
  status: ContractProposalStatus;
  proposalFilename: string | null;
  signedUploadFilename: string | null;
  signedUploadMimeType: string | null;
  signatureMetadata: ContractSignatureMetadata | null;
  generatedByName: string | null;
  allowDigitalSignatures: boolean;
  createdAt: string;
  updatedAt: string;
  hasProposal: boolean;
  hasSignedUpload: boolean;
  isFullySigned: boolean;
  proposalDownloadUrl: string | null;
  signedDownloadUrl: string | null;
}

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(ContractProposal)
    private readonly contractRepo: Repository<ContractProposal>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Piece)
    private readonly pieceRepo: Repository<Piece>,
    private readonly storage: StorageService,
    private readonly settingsService: SettingsService,
    private readonly projectsService: ProjectsService,
  ) {}

  async getForProject(
    projectId: string,
    user: User,
  ): Promise<ContractProposalDto | null> {
    await this.projectsService.assertProjectAccess(projectId, user);
    const settings = await this.settingsService.getSettings();
    const contract = await this.contractRepo.findOne({ where: { projectId } });
    if (!contract) {
      return null;
    }
    return this.serialize(contract, settings.allowDigitalSignatures);
  }

  async generateProposal(
    projectId: string,
    user: User,
  ): Promise<ContractProposalDto> {
    await this.projectsService.assertProjectAccess(projectId, user);
    this.assertCanManage(user);

    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: { designer: true, client: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    let contract = await this.contractRepo.findOne({ where: { projectId } });
    if (contract?.status === ContractProposalStatus.SIGNED) {
      throw new BadRequestException(
        'Contract is already signed. Cannot regenerate.',
      );
    }

    const settings = await this.settingsService.getSettings();
    const pieceCount = await this.pieceRepo.count({ where: { projectId } });
    const buffer = await this.renderProposalPdf(project, settings, pieceCount);

    const safeName =
      project.name
        .slice(0, 24)
        .replace(/[^\w\s-]/g, '')
        .trim() || 'project';
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `contract-proposal-${safeName}-${dateStamp}.pdf`;
    const stored = await this.storage.savePdf(projectId, buffer, filename);

    if (!contract) {
      contract = this.contractRepo.create({ projectId });
    }

    contract.proposalStorageKey = stored.storageKey;
    contract.proposalFilename = filename;
    contract.status = ContractProposalStatus.SENT;
    contract.generatedByUserId = user.id;
    contract.generatedByName = user.name;
    contract.signedUploadStorageKey = null;
    contract.signedUploadFilename = null;
    contract.signedUploadMimeType = null;
    contract.signatureMetadata = null;

    const saved = await this.contractRepo.save(contract);
    return this.serialize(saved, settings.allowDigitalSignatures);
  }

  async uploadSignedAgreement(
    projectId: string,
    file: Express.Multer.File,
    user: User,
  ): Promise<ContractProposalDto> {
    await this.projectsService.assertProjectAccess(projectId, user);
    const contract = await this.requireContract(projectId);
    this.assertEditable(contract);

    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File exceeds 15 MB limit');
    }
    if (!SIGNED_UPLOAD_MIMES.has(file.mimetype)) {
      throw new BadRequestException('Allowed types: PDF, JPEG, PNG, WebP');
    }

    const stored = await this.storage.saveFile(
      projectId,
      file.buffer,
      file.originalname,
      file.mimetype,
      'contract-signed',
    );

    contract.signedUploadStorageKey = stored.storageKey;
    contract.signedUploadFilename = file.originalname;
    contract.signedUploadMimeType = file.mimetype;
    contract.status = ContractProposalStatus.SIGNED;

    const saved = await this.contractRepo.save(contract);
    const settings = await this.settingsService.getSettings();
    return this.serialize(saved, settings.allowDigitalSignatures);
  }

  async captureSignature(
    projectId: string,
    dto: CaptureContractSignatureDto,
    user: User,
  ): Promise<ContractProposalDto> {
    await this.projectsService.assertProjectAccess(projectId, user);
    const settings = await this.settingsService.getSettings();
    if (!settings.allowDigitalSignatures) {
      throw new BadRequestException('Digital signatures are not enabled');
    }

    const contract = await this.requireContract(projectId);
    this.assertEditable(contract);
    this.assertSignatureRole(dto.role, user);

    if (!contract.proposalStorageKey) {
      throw new BadRequestException(
        'Generate a proposal document before signing',
      );
    }

    const buffer = this.decodeSignatureDataUrl(dto.signatureDataUrl);
    const sigFilename = `signature-${dto.role}-${Date.now()}.png`;
    const stored = await this.storage.saveFile(
      projectId,
      buffer,
      sigFilename,
      'image/png',
      'contract-signatures',
    );

    const metadata: ContractSignatureMetadata = {
      ...(contract.signatureMetadata || {}),
      [dto.role]: {
        name: dto.signerName.trim(),
        signedAt: new Date().toISOString(),
        userId: user.id,
        signatureStorageKey: stored.storageKey,
      },
    };

    contract.signatureMetadata = metadata;
    if (metadata.admin && metadata.client) {
      contract.status = ContractProposalStatus.SIGNED;
    }

    const saved = await this.contractRepo.save(contract);
    return this.serialize(saved, settings.allowDigitalSignatures);
  }

  async readProposalFile(
    projectId: string,
    user: User,
  ): Promise<{ buffer: Buffer; filename: string }> {
    await this.projectsService.assertProjectAccess(projectId, user);
    const contract = await this.requireContract(projectId);
    if (!contract.proposalStorageKey) {
      throw new NotFoundException('Proposal document not found');
    }
    const buffer = await this.storage.readFile(contract.proposalStorageKey);
    return {
      buffer,
      filename: contract.proposalFilename || 'contract-proposal.pdf',
    };
  }

  async readSignedFile(
    projectId: string,
    user: User,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    await this.projectsService.assertProjectAccess(projectId, user);
    const contract = await this.requireContract(projectId);
    if (!contract.signedUploadStorageKey) {
      throw new NotFoundException('Signed agreement not found');
    }
    const buffer = await this.storage.readFile(contract.signedUploadStorageKey);
    return {
      buffer,
      filename: contract.signedUploadFilename || 'signed-agreement',
      mimeType: contract.signedUploadMimeType || 'application/octet-stream',
    };
  }

  private async requireContract(projectId: string): Promise<ContractProposal> {
    const contract = await this.contractRepo.findOne({ where: { projectId } });
    if (!contract) {
      throw new NotFoundException(
        'Contract proposal not found. Generate one first.',
      );
    }
    return contract;
  }

  private assertEditable(contract: ContractProposal) {
    if (contract.status === ContractProposalStatus.SIGNED) {
      throw new BadRequestException(
        'Contract is fully signed and cannot be modified',
      );
    }
  }

  private assertCanManage(user: User) {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.DESIGNER) return;
    throw new ForbiddenException(
      'Only admin or designer can perform this action',
    );
  }

  private assertSignatureRole(role: 'admin' | 'client', user: User) {
    if (
      role === 'admin' &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.DESIGNER
    ) {
      throw new ForbiddenException(
        'Only admin or designer can sign as business representative',
      );
    }
    if (
      role === 'client' &&
      user.role !== UserRole.CLIENT &&
      user.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Only the client can sign as client');
    }
  }

  private decodeSignatureDataUrl(dataUrl: string): Buffer {
    const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl.trim());
    if (!match) {
      throw new BadRequestException('Signature must be a PNG data URL');
    }
    const buffer = Buffer.from(match[1], 'base64');
    if (buffer.length > 2 * 1024 * 1024) {
      throw new BadRequestException('Signature image too large');
    }
    return buffer;
  }

  private serialize(
    contract: ContractProposal,
    allowDigitalSignatures: boolean,
  ): ContractProposalDto {
    const metadata = contract.signatureMetadata;
    const hasSignedUpload = !!contract.signedUploadStorageKey;
    const isFullySigned = contract.status === ContractProposalStatus.SIGNED;

    return {
      id: contract.id,
      projectId: contract.projectId,
      status: contract.status,
      proposalFilename: contract.proposalFilename,
      signedUploadFilename: contract.signedUploadFilename,
      signedUploadMimeType: contract.signedUploadMimeType,
      signatureMetadata: metadata,
      generatedByName: contract.generatedByName,
      allowDigitalSignatures,
      createdAt: contract.createdAt.toISOString(),
      updatedAt: contract.updatedAt.toISOString(),
      hasProposal: !!contract.proposalStorageKey,
      hasSignedUpload,
      isFullySigned,
      proposalDownloadUrl: contract.proposalStorageKey
        ? `/api/projects/${contract.projectId}/contract/proposal`
        : null,
      signedDownloadUrl: hasSignedUpload
        ? `/api/projects/${contract.projectId}/contract/signed`
        : null,
    };
  }

  private async renderProposalPdf(
    project: Project,
    settings: Awaited<ReturnType<SettingsService['getSettings']>>,
    pieceCount: number,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 50,
        size: 'LETTER',
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const generated = new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      doc
        .fontSize(20)
        .fillColor('#1a1a1a')
        .text(settings.businessName, { align: 'center' });
      doc
        .fontSize(12)
        .fillColor('#555')
        .text('Service Agreement & Proposal', { align: 'center' });
      doc
        .fontSize(9)
        .text(
          [
            settings.businessAddress,
            settings.businessCity,
            settings.businessState,
            settings.businessZip,
          ]
            .filter(Boolean)
            .join(', '),
          { align: 'center' },
        );
      doc.text(`${settings.businessPhone} · ${settings.businessEmail}`, {
        align: 'center',
      });
      doc.moveDown(1.2);
      doc.fillColor('#000');

      doc.fontSize(11).text(`Project: ${project.name}`);
      doc.text(`Prepared: ${generated}`);
      doc.text(`Status: ${PROJECT_STATUS_LABELS[project.status]}`);
      doc.text(
        `Property: ${project.propertyAddress}${project.propertyCity ? `, ${project.propertyCity}` : ''}`,
      );
      doc.text(
        `Designer: ${project.designer.name}${project.designer.firm ? ` — ${project.designer.firm}` : ''}`,
      );
      doc.text(`Client: ${project.client.name}`);
      if (project.client.email)
        doc.text(`Client Email: ${project.client.email}`);
      if (project.targetInstallDate)
        doc.text(`Target Install Date: ${project.targetInstallDate}`);
      if (project.primaryInstallDestination) {
        doc.text(
          `Install Destination: ${INSTALL_DEST_LABELS[project.primaryInstallDestination]}`,
        );
      }
      doc.text(`Inventory Pieces: ${pieceCount}`);
      doc.moveDown(0.8);

      doc
        .fontSize(12)
        .fillColor('#1a1a1a')
        .text('Pricing Terms', { underline: true });
      doc.fontSize(10).fillColor('#000').moveDown(0.3);
      doc.text(`Mileage rate: $${Number(project.mileRate).toFixed(2)}/mile`);
      doc.text(
        `Project coordination fee: $${Number(project.projectBaseFee).toFixed(2)}`,
      );
      doc.text(
        `Additional pickup surcharge: $${Number(project.additionalPickupSurcharge).toFixed(2)}`,
      );
      doc.text(`Minimum quote: $${Number(project.minimumQuote).toFixed(2)}`);
      doc.moveDown(0.8);

      doc
        .fontSize(12)
        .fillColor('#1a1a1a')
        .text('Scope of Services', { underline: true });
      doc.fontSize(9).fillColor('#333').moveDown(0.3);
      doc.text(
        'White Glove Source provides professional pickup, climate-controlled storage, and white-glove delivery and installation of furnishings for interior design projects. Services include careful handling, photo documentation at key milestones, and chain-of-custody tracking throughout the project lifecycle.',
        { align: 'justify' },
      );
      doc.moveDown(0.5);
      if (project.description?.trim()) {
        doc
          .fontSize(10)
          .fillColor('#1a1a1a')
          .text('Project Description', { underline: true });
        doc
          .fontSize(9)
          .fillColor('#333')
          .text(project.description.trim(), { align: 'justify' });
        doc.moveDown(0.5);
      }

      doc
        .fontSize(12)
        .fillColor('#1a1a1a')
        .text('Agreement Terms', { underline: true });
      doc.fontSize(9).fillColor('#333').moveDown(0.3);
      const terms = [
        'Client agrees to provide accurate inventory and access information for all pickup and delivery locations.',
        'Pricing is based on the rates listed above and final mileage/storage calculations at project completion.',
        'Payment terms as agreed between parties. Work may be scheduled upon signed agreement.',
        'Both parties acknowledge review of inventory manifest and project portal documentation.',
      ];
      terms.forEach((t, i) => doc.text(`${i + 1}. ${t}`, { align: 'justify' }));
      doc.moveDown(1);

      doc
        .fontSize(10)
        .fillColor('#1a1a1a')
        .text('Signatures', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#666');
      doc.text(
        'Business Representative: _________________________________  Date: __________',
      );
      doc.moveDown(0.8);
      doc.text('Client: _________________________________  Date: __________');
      doc.moveDown(1);

      doc
        .fontSize(8)
        .fillColor('#999')
        .text(
          `Document generated electronically by ${settings.businessName}. Sign physically or via the project portal when digital signatures are enabled.`,
          { align: 'center' },
        );

      doc.end();
    });
  }
}
