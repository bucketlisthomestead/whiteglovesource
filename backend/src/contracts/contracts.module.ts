import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractProposal } from '../entities/contract-proposal.entity';
import { Project } from '../entities/project.entity';
import { Piece } from '../entities/piece.entity';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { ProjectsModule } from '../projects/projects.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContractProposal, Project, Piece]),
    ProjectsModule,
    SettingsModule,
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
