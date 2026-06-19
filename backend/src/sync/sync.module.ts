import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncRecord } from '../entities/sync-record.entity';
import { ProjectsModule } from '../projects/projects.module';
import { StorageModule } from '../storage/storage.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([SyncRecord]), ProjectsModule, StorageModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
