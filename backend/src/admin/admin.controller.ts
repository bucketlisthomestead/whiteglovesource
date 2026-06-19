import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { User } from '../entities/user.entity';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../common/permissions.decorator';
import { PERMISSIONS } from '../common/permissions';
import { RolesService } from '../roles/roles.service';
import { CreateAppRoleDto, UpdateAppRoleDto } from '../roles/roles.dto';
import {
  AdminUpdateQuoteDto,
  CreateProjectDto,
  CreateProjectFromQuoteDto,
  CreateStorageLocationDto,
  CreateAdminUserDto,
  UpdateAdminUserDto,
  UpdateProjectDto,
  UpdateStorageLocationDto,
} from '../common/admin.dto';
import { CreateQuoteMessageDto } from '../common/quote-message.dto';
import { UpdateAppSettingsDto } from '../settings/settings.dto';
import { QuoteStatus } from '../common/enums';

@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly rolesService: RolesService,
  ) {}

  @Get('dashboard')
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  getDashboard(
    @Query('includeArchived') includeArchived?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.getDashboard({
      includeArchived: includeArchived === 'true',
      from,
      to,
    });
  }

  @Get('quotes')
  @RequirePermissions(PERMISSIONS.QUOTES_VIEW)
  listQuotes(
    @Query('includeArchived') includeArchived?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: QuoteStatus,
  ) {
    return this.adminService.listQuotes({
      includeArchived: includeArchived === 'true',
      from,
      to,
      status,
    });
  }

  @Get('designers')
  @RequireAnyPermissions(
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.QUOTES_MANAGE,
  )
  listDesigners() {
    return this.adminService.listDesigners();
  }

  @Get('clients')
  @RequireAnyPermissions(
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.QUOTES_MANAGE,
  )
  listClients() {
    return this.adminService.listClients();
  }

  @Post('projects')
  @RequirePermissions(PERMISSIONS.PROJECTS_MANAGE)
  createProject(@Body() dto: CreateProjectDto) {
    return this.adminService.createProject(dto);
  }

  @Patch('projects/:id')
  @RequireAnyPermissions(
    PERMISSIONS.PROJECTS_MANAGE,
    PERMISSIONS.PROJECTS_ADVANCE,
  )
  updateProject(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: { user: User },
  ) {
    return this.adminService.updateProject(id, dto, req.user);
  }

  @Get('quotes/:id')
  @RequirePermissions(PERMISSIONS.QUOTES_VIEW)
  getQuote(@Param('id') id: string) {
    return this.adminService.getQuote(id);
  }

  @Post('quotes/:id/create-project')
  @RequirePermissions(PERMISSIONS.QUOTES_MANAGE)
  createProjectFromQuote(
    @Param('id') id: string,
    @Body() dto: CreateProjectFromQuoteDto,
  ) {
    return this.adminService.createProjectFromQuote(id, dto);
  }

  @Patch('quotes/:id')
  @RequirePermissions(PERMISSIONS.QUOTES_MANAGE)
  updateQuote(
    @Param('id') id: string,
    @Body() dto: AdminUpdateQuoteDto,
    @Req() req: { user: User },
  ) {
    return this.adminService.updateQuote(id, dto, false, req.user);
  }

  @Post('quotes/:id/send')
  @RequirePermissions(PERMISSIONS.QUOTES_MANAGE)
  sendQuote(
    @Param('id') id: string,
    @Body() dto: AdminUpdateQuoteDto,
    @Req() req: { user: User },
  ) {
    return this.adminService.updateQuote(id, dto, true, req.user);
  }

  @Get('quotes/:id/activity')
  @RequirePermissions(PERMISSIONS.QUOTES_VIEW)
  getQuoteActivity(@Param('id') id: string) {
    return this.adminService.getQuoteActivity(id);
  }

  @Get('quotes/:id/messages')
  @RequirePermissions(PERMISSIONS.QUOTES_VIEW)
  getQuoteMessages(@Param('id') id: string) {
    return this.adminService.getQuoteMessages(id);
  }

  @Post('quotes/:id/messages')
  @RequirePermissions(PERMISSIONS.QUOTES_MANAGE)
  postQuoteMessage(
    @Param('id') id: string,
    @Body() dto: CreateQuoteMessageDto,
    @Req() req: { user: User },
  ) {
    return this.adminService.createQuoteMessage(id, req.user, dto);
  }

  @Patch('messages/:id/read')
  @RequireAnyPermissions(PERMISSIONS.QUOTES_VIEW, PERMISSIONS.QUOTES_MANAGE)
  markRead(@Param('id') id: string) {
    return this.adminService.markMessageRead(id);
  }

  @Get('settings')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  getSettings() {
    return this.adminService.getSettings();
  }

  @Patch('settings')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  updateSettings(@Body() dto: UpdateAppSettingsDto) {
    return this.adminService.updateSettings(dto);
  }

  @Get('roles/assignable')
  @RequireAnyPermissions(PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE)
  listAssignableRoles() {
    return this.rolesService.listAssignableRoles();
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  listPermissions() {
    return this.rolesService.getPermissionCatalog();
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  listRoles() {
    return this.rolesService.listRoles();
  }

  @Post('roles')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  createRole(@Body() dto: CreateAppRoleDto) {
    return this.rolesService.createRole(dto);
  }

  @Patch('roles/:id')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  updateRole(@Param('id') id: string, @Body() dto: UpdateAppRoleDto) {
    return this.rolesService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  deleteRole(@Param('id') id: string) {
    return this.rolesService.deleteRole(id);
  }

  @Get('storage-locations')
  @RequireAnyPermissions(
    PERMISSIONS.WAREHOUSES_MANAGE,
    PERMISSIONS.QUOTES_MANAGE,
    PERMISSIONS.PROJECTS_MANAGE,
  )
  listStorageLocations() {
    return this.adminService.listStorageLocations();
  }

  @Post('storage-locations')
  @RequirePermissions(PERMISSIONS.WAREHOUSES_MANAGE)
  createStorageLocation(@Body() dto: CreateStorageLocationDto) {
    return this.adminService.createStorageLocation(dto);
  }

  @Patch('storage-locations/:id')
  @RequirePermissions(PERMISSIONS.WAREHOUSES_MANAGE)
  updateStorageLocation(
    @Param('id') id: string,
    @Body() dto: UpdateStorageLocationDto,
  ) {
    return this.adminService.updateStorageLocation(id, dto);
  }

  @Delete('storage-locations/:id')
  @RequirePermissions(PERMISSIONS.WAREHOUSES_MANAGE)
  deleteStorageLocation(@Param('id') id: string) {
    return this.adminService.deleteStorageLocation(id);
  }

  @Get('users')
  @RequirePermissions(PERMISSIONS.USERS_VIEW)
  listUsers() {
    return this.adminService.listUsers();
  }

  @Get('users/:id/work')
  @RequirePermissions(PERMISSIONS.USERS_VIEW)
  getUserWork(@Param('id') id: string) {
    return this.adminService.getUserWork(id);
  }

  @Post('users')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  createUser(@Body() dto: CreateAdminUserDto) {
    return this.adminService.createAdminUser(dto);
  }

  @Patch('users/:id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
    @Req() req: { user: User },
  ) {
    return this.adminService.updateAdminUser(id, dto, req.user.id);
  }

}
