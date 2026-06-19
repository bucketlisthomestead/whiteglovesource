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
import { RequirePermissions } from '../common/permissions.decorator';
import type { SiteMenuConfig } from './site-menu.types';
import { SiteMenuService } from './site-menu.service';

type SaveSiteMenuBody = {
  menu: SiteMenuConfig;
  changeNote?: string;
};

@Controller()
export class SiteMenuController {
  constructor(private readonly siteMenuService: SiteMenuService) {}

  @Public()
  @Get('site-menu')
  getPublicMenu() {
    return this.siteMenuService.getPublishedMenu();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SITE_MENU_EDIT)
  @Get('admin/site-menu')
  getAdminMenu() {
    return this.siteMenuService.getAdminMenu();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SITE_MENU_EDIT)
  @Put('admin/site-menu')
  saveMenu(
    @Body() body: SaveSiteMenuBody,
    @Req() req: { user: { id: string; name: string } },
  ) {
    return this.siteMenuService.saveMenu(
      body.menu,
      { id: req.user.id, name: req.user.name },
      body.changeNote,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SITE_MENU_EDIT)
  @Get('admin/site-menu/versions')
  listVersions() {
    return this.siteMenuService.getVersionHistory();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SITE_MENU_EDIT)
  @Get('admin/site-menu/versions/:versionId')
  getVersion(@Param('versionId') versionId: string) {
    return this.siteMenuService.getVersion(versionId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SITE_MENU_EDIT)
  @Post('admin/site-menu/versions/:versionId/restore')
  restoreVersion(
    @Param('versionId') versionId: string,
    @Req() req: { user: { id: string; name: string } },
  ) {
    return this.siteMenuService.restoreVersion(versionId, {
      id: req.user.id,
      name: req.user.name,
    });
  }
}
