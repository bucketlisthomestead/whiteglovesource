import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Signoff } from '../entities/signoff.entity';
import { PieceStagePhoto } from '../entities/piece-stage-photo.entity';
import { CreateSignoffDto } from '../common/signoff.dto';
import { PhotoMilestone, SignerRole } from '../common/signoff';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/roles';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class SignoffsService {
  constructor(
    @InjectRepository(Signoff)
    private readonly signoffRepo: Repository<Signoff>,
    @InjectRepository(PieceStagePhoto)
    private readonly stagePhotoRepo: Repository<PieceStagePhoto>,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
  ) {}

  async create(dto: CreateSignoffDto, user: User) {
    await this.projectsService.assertProjectAccess(dto.projectId, user);
    this.assertCanSign(dto.signerRole, user);

    if (dto.pieceId) {
      await this.projectsService.assertProjectAccess(
        (await this.projectsService.findPiece(dto.pieceId)).projectId,
        user,
      );
    }

    return this.signoffRepo.save(
      this.signoffRepo.create({
        projectId: dto.projectId,
        pieceId: dto.pieceId ?? null,
        signoffType: dto.signoffType,
        signerRole: dto.signerRole,
        signerName: user.name,
        signerUserId: user.id,
        milestone: dto.milestone ?? null,
        phase: dto.phase ?? null,
        notes: dto.notes,
      }),
    );
  }

  findByProject(projectId: string) {
    return this.signoffRepo.find({
      where: { projectId },
      relations: { piece: true },
      order: { signedAt: 'DESC' },
    });
  }

  findByPiece(pieceId: string) {
    return this.signoffRepo.find({
      where: { pieceId },
      order: { signedAt: 'DESC' },
    });
  }

  findStagePhotosByProject(projectId: string) {
    return this.stagePhotoRepo
      .createQueryBuilder('p')
      .innerJoin('p.piece', 'piece')
      .where('piece.projectId = :projectId', { projectId })
      .orderBy('p.capturedAt', 'DESC')
      .getMany();
  }

  findStagePhotosByPiece(pieceId: string) {
    return this.stagePhotoRepo.find({
      where: { pieceId },
      order: { milestone: 'ASC' },
    });
  }

  async upsertStagePhoto(
    pieceId: string,
    milestone: PhotoMilestone,
    photoUrl: string,
    capturedBy?: string,
    notes?: string,
  ) {
    const existing = await this.stagePhotoRepo.findOne({
      where: { pieceId, milestone },
    });
    if (existing) {
      existing.photoUrl = photoUrl;
      existing.capturedBy = capturedBy ?? existing.capturedBy;
      existing.notes = notes ?? existing.notes;
      return this.stagePhotoRepo.save(existing);
    }
    return this.stagePhotoRepo.save(
      this.stagePhotoRepo.create({
        pieceId,
        milestone,
        photoUrl,
        capturedBy,
        notes,
      }),
    );
  }

  private assertCanSign(role: SignerRole, user: User) {
    if (user.role === UserRole.ADMIN) return;
    if (role === SignerRole.DESIGNER && user.role === UserRole.DESIGNER) return;
    if (role === SignerRole.CLIENT && user.role === UserRole.CLIENT) return;
    throw new ForbiddenException('You cannot sign in this role');
  }
}
