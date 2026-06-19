import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteMenuVersion } from '../entities/site-menu-version.entity';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RolesModule } from '../roles/roles.module';
import { SiteMenuController } from './site-menu.controller';
import { SiteMenuService } from './site-menu.service';

@Module({
  imports: [TypeOrmModule.forFeature([SiteMenuVersion]), RolesModule],
  controllers: [SiteMenuController],
  providers: [SiteMenuService, PermissionsGuard],
  exports: [SiteMenuService],
})
export class SiteMenuModule {}
