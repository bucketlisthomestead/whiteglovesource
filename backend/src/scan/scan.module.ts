import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { RolesModule } from '../roles/roles.module';
import { ScanController } from './scan.controller';

@Module({
  imports: [ProjectsModule, RolesModule],
  controllers: [ScanController],
})
export class ScanModule {}
