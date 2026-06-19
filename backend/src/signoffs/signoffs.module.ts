import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Signoff } from '../entities/signoff.entity';
import { PieceStagePhoto } from '../entities/piece-stage-photo.entity';
import { SignoffsController } from './signoffs.controller';
import { SignoffsService } from './signoffs.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Signoff, PieceStagePhoto]),
    forwardRef(() => ProjectsModule),
  ],
  controllers: [SignoffsController],
  providers: [SignoffsService],
  exports: [SignoffsService],
})
export class SignoffsModule {}
