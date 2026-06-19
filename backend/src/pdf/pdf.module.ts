import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { Room } from '../entities/room.entity';
import { Piece } from '../entities/piece.entity';
import { Signoff } from '../entities/signoff.entity';
import { PieceStagePhoto } from '../entities/piece-stage-photo.entity';
import { ProjectDocument } from '../entities/project-document.entity';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Room,
      Piece,
      Signoff,
      PieceStagePhoto,
      ProjectDocument,
    ]),
    ProjectsModule,
  ],
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
