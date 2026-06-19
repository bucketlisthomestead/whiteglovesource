import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { Project } from '../entities/project.entity';
import { Room } from '../entities/room.entity';
import { Piece } from '../entities/piece.entity';
import { Signoff } from '../entities/signoff.entity';
import { PieceStagePhoto } from '../entities/piece-stage-photo.entity';
import {
  ProjectDocument,
  ProjectDocumentType,
} from '../entities/project-document.entity';
import { StorageService } from '../storage/storage.service';
import { User } from '../entities/user.entity';
import {
  CONDITION_LABELS,
  INSTALL_DEST_LABELS,
  PHASE_DESCRIPTIONS,
  PHASE_LABELS,
  PHASE_ORDER,
  PROJECT_STATUS_LABELS,
  ProjectPhase,
  STAGE_LABELS,
  STAGE_PHASE,
} from '../common/enums';
import {
  INVENTORY_SIGNOFF_REQUIREMENTS,
  MILESTONE_SIGNOFF_REQUIREMENTS,
  PHOTO_MILESTONE_LABELS,
  PhotoMilestone,
  SIGNER_ROLE_LABELS,
  SignerRole,
  SignoffType,
} from '../common/signoff';
import { loadPhotoBuffers } from './pdf-image.loader';

const MILESTONE_PHASE: Record<PhotoMilestone, ProjectPhase> = {
  [PhotoMilestone.PICKUP]: ProjectPhase.PICKUP_STORAGE,
  [PhotoMilestone.DELIVERY]: ProjectPhase.INSTALLATION,
  [PhotoMilestone.INSTALL]: ProjectPhase.INSTALLATION,
};

interface ReportData {
  project: Project;
  rooms: Room[];
  pieces: Piece[];
  signoffs: Signoff[];
  stagePhotos: PieceStagePhoto[];
}

interface ReportOptions {
  note?: string;
}

interface PhotoEntry {
  url: string;
  pieceName: string;
  label: string;
  phase: ProjectPhase;
  capturedAt?: Date;
  notes?: string;
  capturedBy?: string;
}

const PHOTO_COL_WIDTH = 235;
const PHOTO_IMG_HEIGHT = 160;
const PHOTO_COL_GAP = 12;

