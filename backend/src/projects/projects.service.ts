import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Piece } from '../entities/piece.entity';
import { PieceEvent } from '../entities/piece-event.entity';
import { Room } from '../entities/room.entity';
import { PickupLocation } from '../entities/pickup-location.entity';
import { ScheduledJob } from '../entities/scheduled-job.entity';
import { CreatePieceEventDto } from '../common/dto';
import {
  displayProjectName,
  formatJobNumber,
  generateScanToken,
} from '../common/scan-token';
import { PieceStage, ProjectPhase, STAGE_PHASE } from '../common/enums';
import { PhotoMilestone, STAGE_TO_PHOTO_MILESTONE } from '../common/signoff';
import { SignoffsService } from '../signoffs/signoffs.service';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/roles';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Piece)
    private readonly pieceRepo: Repository<Piece>,
    @InjectRepository(PieceEvent)
    private readonly eventRepo: Repository<PieceEvent>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(PickupLocation)
    private readonly pickupRepo: Repository<PickupLocation>,
    @InjectRepository(ScheduledJob)
    private readonly jobRepo: Repository<ScheduledJob>,
    @Inject(forwardRef(() => SignoffsService))
    private readonly signoffsService: SignoffsService,
  ) {}

  findAll(user?: User) {
    const where = this.buildAccessFilter(user);
    return this.projectRepo.find({
      where,
      relations: { designer: true, client: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findForUser(user: User) {
    const where = this.buildAccessFilter(user);
    const projects = await this.projectRepo.find({
      where,
      relations: { designer: true, client: true },
      order: { updatedAt: 'DESC' },
    });
    return projects;
  }

  private buildAccessFilter(
    user?: User,
  ): Record<string, unknown> | Record<string, unknown>[] {
    const activeOnly = { isActive: true, isDemo: false };
    if (!user || user.role === UserRole.ADMIN) return activeOnly;
    if (user.role === UserRole.DESIGNER && user.designerId) {
      return { designerId: user.designerId, ...activeOnly };
    }
    if (user.role === UserRole.CLIENT && user.clientId) {
      return { clientId: user.clientId, ...activeOnly };
    }
    return { id: 'none' };
  }

  async assertProjectAccess(projectId: string, user?: User) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (!project.isActive && project.isDemo === false) {
      const isAdmin = user?.role === UserRole.ADMIN;
      if (!isAdmin) throw new NotFoundException('Project not found');
    }
    if (!user || user.role === UserRole.ADMIN) return project;
    if (
      user.role === UserRole.DESIGNER &&
      user.designerId === project.designerId
    )
      return project;
    if (user.role === UserRole.CLIENT && user.clientId === project.clientId)
      return project;
    if (project.isDemo) return project;
    throw new ForbiddenException('Access denied');
  }

  async findDemo() {
    const project = await this.projectRepo.findOne({
      where: { isDemo: true },
      relations: {
        designer: true,
        client: true,
        rooms: true,
        pieces: { room: true },
      },
    });
    if (!project) {
      throw new NotFoundException('Demo project not found');
    }
    return this.enrichProject(project);
  }

  async findOne(id: string, user?: User) {
    await this.assertProjectAccess(id, user);
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: {
        designer: true,
        client: true,
        rooms: true,
        pieces: { room: true },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.enrichProject(project);
  }

  async findPiece(pieceId: string) {
    const piece = await this.pieceRepo.findOne({
      where: { id: pieceId },
      relations: {
        room: true,
        events: true,
        project: { designer: true, client: true },
      },
    });
    if (!piece) {
      throw new NotFoundException('Piece not found');
    }
    await this.ensurePieceScanToken(piece);
    piece.events.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const stagePhotos =
      await this.signoffsService.findStagePhotosByPiece(pieceId);
    const signoffs = await this.signoffsService.findByPiece(pieceId);
    return { ...piece, stagePhotos, signoffs };
  }

  async findPieceByScanToken(token: string) {
    let piece = await this.pieceRepo.findOne({
      where: { scanToken: token },
      relations: {
        room: true,
        events: true,
        project: { designer: true, client: true },
      },
    });
    if (!piece) {
      throw new NotFoundException('Invalid scan code');
    }
    piece = await this.ensurePieceScanToken(piece);
    piece.events.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const stagePhotos =
      await this.signoffsService.findStagePhotosByPiece(piece.id);
    const signoffs = await this.signoffsService.findByPiece(piece.id);
    return {
      ...piece,
      stagePhotos,
      signoffs,
      jobNumber: formatJobNumber(piece.projectId),
    };
  }

  async getProjectLabels(projectId: string, user?: User) {
    await this.assertProjectAccess(projectId, user);
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const pieces = await this.pieceRepo.find({
      where: { projectId },
      relations: { room: true },
      order: { name: 'ASC' },
    });

    const labels = [];
    for (const piece of pieces) {
      const withToken = await this.ensurePieceScanToken(piece);
      labels.push({
        pieceId: withToken.id,
        scanToken: withToken.scanToken,
        pieceName: withToken.name,
        roomName: withToken.room?.name ?? null,
        currentStage: withToken.currentStage,
        currentLocation: withToken.currentLocation,
      });
    }

    return {
      projectId: project.id,
      projectName: project.name,
      labelTitle: displayProjectName(project.id, project.name),
      jobNumber: formatJobNumber(project.id),
      printedAt: new Date().toISOString(),
      labels,
    };
  }

  async addPieceEventByScanToken(
    token: string,
    dto: CreatePieceEventDto,
    user?: User,
  ) {
    const piece = await this.pieceRepo.findOne({ where: { scanToken: token } });
    if (!piece) throw new NotFoundException('Invalid scan code');
    return this.addPieceEvent(piece.id, dto, user);
  }

  async ensurePieceScanToken(piece: Piece): Promise<Piece> {
    if (piece.scanToken) return piece;
    for (let attempt = 0; attempt < 5; attempt++) {
      const scanToken = generateScanToken();
      try {
        piece.scanToken = scanToken;
        return await this.pieceRepo.save(piece);
      } catch {
        piece.scanToken = null;
      }
    }
    throw new Error('Unable to assign scan token');
  }

  async backfillMissingScanTokens() {
    const missing = await this.pieceRepo.find({ where: { scanToken: null as unknown as string } });
    for (const piece of missing) {
      await this.ensurePieceScanToken(piece);
    }
    return missing.length;
  }

  async addPieceEvent(pieceId: string, dto: CreatePieceEventDto, user?: User) {
    const piece = await this.pieceRepo.findOne({ where: { id: pieceId } });
    if (!piece) {
      throw new NotFoundException('Piece not found');
    }
    await this.assertProjectAccess(piece.projectId, user);

    const event = this.eventRepo.create({
      pieceId,
      stage: dto.stage as PieceStage,
      condition: dto.condition as never,
      location: dto.location,
      notes: dto.notes,
      verifiedBy: dto.verifiedBy || user?.name,
      photoUrl: dto.photoUrl,
    });
    await this.eventRepo.save(event);

    piece.currentStage = dto.stage as PieceStage;
    piece.currentCondition = dto.condition as never;
    piece.currentLocation = dto.location;
    await this.pieceRepo.save(piece);

    const milestone =
      (dto as { photoMilestone?: PhotoMilestone }).photoMilestone ||
      STAGE_TO_PHOTO_MILESTONE[dto.stage as PieceStage];
    if (milestone && dto.photoUrl) {
      await this.signoffsService.upsertStagePhoto(
        pieceId,
        milestone,
        dto.photoUrl,
        dto.verifiedBy || user?.name,
        dto.notes,
      );
    }

    return this.findPiece(pieceId);
  }

  private async enrichProject(project: Project) {
    const rooms = await this.roomRepo.find({
      where: { projectId: project.id },
      order: { sortOrder: 'ASC' },
    });

    const pieces = await this.pieceRepo.find({
      where: { projectId: project.id },
      relations: { room: true, pickupLocation: true },
      order: { name: 'ASC' },
    });

    const pickupLocations = await this.pickupRepo.find({
      where: { projectId: project.id },
      order: { name: 'ASC' },
    });

    const scheduledJobs = await this.jobRepo.find({
      where: { projectId: project.id },
      relations: { assignments: { crewMember: true }, pickupLocation: true },
      order: { scheduledDate: 'ASC', startTime: 'ASC' },
    });

    const signoffs = await this.signoffsService.findByProject(project.id);
    const allStagePhotos = await this.signoffsService.findStagePhotosByProject(
      project.id,
    );
    const stagePhotosByPiece = allStagePhotos.reduce(
      (acc, p) => {
        if (!acc[p.pieceId]) acc[p.pieceId] = [];
        acc[p.pieceId].push(p);
        return acc;
      },
      {} as Record<string, typeof allStagePhotos>,
    );

    const piecesWithPhotos = pieces.map((p) => ({
      ...p,
      stagePhotos: stagePhotosByPiece[p.id] || [],
      signoffs: signoffs.filter((s) => s.pieceId === p.id),
    }));

    const stageSummary = pieces.reduce(
      (acc, piece) => {
        acc[piece.currentStage] = (acc[piece.currentStage] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const phaseSummary = pieces.reduce(
      (acc, piece) => {
        const phase = STAGE_PHASE[piece.currentStage];
        acc[phase] = (acc[phase] || 0) + 1;
        return acc;
      },
      {} as Record<ProjectPhase, number>,
    );

    return {
      ...project,
      rooms,
      pieces: piecesWithPhotos,
      pickupLocations,
      scheduledJobs,
      signoffs,
      stats: {
        totalPieces: pieces.length,
        totalRooms: rooms.length,
        stageSummary,
        phaseSummary,
        upcomingJobs: scheduledJobs.filter((j) => j.status === 'scheduled')
          .length,
      },
    };
  }
}
