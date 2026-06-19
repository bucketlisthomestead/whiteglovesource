import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Designer } from '../entities/designer.entity';
import { Client } from '../entities/client.entity';
import { Project } from '../entities/project.entity';
import { Room } from '../entities/room.entity';
import { Piece } from '../entities/piece.entity';
import { PieceEvent } from '../entities/piece-event.entity';
import { User } from '../entities/user.entity';
import { PickupLocation } from '../entities/pickup-location.entity';
import { CrewMember } from '../entities/crew-member.entity';
import { ScheduledJob } from '../entities/scheduled-job.entity';
import { JobAssignment } from '../entities/job-assignment.entity';
import {
  ConditionRating,
  InstallDestination,
  PieceStage,
  ProjectStatus,
} from '../common/enums';
import { UserRole } from '../common/roles';
import { getDemoPhotoUrl } from './demo-photos';
import {
  seedCrewIfNeeded,
  seedDemoOperations,
  updateDemoProjectMeta,
} from './seed-demo-operations';
import { seedDemoSignoffs } from './seed-demo-signoffs';
import { seedCatalogIfNeeded } from './seed-catalog';
import { seedStorageLocations } from './seed-storage-locations';
import { PieceStagePhoto } from '../entities/piece-stage-photo.entity';
import { Signoff } from '../entities/signoff.entity';
import { PieceCatalogItem } from '../entities/piece-catalog-item.entity';
import { StorageLocation } from '../entities/storage-location.entity';
import { generateScanToken } from '../common/scan-token';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Designer)
    private readonly designerRepo: Repository<Designer>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(Piece)
    private readonly pieceRepo: Repository<Piece>,
    @InjectRepository(PieceEvent)
    private readonly eventRepo: Repository<PieceEvent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PickupLocation)
    private readonly pickupRepo: Repository<PickupLocation>,
    @InjectRepository(CrewMember)
    private readonly crewRepo: Repository<CrewMember>,
    @InjectRepository(ScheduledJob)
    private readonly jobRepo: Repository<ScheduledJob>,
    @InjectRepository(JobAssignment)
    private readonly assignmentRepo: Repository<JobAssignment>,
    @InjectRepository(PieceStagePhoto)
    private readonly stagePhotoRepo: Repository<PieceStagePhoto>,
    @InjectRepository(Signoff)
    private readonly signoffRepo: Repository<Signoff>,
    @InjectRepository(PieceCatalogItem)
    private readonly catalogRepo: Repository<PieceCatalogItem>,
    @InjectRepository(StorageLocation)
    private readonly storageLocationRepo: Repository<StorageLocation>,
  ) {}

  async onModuleInit() {
    await seedCatalogIfNeeded(this.catalogRepo);
    await seedStorageLocations(this.storageLocationRepo);
    const crew = await seedCrewIfNeeded(this.crewRepo);
    const existing = await this.projectRepo.findOne({
      where: { isDemo: true },
    });

    if (existing) {
      await this.seedUsersIfNeeded(existing.designerId, existing.clientId);
      await this.backfillDemoPhotos(existing.id);
      await updateDemoProjectMeta(this.projectRepo, existing.id);
      await seedDemoOperations(
        this.pickupRepo,
        this.jobRepo,
        this.assignmentRepo,
        this.pieceRepo,
        crew,
        existing.id,
      );
      await seedDemoSignoffs(
        this.pieceRepo,
        this.stagePhotoRepo,
        this.signoffRepo,
        existing.id,
      );
      await this.backfillScanTokens();
      this.logger.log('Demo data already seeded');
      return;
    }

    this.logger.log('Seeding demo project data...');
    const { designerId, clientId, projectId } = await this.seedDemo();
    await this.seedUsersIfNeeded(designerId, clientId);
    await updateDemoProjectMeta(this.projectRepo, projectId);
    await seedDemoOperations(
      this.pickupRepo,
      this.jobRepo,
      this.assignmentRepo,
      this.pieceRepo,
      crew,
      projectId,
    );
    await seedDemoSignoffs(
      this.pieceRepo,
      this.stagePhotoRepo,
      this.signoffRepo,
      projectId,
    );
    await this.backfillScanTokens();
    this.logger.log('Demo data seeded successfully');
  }

  private async backfillScanTokens() {
    const missing = await this.pieceRepo
      .createQueryBuilder('piece')
      .where('piece.scanToken IS NULL')
      .getMany();
    for (const piece of missing) {
      piece.scanToken = generateScanToken();
      await this.pieceRepo.save(piece);
    }
    if (missing.length) {
      this.logger.log(`Assigned scan tokens to ${missing.length} piece(s)`);
    }
  }

  private async seedUsersIfNeeded(designerId: string, clientId: string) {
    const hash = await bcrypt.hash('password123', 10);
    const seedUsers = [
      {
        email: 'admin@whiteglovedeliverync.com',
        passwordHash: hash,
        name: 'WGS Owner',
        role: UserRole.ADMIN,
        designerId: null,
        clientId: null,
      },
      {
        email: 'sarah@whitfieldinteriors.com',
        passwordHash: hash,
        name: 'Sarah Whitfield',
        role: UserRole.DESIGNER,
        designerId,
        clientId: null,
      },
      {
        email: 'morrison@example.com',
        passwordHash: hash,
        name: 'James & Catherine Morrison',
        role: UserRole.CLIENT,
        designerId: null,
        clientId,
      },
    ] as const;

    let created = 0;
    let repaired = 0;
    for (const seed of seedUsers) {
      const existing = await this.userRepo.findOne({
        where: { email: seed.email },
      });
      if (!existing) {
        await this.userRepo.save(this.userRepo.create(seed));
        created++;
        continue;
      }

      let changed = false;
      if (existing.role !== seed.role) {
        existing.role = seed.role;
        changed = true;
      }
      if (seed.role === UserRole.ADMIN) {
        if (existing.designerId !== null || existing.clientId !== null) {
          existing.designerId = null;
          existing.clientId = null;
          changed = true;
        }
      }
      if (
        seed.role === UserRole.DESIGNER &&
        existing.designerId !== seed.designerId
      ) {
        existing.designerId = seed.designerId;
        changed = true;
      }
      if (
        seed.role === UserRole.CLIENT &&
        existing.clientId !== seed.clientId
      ) {
        existing.clientId = seed.clientId;
        changed = true;
      }
      if (changed) {
        await this.userRepo.save(existing);
        repaired++;
        this.logger.warn(
          `Repaired seed user ${seed.email} (role: ${seed.role})`,
        );
      }
    }

    if (created > 0) {
      this.logger.log(`Seed users created (${created}, password: password123)`);
    }
    if (repaired > 0) {
      this.logger.log(`Seed users repaired (${repaired})`);
    }
  }

  private async seedDemo(): Promise<{
    designerId: string;
    clientId: string;
    projectId: string;
  }> {
    const designer = await this.designerRepo.save(
      this.designerRepo.create({
        name: 'Sarah Whitfield',
        firm: 'Whitfield Interiors',
        email: 'sarah@whitfieldinteriors.com',
        phone: '(336) 555-0142',
        city: 'High Point, NC',
      }),
    );

    const client = await this.clientRepo.save(
      this.clientRepo.create({
        name: 'James & Catherine Morrison',
        email: 'morrison@example.com',
        phone: '(336) 555-0198',
        address: '1842 Lakeview Drive',
        city: 'Greensboro, NC',
      }),
    );

    const project = await this.projectRepo.save(
      this.projectRepo.create({
        name: 'Morrison Lake House — Full Home Installation',
        description:
          'Complete white-glove receiving, storage, and installation for a 4,200 sq ft lakefront residence. Multi-vendor furniture coordination with room-by-room staging.',
        status: ProjectStatus.PICKUP_STORAGE,
        propertyAddress: '1842 Lakeview Drive',
        propertyCity: 'Greensboro, NC',
        targetInstallDate: '2026-06-28',
        isDemo: true,
        designerId: designer.id,
        clientId: client.id,
      }),
    );

    const rooms = await this.roomRepo.save([
      {
        name: 'Primary Bedroom',
        sortOrder: 1,
        projectId: project.id,
        notes: 'Cal King bed wall — east facing',
      },
      {
        name: 'Living Room',
        sortOrder: 2,
        projectId: project.id,
        notes: 'Sectional facing lake view windows',
      },
      {
        name: 'Dining Room',
        sortOrder: 3,
        projectId: project.id,
        notes: 'Seats 10 — chandelier clearance 36"',
      },
      {
        name: 'Home Office',
        sortOrder: 4,
        projectId: project.id,
        notes: 'Built-in desk wall — north wall',
      },
      {
        name: 'Primary Bath',
        sortOrder: 5,
        projectId: project.id,
        notes: 'Freestanding tub placement critical',
      },
    ]);

    const roomMap = Object.fromEntries(rooms.map((r) => [r.name, r.id]));

    const piecesData = [
      // Phase 1 — identified / pickup scheduled
      {
        name: 'Area Rug — 9x12 Hand-Knotted',
        vendor: 'Stark Carpet',
        room: 'Living Room',
        stage: PieceStage.IDENTIFIED,
        condition: ConditionRating.EXCELLENT,
        location: 'Client site — pending pickup',
        value: 11000,
      },
      {
        name: 'Chandelier — Hand-Blown Glass',
        vendor: 'Hubbardton Forge',
        room: 'Dining Room',
        stage: PieceStage.SCHEDULED_PICKUP,
        condition: ConditionRating.EXCELLENT,
        location: 'Hubbardton Forge — pickup Jun 22',
        value: 6800,
      },
      // Phase 2 — pickup, storage, verify
      {
        name: 'Cal King Upholstered Bed',
        vendor: 'Bernhardt',
        room: 'Primary Bedroom',
        stage: PieceStage.STORED,
        condition: ConditionRating.EXCELLENT,
        location: 'WGS Warehouse — Rack A-14',
        value: 4200,
      },
      {
        name: 'Nightstand (Pair)',
        vendor: 'Bernhardt',
        room: 'Primary Bedroom',
        stage: PieceStage.STORED,
        condition: ConditionRating.EXCELLENT,
        location: 'WGS Warehouse — Rack A-14',
        value: 1800,
      },
      {
        name: 'Dresser & Mirror',
        vendor: 'Bernhardt',
        room: 'Primary Bedroom',
        stage: PieceStage.INSPECTED,
        condition: ConditionRating.GOOD,
        location: 'WGS Inspection — awaiting touch-up',
        value: 3600,
      },
      {
        name: 'Sectional Sofa — Custom Linen',
        vendor: 'Century Furniture',
        room: 'Living Room',
        stage: PieceStage.SCHEDULED_PICKUP,
        condition: ConditionRating.EXCELLENT,
        location: 'Century DC Hickory — pickup Jun 20',
        value: 8900,
      },
      {
        name: 'Marble Coffee Table',
        vendor: 'Arteriors',
        room: 'Living Room',
        stage: PieceStage.STORED,
        condition: ConditionRating.EXCELLENT,
        location: 'WGS Climate Vault B',
        value: 2400,
      },
      {
        name: 'Floor Lamp — Brass Arc',
        vendor: 'Visual Comfort',
        room: 'Living Room',
        stage: PieceStage.IDENTIFIED,
        condition: ConditionRating.EXCELLENT,
        location: 'Client garage — pickup TBD',
        value: 1200,
      },
      {
        name: 'Dining Table — 10ft Walnut',
        vendor: 'Theodore Alexander',
        room: 'Dining Room',
        stage: PieceStage.STAGED,
        condition: ConditionRating.EXCELLENT,
        location: 'WGS Staging Bay B — install sequence 3',
        value: 12500,
      },
      {
        name: 'Dining Chairs (10)',
        vendor: 'Theodore Alexander',
        room: 'Dining Room',
        stage: PieceStage.STAGED,
        condition: ConditionRating.EXCELLENT,
        location: 'WGS Staging Bay B — install sequence 3',
        value: 7500,
      },
      {
        name: 'Executive Desk — Walnut',
        vendor: 'Hickory Chair',
        room: 'Home Office',
        stage: PieceStage.INSPECTED,
        condition: ConditionRating.GOOD,
        location: 'WGS Receiving — verified',
        value: 5400,
      },
      {
        name: 'Vanity Console — Double',
        vendor: 'Robern',
        room: 'Primary Bath',
        stage: PieceStage.INSPECTED,
        condition: ConditionRating.FAIR,
        location: 'WGS Receiving Dock — corner touch-up scheduled',
        value: 4800,
      },
      // Phase 3 — install scheduled / in progress
      {
        name: 'Leather Desk Chair',
        vendor: 'Hickory Chair',
        room: 'Home Office',
        stage: PieceStage.SCHEDULED_INSTALL,
        condition: ConditionRating.EXCELLENT,
        location: 'WGS Staging — install Jun 28',
        value: 2200,
      },
      {
        name: 'Freestanding Soaking Tub',
        vendor: 'Victoria + Albert',
        room: 'Primary Bath',
        stage: PieceStage.SCHEDULED_INSTALL,
        condition: ConditionRating.EXCELLENT,
        location: 'WGS Staging — special rigging Jun 28',
        value: 9200,
      },
    ];

    for (const data of piecesData) {
      const photo = getDemoPhotoUrl(data.name);
      const piece = await this.pieceRepo.save(
        this.pieceRepo.create({
          name: data.name,
          vendor: data.vendor,
          roomId: roomMap[data.room],
          projectId: project.id,
          currentStage: data.stage,
          currentCondition: data.condition,
          currentLocation: data.location,
          value: data.value,
          photoUrl: photo,
          installDestination: InstallDestination.FINAL_SITE,
          scanToken: generateScanToken(),
        }),
      );

      const stages = this.buildEventHistory(
        data.stage,
        data.condition,
        data.location,
        photo,
      );
      for (const evt of stages) {
        await this.eventRepo.save(
          this.eventRepo.create({
            pieceId: piece.id,
            ...evt,
            verifiedBy: 'WGS Team',
          }),
        );
      }
    }

    return {
      designerId: designer.id,
      clientId: client.id,
      projectId: project.id,
    };
  }

  private async backfillDemoPhotos(projectId: string) {
    const pieces = await this.pieceRepo.find({ where: { projectId } });
    let updated = 0;

    for (const piece of pieces) {
      const photo = getDemoPhotoUrl(piece.name);
      if (!photo) continue;

      if (piece.photoUrl !== photo) {
        piece.photoUrl = photo;
        await this.pieceRepo.save(piece);
        updated++;
      }

      const inspectedEvent = await this.eventRepo.findOne({
        where: { pieceId: piece.id, stage: PieceStage.INSPECTED },
      });
      if (inspectedEvent && !inspectedEvent.photoUrl) {
        inspectedEvent.photoUrl = photo;
        await this.eventRepo.save(inspectedEvent);
      }
    }

    if (updated > 0) {
      this.logger.log(`Backfilled photos for ${updated} demo pieces`);
    }
  }

  private buildEventHistory(
    finalStage: PieceStage,
    finalCondition: ConditionRating,
    finalLocation: string,
    photoUrl?: string,
  ) {
    const stageOrder = [
      PieceStage.IDENTIFIED,
      PieceStage.SCHEDULED_PICKUP,
      PieceStage.RECEIVED,
      PieceStage.INSPECTED,
      PieceStage.STORED,
      PieceStage.STAGED,
      PieceStage.SCHEDULED_INSTALL,
      PieceStage.IN_TRANSIT,
      PieceStage.DELIVERED,
      PieceStage.INSTALLED,
    ];
    const finalIndex = stageOrder.indexOf(finalStage);
    const locations: Partial<Record<PieceStage, string>> = {
      [PieceStage.IDENTIFIED]: 'On inventory manifest — staging plan assigned',
      [PieceStage.SCHEDULED_PICKUP]: 'Pickup scheduled with WGS dispatch',
      [PieceStage.RECEIVED]: 'WGS Receiving Dock — High Point',
      [PieceStage.INSPECTED]: 'WGS Inspection Station',
      [PieceStage.STORED]: 'WGS Climate-Controlled Warehouse',
      [PieceStage.STAGED]: 'WGS Staging Bay',
      [PieceStage.SCHEDULED_INSTALL]: 'Queued for install day — Jun 28',
      [PieceStage.IN_TRANSIT]: 'En route to property',
      [PieceStage.DELIVERED]: finalLocation,
      [PieceStage.INSTALLED]: finalLocation,
    };

    return stageOrder.slice(0, finalIndex + 1).map((stage, i) => ({
      stage,
      condition: i === finalIndex ? finalCondition : ConditionRating.EXCELLENT,
      location:
        i === finalIndex ? finalLocation : locations[stage] || finalLocation,
      photoUrl: stage === PieceStage.INSPECTED ? photoUrl : undefined,
      notes:
        stage === PieceStage.IDENTIFIED
          ? 'Added to project inventory and staging plan'
          : stage === PieceStage.SCHEDULED_PICKUP
            ? 'Driver and crew assigned'
            : stage === PieceStage.INSPECTED
              ? 'Condition documented with photos'
              : stage === PieceStage.SCHEDULED_INSTALL
                ? 'Install crew scheduled'
                : undefined,
    }));
  }
}
