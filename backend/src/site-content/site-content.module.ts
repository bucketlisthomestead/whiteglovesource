import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteContentVersion } from '../entities/site-content-version.entity';
import { SiteContentDraft } from '../entities/site-content-draft.entity';
import { SiteContentDraftEntry } from '../entities/site-content-draft-entry.entity';
import { SiteContentFeedback } from '../entities/site-content-feedback.entity';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RolesModule } from '../roles/roles.module';
import { SeoAnalyzerService } from './seo/seo-analyzer.service';
import { SiteContentController } from './site-content.controller';
import { SiteContentService } from './site-content.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SiteContentVersion,
      SiteContentDraft,
      SiteContentDraftEntry,
      SiteContentFeedback,
    ]),
    RolesModule,
  ],
  controllers: [SiteContentController],
  providers: [SiteContentService, SeoAnalyzerService, PermissionsGuard],
  exports: [SiteContentService],
})
export class SiteContentModule {}
