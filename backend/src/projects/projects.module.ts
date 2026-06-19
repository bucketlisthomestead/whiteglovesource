import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { Piece } from '../entities/piece.entity';
import { PieceEvent } from '../entities/piece-event.entity';
import { Room } from '../entities/room.entity';
import { PickupLocation } from '../entities/pickup-location.entity';
import { ScheduledJob } from '../entities/scheduled-job.entity';
import { QuoteRequest } from '../entities/quote-request.entity';
import { ProjectDocument } from '../entities/project-document.entity';
import { ProjectLabelPdf } from '../entities/project-label-pdf.entity';
import { ProjectMessage } from '../entities/project-message.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectAuditService } from './project-audit.service';
import { LabelPdfGenerator } from './label-pdf.generator';
import { ProjectLabelPdfService } from './project-label-pdf.service';
import { SignoffsModule } from '../signoffs/signoffs.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Piece,
      PieceEvent,
      Room,
      PickupLocation,
      ScheduledJob,
      QuoteRequest,
      ProjectDocument,
      ProjectLabelPdf,
      ProjectMessage,
    ]),
    forwardRef(() => SignoffsModule),
    RolesModule,
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectAuditService,
    LabelPdfGenerator,
    ProjectLabelPdfService,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
