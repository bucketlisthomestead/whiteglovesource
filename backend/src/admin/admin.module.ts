import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { Piece } from '../entities/piece.entity';
import { Room } from '../entities/room.entity';
import { QuoteRequest } from '../entities/quote-request.entity';
import { ContactMessage } from '../entities/contact-message.entity';
import { User } from '../entities/user.entity';
import { Designer } from '../entities/designer.entity';
import { Client } from '../entities/client.entity';
import { PieceCatalogItem } from '../entities/piece-catalog-item.entity';
import { StorageLocation } from '../entities/storage-location.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ProjectsModule } from '../projects/projects.module';
import { MileageModule } from '../mileage/mileage.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Piece,
      Room,
      QuoteRequest,
      ContactMessage,
      User,
      Designer,
      Client,
      PieceCatalogItem,
      StorageLocation,
    ]),
    ProjectsModule,
    MileageModule,
    RolesModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, PermissionsGuard],
})
export class AdminModule {}
