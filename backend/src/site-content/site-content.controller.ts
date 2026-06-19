import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Public } from '../common/decorators';
import { PERMISSIONS } from '../common/permissions';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../common/permissions.decorator';
import { SeoAnalyzerService } from './seo/seo-analyzer.service';
import { SiteContentService } from './site-content.service';

type SaveSiteContentBody = {
  content: Record<string, unknown>;
  changeNote?: string;
};

type DraftFeedbackBody = {
  contentKey?: string | null;
  message: string;
};

type PublishDraftBody = {
  publishNote?: string;
};

@Controller()
export class SiteContentController {
  constructor(
    private readonly siteContentService: SiteContentService,
    private readonly seoAnalyzerService: SeoAnalyzerService,
  ) {}

  @Public()
  @Get('site-content')
  getAllPublic() {
    return this.siteContentService.getAllPublicContent();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SITE_CONTENT_PREVIEW)
  @Get('site-content/preview')
  getPreview() {
    return this.siteContentService.getPreviewContent();
  }

  @Public()
  @Get('site-content/:key')
  getPublic(@Param('key') key: string) {
    return this.siteContentService.getPublishedContent(key);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SITE_CONTENT_EDIT)
  @Get('admin/site-content')
  listEditable() {
    return this.siteContentService.listEditableFiles();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermissions(
    PERMISSIONS.SITE_CONTENT_EDIT,
    PERMISSIONS.SITE_CONTENT_PREVIEW,
    PERMISSIONS.SITE_CONTENT_PUBLISH,
  )
  @Get('admin/site-content/draft')
  getDraft() {
    return this.siteContentService.getActiveDraftSummary();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SITE_CONTENT_PUBLISH)
  @Post('admin/site-content/draft/publish')
  publishDraft(
    @Body() body: PublishDraftBody,
    @Req() req: { user: { id: string; name: string } },
  ) {
    return this.siteContentService.publishDraft(
      { id: req.user.id, name: req.user.name },
      body.publishNote,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermissions(
    PERMISSIONS.SITE_CONTENT_EDIT,
    PERMISSIONS.SITE_CONTENT_PUBLISH,
  )
  @Post('admin/site-content/draft/discard')
  discardDraft(@Req() req: { user: { id: string; name: string } }) {
    return this.siteContentService.discardDraft({
      id: req.user.id,
      name: req.user.name,
    });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermissions(
    PERMISSIONS.SITE_CONTENT_EDIT,
    PERMISSIONS.SITE_CONTENT_PUBLISH,
    PERMISSIONS.SITE_CONTENT_FEEDBACK,
  )
  @Get('admin/site-content/draft/feedback')
  listFeedback() {
    return this.siteContentService.listFeedback();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SITE_CONTENT_FEEDBACK)
  @Post('admin/site-content/draft/feedback')
  addFeedback(
    @Body() body: DraftFeedbackBody,
    @Req() req: { user: { id: string; name: string } },
  ) {
    return this.siteContentService.addFeedback(
      body.contentKey ?? null,
      body.message,
      { id: req.user.id, name: req.user.name },
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermissions(
    PERMISSIONS.SITE_CONTENT_EDIT,
    PERMISSIONS.SITE_CONTENT_PREVIEW,
  )
  @Get('admin/site-content/seo/summary')
  async getSeoSummary() {
    const keys = this.seoAnalyzerService.pageKeysForSummary();
    const entries = await Promise.all(
      keys.map(async (key) => {
        const { content } = await this.siteContentService.getAdminContent(key);
        return { key, content: content as Record<string, unknown> };
      }),
    );
    return this.seoAnalyzerService.buildSummary(entries);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermissions(
    PERMISSIONS.SITE_CONTENT_EDIT,
    PERMISSIONS.SITE_CONTENT_PREVIEW,
  )
  @Get('admin/site-content/:key/seo')
  async getSeoForKey(@Param('key') key: string) {
    const { content } = await this.siteContentService.getAdminContent(key);
    return this.seoAnalyzerService.analyze(key, content as Record<string, unknown>);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SITE_CONTENT_EDIT)
  @Get('admin/site-content/:key')
  getEditable(@Param('key') key: string) {
    return this.siteContentService.getAdminContent(key);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SITE_CONTENT_EDIT)
  @Put('admin/site-content/:key')
  save(
    @Param('key') key: string,
    @Body() body: SaveSiteContentBody,
    @Req() req: { user: { id: string; name: string } },
  ) {
    return this.siteContentService.saveDraftEntry(
      key,
      body.content,
      { id: req.user.id, name: req.user.name },
      body.changeNote,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SITE_CONTENT_EDIT)
  @Get('admin/site-content/:key/versions')
  listVersions(@Param('key') key: string) {
    return this.siteContentService.getVersionHistory(key);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SITE_CONTENT_EDIT)
  @Get('admin/site-content/:key/versions/:versionId')
  getVersion(
    @Param('key') key: string,
    @Param('versionId') versionId: string,
  ) {
    return this.siteContentService.getVersion(key, versionId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SITE_CONTENT_EDIT)
  @Post('admin/site-content/:key/versions/:versionId/restore')
  restore(
    @Param('key') key: string,
    @Param('versionId') versionId: string,
    @Req() req: { user: { id: string; name: string } },
  ) {
    return this.siteContentService.restoreVersion(
      key,
      versionId,
      { id: req.user.id, name: req.user.name },
    );
  }
}
