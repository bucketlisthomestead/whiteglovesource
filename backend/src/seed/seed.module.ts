import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { PieceStagePhoto } from '../entities/piece-stage-photo.entity';
import { Signoff } from '../entities/signoff.entity';
import { PieceCatalogItem } from '../entities/piece-catalog-item.entity';
import { StorageLocation } from '../entities/storage-location.entity';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Designer,
      Client,
      Project,
      Room,
      Piece,
      PieceEvent,
      User,
      PickupLocation,
      CrewMember,
      ScheduledJob,
      JobAssignment,
      PieceStagePhoto,
      Signoff,
      PieceCatalogItem,
      StorageLocation,
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