@Injectable()
export class PdfService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(Piece)
    private readonly pieceRepo: Repository<Piece>,
    @InjectRepository(Signoff)
    private readonly signoffRepo: Repository<Signoff>,
    @InjectRepository(PieceStagePhoto)
    private readonly stagePhotoRepo: Repository<PieceStagePhoto>,
    @InjectRepository(ProjectDocument)
    private readonly documentRepo: Repository<ProjectDocument>,
    private readonly storage: StorageService,
  ) {}

  async generateInventoryPdf(
    projectId: string,
    options: ReportOptions = {},
  ): Promise<Buffer> {
    const data = await this.loadReportData(projectId);
    const photoEntries = this.buildPhotoEntries(data);
    const imageCache = await this.loadImageCache(
      photoEntries.map((p) => p.url),
    );

    return this.renderPdf((doc) => {
      this.renderBrandHeader(doc, 'Project Inventory Manifest');
      this.renderProjectSummary(doc, data);
      this.renderCoverNote(doc, options.note);
      doc.moveDown();
      this.renderInventoryTable(doc, data, data.pieces);
      this.renderPhotoDocumentation(doc, photoEntries, imageCache);
      this.renderFooter(doc);
    });
  }

  async generateStatusReportPdf(
    projectId: string,
    phase?: ProjectPhase,
    options: ReportOptions = {},
  ): Promise<Buffer> {
    const data = await this.loadReportData(projectId);
    const phases = phase ? [phase] : [...PHASE_ORDER];
    const allEntries = this.buildPhotoEntries(data);
    const imageCache = await this.loadImageCache(allEntries.map((p) => p.url));

    return this.renderPdf((doc) => {
      const title = phase
        ? `${PHASE_LABELS[phase]} — Signoff & Status Report`
        : 'Project Status & Signoff Report';
      this.renderBrandHeader(doc, title);
      this.renderProjectSummary(doc, data);
      this.renderCoverNote(doc, options.note);
      this.renderDisclaimer(doc);

      for (const reportPhase of phases) {
        if (!phase) doc.addPage();
        this.renderPhaseSection(doc, data, reportPhase);
        const phasePhotos = allEntries.filter((e) => e.phase === reportPhase);
        this.renderPhotoDocumentation(
          doc,
          phasePhotos,
          imageCache,
          `${PHASE_LABELS[reportPhase]} — Photo Documentation`,
        );
      }

      if (!phase) {
        this.renderChainOfCustodySummary(doc, data);
      }

      this.renderFooter(doc);
    });
  }

  async listProjectDocuments(projectId: string) {
    const docs = await this.documentRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
    return docs.map((doc) => this.serializeDocument(doc));
  }

  async saveProjectDocument(
    projectId: string,
    documentType: 'inventory' | 'status_full' | 'status_phase',
    user: User,
    phase?: ProjectPhase,
    note?: string,
  ) {
    const trimmedNote = note?.trim() || null;
    let buffer: Buffer;
    let title: string;
    let filename: string;
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    const safeName =
      project.name
        .slice(0, 24)
        .replace(/[^\w\s-]/g, '')
        .trim() || 'project';
    const dateStamp = new Date().toISOString().slice(0, 10);

    if (documentType === 'inventory') {
      buffer = await this.generateInventoryPdf(projectId, {
        note: trimmedNote || undefined,
      });
      title = 'Inventory Manifest';
      filename = `inventory-${safeName}-${dateStamp}.pdf`;
    } else if (documentType === 'status_full') {
      buffer = await this.generateStatusReportPdf(projectId, undefined, {
        note: trimmedNote || undefined,
      });
      title = 'Full Status Report';
      filename = `status-report-${safeName}-${dateStamp}.pdf`;
    } else {
      if (!phase)
        throw new NotFoundException('Phase is required for phase signoff PDFs');
      buffer = await this.generateStatusReportPdf(projectId, phase, {
        note: trimmedNote || undefined,
      });
      title = `${PHASE_LABELS[phase]} Signoff`;
      filename = `signoff-${phase}-${safeName}-${dateStamp}.pdf`;
    }

    const stored = await this.storage.savePdf(projectId, buffer, filename);
    const entityType =
      documentType === 'inventory'
        ? ProjectDocumentType.INVENTORY
        : documentType === 'status_full'
          ? ProjectDocumentType.STATUS_FULL
          : ProjectDocumentType.STATUS_PHASE;

    const saved = await this.documentRepo.save(
      this.documentRepo.create({
        projectId,
        documentType: entityType,
        phase: phase ?? null,
        title,
        filename,
        storageKey: stored.storageKey,
        note: trimmedNote,
        generatedByUserId: user.id,
        generatedByName: user.name,
      }),
    );

    return this.serializeDocument(saved);
  }

  async getProjectDocument(documentId: string) {
    const doc = await this.documentRepo.findOne({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async readDocumentFile(document: ProjectDocument): Promise<Buffer> {
    return this.storage.readFile(document.storageKey);
  }

  private serializeDocument(doc: ProjectDocument) {
    return {
      id: doc.id,
      projectId: doc.projectId,
      documentType: doc.documentType,
      phase: doc.phase,
      title: doc.title,
      filename: doc.filename,
      note: doc.note,
      generatedByName: doc.generatedByName,
      createdAt: doc.createdAt,
      downloadUrl: `/api/pdf/documents/${doc.id}`,
    };
  }

  private async loadReportData(projectId: string): Promise<ReportData> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: { designer: true, client: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const [rooms, pieces, signoffs, stagePhotos] = await Promise.all([
      this.roomRepo.find({ where: { projectId }, order: { sortOrder: 'ASC' } }),
      this.pieceRepo.find({
        where: { projectId },
        relations: { room: true },
        order: { name: 'ASC' },
      }),
      this.signoffRepo.find({
        where: { projectId },
        relations: { piece: true },
        order: { signedAt: 'ASC' },
      }),
      this.stagePhotoRepo
        .createQueryBuilder('photo')
        .innerJoin('photo.piece', 'piece')
        .where('piece.projectId = :projectId', { projectId })
        .orderBy('photo.capturedAt', 'ASC')
        .getMany(),
    ]);

    return { project, rooms, pieces, signoffs, stagePhotos };
  }

  private renderPdf(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
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

      build(doc);
      doc.end();
    });
  }

  private renderBrandHeader(doc: PDFKit.PDFDocument, subtitle: string) {
    doc
      .fontSize(20)
      .fillColor('#1a1a1a')
      .text('White Glove Source', { align: 'center' });
    doc.fontSize(12).fillColor('#555').text(subtitle, { align: 'center' });
    doc.fontSize(9).text('High Point, North Carolina', { align: 'center' });
    doc.moveDown(1.2);
    doc.fillColor('#000');
  }

  private renderProjectSummary(doc: PDFKit.PDFDocument, data: ReportData) {
    const { project, pieces } = data;
    const generated = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    doc.fontSize(11).fillColor('#000');
    doc.text(`Project: ${project.name}`, { continued: false });
    doc.text(`Report Generated: ${generated}`);
    doc.text(`Project Status: ${PROJECT_STATUS_LABELS[project.status]}`);
    doc.text(
      `Property: ${project.propertyAddress}${project.propertyCity ? `, ${project.propertyCity}` : ''}`,
    );
    doc.text(`Designer: ${project.designer.name} — ${project.designer.firm}`);
    doc.text(`Client: ${project.client.name}`);
    if (project.client.email)
      doc.text(`Client Contact: ${project.client.email}`);
    if (project.targetInstallDate)
      doc.text(`Target Install Date: ${project.targetInstallDate}`);
    if (project.primaryInstallDestination) {
      doc.text(
        `Install Destination: ${INSTALL_DEST_LABELS[project.primaryInstallDestination]}`,
      );
    }
    doc.text(`Total Inventory Pieces: ${pieces.length}`);
    doc.moveDown(0.5);
  }

  private renderCoverNote(doc: PDFKit.PDFDocument, note?: string) {
    if (!note?.trim()) return;
    this.ensureSpace(doc, 60);
    doc
      .fontSize(10)
      .fillColor('#1a1a1a')
      .text('Report Note', { underline: true });
    doc.fontSize(9).fillColor('#333').text(note.trim(), { align: 'justify' });
    doc.fillColor('#000');
    doc.moveDown(0.5);
  }

  private renderDisclaimer(doc: PDFKit.PDFDocument) {
    this.ensureSpace(doc, 70);
    doc.fontSize(8).fillColor('#666');
    doc.text(
      'This report documents inventory acknowledgments, condition tracking, project phase signoffs, ' +
        'and embedded field photos recorded in the White Glove Source system. It is suitable for client records, ' +
        'insurance adjusters, email status updates, and chain-of-custody verification. Signatures below reflect electronic ' +
        'acknowledgments captured at the time indicated.',
      { align: 'justify' },
    );
    doc.fillColor('#000');
    doc.moveDown();
  }

  private renderPhaseSection(
    doc: PDFKit.PDFDocument,
    data: ReportData,
    phase: ProjectPhase,
  ) {
    this.ensureSpace(doc, 120);
    doc
      .fontSize(15)
      .fillColor('#1a1a1a')
      .text(PHASE_LABELS[phase], { underline: true });
    doc.fontSize(9).fillColor('#666').text(PHASE_DESCRIPTIONS[phase]);
    doc.fillColor('#000').moveDown(0.8);

    this.renderPhaseStatus(doc, data, phase);
    doc.moveDown(0.6);
    this.renderInventorySignoffs(doc, data, phase);
    doc.moveDown(0.6);
    this.renderMilestoneSignoffs(doc, data, phase);
    doc.moveDown(0.6);
    this.renderPhaseInventory(doc, data, phase);
  }

  private renderPhaseStatus(
    doc: PDFKit.PDFDocument,
    data: ReportData,
    phase: ProjectPhase,
  ) {
    const phasePieces = data.pieces.filter(
      (p) => STAGE_PHASE[p.currentStage] === phase,
    );
    const inventorySignoffs = data.signoffs.filter(
      (s) => s.signoffType === SignoffType.INVENTORY && s.phase === phase,
    );
    const requirement = INVENTORY_SIGNOFF_REQUIREMENTS.find(
      (r) => r.phase === phase,
    );
    const complete =
      requirement?.roles.every((role) =>
        inventorySignoffs.some((s) => s.signerRole === role),
      ) ?? false;

    doc.fontSize(11).text('Phase Status Summary', { underline: true });
    doc.fontSize(10);
    doc.text(`Pieces currently in this phase: ${phasePieces.length}`);
    doc.text(`Inventory signoffs recorded: ${inventorySignoffs.length}`);
    doc.text(
      `Phase acknowledgment: ${complete ? 'Complete' : 'Incomplete — pending signatures'}`,
    );
  }

  private renderInventorySignoffs(
    doc: PDFKit.PDFDocument,
    data: ReportData,
    phase: ProjectPhase,
  ) {
    const requirement = INVENTORY_SIGNOFF_REQUIREMENTS.find(
      (r) => r.phase === phase,
    );
    if (!requirement) return;

    this.ensureSpace(doc, 80);
    doc.fontSize(11).text('Inventory Signoffs', { underline: true });
    doc.moveDown(0.4);

    for (const role of requirement.roles) {
      const signoff = data.signoffs.find(
        (s) =>
          s.signoffType === SignoffType.INVENTORY &&
          s.phase === phase &&
          s.signerRole === role,
      );
      doc.fontSize(10);
      if (signoff) {
        const signedAt = new Date(signoff.signedAt).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        doc
          .fillColor('#0f5132')
          .text(
            `✓ ${SIGNER_ROLE_LABELS[role]}: ${signoff.signerName} — signed ${signedAt}`,
          );
        if (signoff.notes) {
          doc.fontSize(9).fillColor('#444').text(`  Notes: ${signoff.notes}`);
        }
      } else {
        doc
          .fillColor('#92400e')
          .text(`○ ${SIGNER_ROLE_LABELS[role]}: Pending acknowledgment`);
      }
      doc.fillColor('#000');
      doc.moveDown(0.3);
    }
  }

  private renderMilestoneSignoffs(
    doc: PDFKit.PDFDocument,
    data: ReportData,
    phase: ProjectPhase,
  ) {
    const milestones = MILESTONE_SIGNOFF_REQUIREMENTS.filter(
      (m) => MILESTONE_PHASE[m.milestone] === phase,
    );
    if (!milestones.length) return;

    this.ensureSpace(doc, 60);
    doc.fontSize(11).text('Piece Milestone Signoffs', { underline: true });
    doc
      .fontSize(9)
      .fillColor('#666')
      .text('Per-piece photo milestone acknowledgments for this phase.');
    doc.fillColor('#000').moveDown(0.4);

    for (const { milestone, roles } of milestones) {
      const milestoneSignoffs = data.signoffs.filter(
        (s) =>
          s.signoffType === SignoffType.MILESTONE && s.milestone === milestone,
      );
      const piecesWithPhotos = data.pieces.filter((p) =>
        data.stagePhotos.some(
          (photo) => photo.pieceId === p.id && photo.milestone === milestone,
        ),
      );

      doc
        .fontSize(10)
        .text(`${PHOTO_MILESTONE_LABELS[milestone]}`, { underline: true });
      doc.fontSize(9);
      doc.text(
        `Pieces with photos: ${piecesWithPhotos.length} · Signoffs recorded: ${milestoneSignoffs.length}`,
      );

      for (const role of roles) {
        const count = milestoneSignoffs.filter(
          (s) => s.signerRole === role,
        ).length;
        doc.text(`  ${SIGNER_ROLE_LABELS[role]}: ${count} signoff(s)`);
      }
      doc.moveDown(0.4);
    }
  }

  private renderPhaseInventory(
    doc: PDFKit.PDFDocument,
    data: ReportData,
    phase: ProjectPhase,
  ) {
    const phasePieces = data.pieces.filter(
      (p) => STAGE_PHASE[p.currentStage] === phase,
    );
    const relevantPieces = phasePieces.length ? phasePieces : data.pieces;

    this.ensureSpace(doc, 60);
    doc
      .fontSize(11)
      .text(
        phasePieces.length
          ? `Inventory in ${PHASE_LABELS[phase]}`
          : `Full Project Inventory (reference for ${PHASE_LABELS[phase]})`,
        { underline: true },
      );
    doc.moveDown(0.4);
    this.renderInventoryTable(doc, data, relevantPieces);
  }

  private renderInventoryTable(
    doc: PDFKit.PDFDocument,
    data: ReportData,
    pieces: Piece[],
  ) {
    if (!pieces.length) {
      doc.fontSize(10).text('No pieces on record.');
      return;
    }

    const colX = {
      piece: 50,
      room: 200,
      stage: 280,
      condition: 370,
      location: 450,
    };
    const rowHeight = 14;

    const drawHeader = () => {
      doc.fontSize(8).fillColor('#666');
      doc.text('Piece', colX.piece, doc.y, { width: 145, continued: false });
      const headerY = doc.y - rowHeight;
      doc.text('Room', colX.room, headerY, { width: 75 });
      doc.text('Stage', colX.stage, headerY, { width: 85 });
      doc.text('Condition', colX.condition, headerY, { width: 75 });
      doc.text('Location', colX.location, headerY, { width: 100 });
      doc.fillColor('#000');
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor('#ddd').stroke();
      doc.strokeColor('#000');
      doc.moveDown(0.2);
    };

    drawHeader();

    for (const piece of pieces) {
      this.ensureSpace(doc, rowHeight + 4);
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
        drawHeader();
      }

      const roomName =
        piece.room?.name ||
        data.rooms.find((r) => r.id === piece.roomId)?.name ||
        '—';
      const y = doc.y;

      doc.fontSize(9);
      doc.text(piece.name, colX.piece, y, { width: 145, lineBreak: false });
      doc.text(roomName, colX.room, y, { width: 75, lineBreak: false });
      doc.text(STAGE_LABELS[piece.currentStage], colX.stage, y, {
        width: 85,
        lineBreak: false,
      });
      doc.text(CONDITION_LABELS[piece.currentCondition], colX.condition, y, {
        width: 75,
        lineBreak: false,
      });
      doc.text(piece.currentLocation || '—', colX.location, y, {
        width: 100,
        lineBreak: false,
      });
      doc.y = y + rowHeight;
    }
  }

  private renderChainOfCustodySummary(
    doc: PDFKit.PDFDocument,
    data: ReportData,
  ) {
    this.ensureSpace(doc, 100);
    doc.addPage();
    doc.fontSize(15).text('Chain of Custody Summary', { underline: true });
    doc.moveDown(0.6);

    for (const phase of PHASE_ORDER) {
      const requirement = INVENTORY_SIGNOFF_REQUIREMENTS.find(
        (r) => r.phase === phase,
      );
      const signoffs = data.signoffs.filter(
        (s) => s.signoffType === SignoffType.INVENTORY && s.phase === phase,
      );
      const complete = requirement?.roles.every((role) =>
        signoffs.some((s) => s.signerRole === role),
      );

      doc.fontSize(11).text(PHASE_LABELS[phase]);
      doc.fontSize(9);
      if (complete) {
        const names = signoffs.map(
          (s) => `${SIGNER_ROLE_LABELS[s.signerRole]} (${s.signerName})`,
        );
        doc.fillColor('#0f5132').text(`  Complete — ${names.join(', ')}`);
      } else {
        doc
          .fillColor('#92400e')
          .text('  Incomplete — pending required signoffs');
      }
      doc.fillColor('#000').moveDown(0.4);
    }

    doc.moveDown(0.6);
    doc.fontSize(9).fillColor('#666');
    doc.text(
      'Photo documentation at pickup, delivery, and installation milestones is included in this report. ' +
        'Additional imagery is available from your project coordinator upon request.',
    );
    doc.fillColor('#000');
  }

  private renderFooter(doc: PDFKit.PDFDocument) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).fillColor('#999');
      doc.text(
        `White Glove Source · Page ${i + 1} of ${range.count} · Confidential project record`,
        50,
        doc.page.height - 40,
        { align: 'center', width: doc.page.width - 100 },
      );
      doc.fillColor('#000');
    }
  }

  private ensureSpace(doc: PDFKit.PDFDocument, height: number) {
    if (doc.y + height > doc.page.height - 60) {
      doc.addPage();
    }
  }

  private buildPhotoEntries(data: ReportData): PhotoEntry[] {
    const pieceNames = new Map(data.pieces.map((p) => [p.id, p.name]));
    const entries: PhotoEntry[] = [];
    const seen = new Set<string>();

    for (const photo of data.stagePhotos) {
      if (!photo.photoUrl || seen.has(photo.photoUrl)) continue;
      seen.add(photo.photoUrl);
      entries.push({
        url: photo.photoUrl,
        pieceName: pieceNames.get(photo.pieceId) || 'Piece',
        label: PHOTO_MILESTONE_LABELS[photo.milestone],
        phase: MILESTONE_PHASE[photo.milestone],
        capturedAt: photo.capturedAt,
        notes: photo.notes || undefined,
        capturedBy: photo.capturedBy || undefined,
      });
    }

    for (const piece of data.pieces) {
      if (!piece.photoUrl || seen.has(piece.photoUrl)) continue;
      seen.add(piece.photoUrl);
      entries.push({
        url: piece.photoUrl,
        pieceName: piece.name,
        label: 'Reference photo',
        phase: STAGE_PHASE[piece.currentStage],
      });
    }

    return entries.sort(
      (a, b) => (a.capturedAt?.getTime() ?? 0) - (b.capturedAt?.getTime() ?? 0),
    );
  }

  private async loadImageCache(urls: string[]): Promise<Map<string, Buffer>> {
    return loadPhotoBuffers(urls, this.storage);
  }

  private renderPhotoDocumentation(
    doc: PDFKit.PDFDocument,
    entries: PhotoEntry[],
    imageCache: Map<string, Buffer>,
    sectionTitle = 'Photo Documentation',
  ) {
    const withImages = entries.filter((e) => imageCache.has(e.url));
    if (!withImages.length) return;

    doc.moveDown(0.8);
    this.ensureSpace(doc, PHOTO_IMG_HEIGHT + 80);
    doc
      .fontSize(13)
      .fillColor('#1a1a1a')
      .text(sectionTitle, { underline: true });
    doc
      .fontSize(9)
      .fillColor('#666')
      .text(`${withImages.length} photo(s) embedded from field documentation.`);
    doc.fillColor('#000').moveDown(0.5);

    this.renderPhotoGrid(doc, withImages, imageCache);
  }

  private renderPhotoGrid(
    doc: PDFKit.PDFDocument,
    entries: PhotoEntry[],
    imageCache: Map<string, Buffer>,
  ) {
    let col = 0;
    let rowBottom = doc.y;

    for (const entry of entries) {
      const buffer = imageCache.get(entry.url);
      if (!buffer) continue;

      const blockHeight = PHOTO_IMG_HEIGHT + 44;
      if (col === 0) {
        this.ensureSpace(doc, blockHeight);
        rowBottom = doc.y;
      }

      const x = 50 + col * (PHOTO_COL_WIDTH + PHOTO_COL_GAP);
      let textY = rowBottom;

      doc.fontSize(9).fillColor('#1a1a1a').text(entry.pieceName, x, textY, {
        width: PHOTO_COL_WIDTH,
        lineBreak: false,
      });
      textY += 12;

      const meta = [
        entry.label,
        entry.capturedAt
          ? new Date(entry.capturedAt).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : null,
        entry.capturedBy ? `by ${entry.capturedBy}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      doc
        .fontSize(7)
        .fillColor('#666')
        .text(meta, x, textY, { width: PHOTO_COL_WIDTH });
      textY += 14;

      try {
        doc.image(buffer, x, textY, {
          fit: [PHOTO_COL_WIDTH, PHOTO_IMG_HEIGHT],
          align: 'center',
          valign: 'center',
        });
      } catch {
        doc
          .fontSize(8)
          .fillColor('#999')
          .text('[Image unavailable]', x, textY + 40, {
            width: PHOTO_COL_WIDTH,
          });
      }

      if (entry.notes) {
        doc
          .fontSize(7)
          .fillColor('#555')
          .text(entry.notes, x, textY + PHOTO_IMG_HEIGHT + 2, {
            width: PHOTO_COL_WIDTH,
            height: 24,
          });
      }

      col++;
      if (col >= 2) {
        col = 0;
        doc.y = rowBottom + blockHeight + 8;
        rowBottom = doc.y;
      }
    }

    if (col === 1) {
      doc.y = rowBottom + PHOTO_IMG_HEIGHT + 52;
    }
  }
}
