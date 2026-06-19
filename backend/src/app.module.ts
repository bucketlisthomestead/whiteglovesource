import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ContactModule } from './contact/contact.module';
import { QuotesModule } from './quotes/quotes.module';
import { ProjectsModule } from './projects/projects.module';
import { SeedModule } from './seed/seed.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { UploadsModule } from './uploads/uploads.module';
import { AdminModule } from './admin/admin.module';
import { PdfModule } from './pdf/pdf.module';
import { SyncModule } from './sync/sync.module';
import { SignoffsModule } from './signoffs/signoffs.module';
import { CatalogModule } from './catalog/catalog.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { HealthController } from './health/health.controller';
import { Designer } from './entities/designer.entity';
import { Client } from './entities/client.entity';
import { Project } from './entities/project.entity';
import { Room } from './entities/room.entity';
import { Piece } from './entities/piece.entity';
import { PieceEvent } from './entities/piece-event.entity';
import { QuoteRequest } from './entities/quote-request.entity';
import { ContactMessage } from './entities/contact-message.entity';
import { User } from './entities/user.entity';
import { SyncRecord } from './entities/sync-record.entity';
import { PickupLocation } from './entities/pickup-location.entity';
import { CrewMember } from './entities/crew-member.entity';
import { ScheduledJob } from './entities/scheduled-job.entity';
import { JobAssignment } from './entities/job-assignment.entity';
import { PieceStagePhoto } from './entities/piece-stage-photo.entity';
import { Signoff } from './entities/signoff.entity';
import { PieceCatalogItem } from './entities/piece-catalog-item.entity';
import { StorageLocation } from './entities/storage-location.entity';
import { ProjectDocument } from './entities/project-document.entity';
import { ProjectLabelPdf } from './entities/project-label-pdf.entity';
import { ProjectMessage } from './entities/project-message.entity';
import { Notification } from './entities/notification.entity';
import { AppSettings } from './entities/app-settings.entity';
import { RecordChange } from './entities/record-change.entity';
import { QuoteMessage } from './entities/quote-message.entity';
import { AppRole } from './entities/app-role.entity';
import { StorageModule } from './storage/storage.module';
import { RolesModule } from './roles/roles.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SettingsModule } from './settings/settings.module';
import { AuditModule } from './audit/audit.module';
import { ContractProposal } from './entities/contract-proposal.entity';
import { ContractAmendment } from './entities/contract-amendment.entity';
import { ContractsModule } from './contracts/contracts.module';
import { ProjectPhasePayment } from './entities/project-phase-payment.entity';
import { PhasePaymentsModule } from './phase-payments/phase-payments.module';
import { SiteContentModule } from './site-content/site-content.module';
import { SiteMenuModule } from './site-menu/site-menu.module';
import { SiteContentVersion } from './entities/site-content-version.entity';
import { SiteContentDraft } from './entities/site-content-draft.entity';
import { SiteContentDraftEntry } from './entities/site-content-draft-entry.entity';
import { SiteContentFeedback } from './entities/site-content-feedback.entity';
import { SiteMenuVersion } from './entities/site-menu-version.entity';
import { ScanModule } from './scan/scan.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const dbType = config.get<'mysql' | 'postgres'>('DB_TYPE', 'mysql');
        const defaultPort = dbType === 'postgres' ? 5432 : 3306;
        return {
          type: dbType,
          host: config.get('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', defaultPort),
          username: config.get('DB_USERNAME', 'wgds'),
          password: config.get('DB_PASSWORD', 'wgdspassword'),
          database: config.get('DB_DATABASE', 'white_glove_delivery'),
          entities: [
          Designer,
          Client,
          Project,
          Room,
          Piece,
          PieceEvent,
          QuoteRequest,
          ContactMessage,
          User,
          SyncRecord,
          PickupLocation,
          CrewMember,
          ScheduledJob,
          JobAssignment,
          PieceStagePhoto,
          Signoff,
          PieceCatalogItem,
          StorageLocation,
          ProjectDocument,
          ProjectLabelPdf,
          ProjectMessage,
          Notification,
          AppSettings,
          RecordChange,
          QuoteMessage,
          AppRole,
          ContractProposal,
          ContractAmendment,
          ProjectPhasePayment,
          SiteContentVersion,
          SiteContentDraft,
          SiteContentDraftEntry,
          SiteContentFeedback,
          SiteMenuVersion,
        ],
        synchronize:
          config.get('TYPEORM_SYNCHRONIZE') === 'true' ||
          config.get('NODE_ENV') !== 'production',
        } as TypeOrmModuleOptions;
      },
    }),
    AuthModule,
    EmailModule,
    ContactModule,
    QuotesModule,
    ProjectsModule,
    UploadsModule,
    StorageModule,
    AdminModule,
    PdfModule,
    SyncModule,
    SignoffsModule,
    CatalogModule,
    SeedModule,
    NotificationsModule,
    SettingsModule,
    AuditModule,
    RolesModule,
    ContractsModule,
    PhasePaymentsModule,
    SiteContentModule,
    SiteMenuModule,
    ScanModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
