import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppRole } from '../entities/app-role.entity';
import { User } from '../entities/user.entity';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  Permission,
  SYSTEM_ROLE_SLUGS,
} from '../common/permissions';
import { CreateAppRoleDto, UpdateAppRoleDto } from './roles.dto';

export type AppRoleDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class RolesService implements OnModuleInit {
  private cache = new Map<string, Permission[]>();

  constructor(
    @InjectRepository(AppRole)
    private readonly roleRepo: Repository<AppRole>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async onModuleInit() {
    await this.seedDefaults();
    await this.refreshCache();
  }

  getPermissionCatalog() {
    return PERMISSION_DEFINITIONS;
  }

  async listAssignableRoles() {
    const roles = await this.roleRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
    return roles.map((role) => ({
      slug: role.slug,
      name: role.name,
      isSystem: role.isSystem,
    }));
  }

  async listRoles(): Promise<AppRoleDto[]> {
    const roles = await this.roleRepo.find({ order: { name: 'ASC' } });
    const counts = await this.userRepo
      .createQueryBuilder('u')
      .select('u.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.role')
      .getRawMany<{ role: string; count: string }>();
    const countMap = new Map(
      counts.map((row) => [row.role, Number(row.count)]),
    );

    return roles.map((role) =>
      this.serialize(role, countMap.get(role.slug) ?? 0),
    );
  }

  async getRoleBySlug(slug: string) {
    const role = await this.roleRepo.findOne({ where: { slug } });
    if (!role || !role.isActive) return null;
    return role;
  }

  resolvePermissions(roleSlug: string): Permission[] {
    if (roleSlug === 'admin') return [...ALL_PERMISSIONS];
    const cached = this.cache.get(roleSlug);
    if (cached) return cached;
    return DEFAULT_ROLE_PERMISSIONS[roleSlug] ?? [];
  }

  async refreshCache() {
    this.cache.clear();
    const roles = await this.roleRepo.find({ where: { isActive: true } });
    for (const role of roles) {
      this.cache.set(role.slug, this.normalizePermissions(role.permissions));
    }
  }

  async assertRoleAssignable(slug: string) {
    const role = await this.roleRepo.findOne({
      where: { slug, isActive: true },
    });
    if (!role) {
      throw new BadRequestException(`Unknown or inactive role: ${slug}`);
    }
    return role;
  }

  async createRole(dto: CreateAppRoleDto): Promise<AppRoleDto> {
    if (
      SYSTEM_ROLE_SLUGS.includes(dto.slug as (typeof SYSTEM_ROLE_SLUGS)[number])
    ) {
      throw new ConflictException('That slug is reserved for a system role');
    }

    const existing = await this.roleRepo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Role slug already exists');

    const saved = await this.roleRepo.save(
      this.roleRepo.create({
        slug: dto.slug,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        permissions: this.normalizePermissions(dto.permissions),
        isSystem: false,
        isActive: true,
      }),
    );
    await this.refreshCache();
    return this.serialize(saved, 0);
  }

  async updateRole(id: string, dto: UpdateAppRoleDto): Promise<AppRoleDto> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    if (dto.name != null) role.name = dto.name.trim();
    if (dto.description !== undefined)
      role.description = dto.description?.trim() || null;
    if (dto.permissions != null) {
      role.permissions = this.normalizePermissions(dto.permissions);
    }
    if (dto.isActive != null) {
      if (role.isSystem && !dto.isActive) {
        throw new BadRequestException('System roles cannot be deactivated');
      }
      role.isActive = dto.isActive;
    }

    const saved = await this.roleRepo.save(role);
    await this.refreshCache();
    const userCount = await this.userRepo.count({
      where: { role: saved.slug },
    });
    return this.serialize(saved, userCount);
  }

  async deleteRole(id: string) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deleted');
    }

    const userCount = await this.userRepo.count({ where: { role: role.slug } });
    if (userCount > 0) {
      throw new BadRequestException('Reassign users before deleting this role');
    }

    await this.roleRepo.remove(role);
    await this.refreshCache();
    return { deleted: true };
  }

  private normalizePermissions(input: Permission[]): Permission[] {
    const valid = new Set(ALL_PERMISSIONS);
    const normalized = [...new Set(input.filter((p) => valid.has(p)))];
    if (normalized.length === 0) {
      throw new BadRequestException(
        'At least one valid permission is required',
      );
    }
    return normalized;
  }

  private serialize(role: AppRole, userCount: number): AppRoleDto {
    return {
      id: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      isSystem: role.isSystem,
      isActive: role.isActive,
      userCount,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }

  private async seedDefaults() {
    for (const [slug, permissions] of Object.entries(
      DEFAULT_ROLE_PERMISSIONS,
    )) {
      const existing = await this.roleRepo.findOne({ where: { slug } });
      if (existing) {
        if (
          slug === 'admin' &&
          existing.permissions.length !== ALL_PERMISSIONS.length
        ) {
          existing.permissions = [...ALL_PERMISSIONS];
          await this.roleRepo.save(existing);
        }
        continue;
      }

      await this.roleRepo.save(
        this.roleRepo.create({
          slug,
          name:
            slug === 'admin'
              ? 'Administrator'
              : slug === 'designer'
                ? 'Designer'
                : slug === 'client'
                  ? 'Client'
                  : slug === 'operations'
                    ? 'Operations Manager'
                    : slug,
          description:
            slug === 'operations'
              ? 'Day-to-day quote and project management without full admin access'
              : null,
          permissions,
          isSystem: SYSTEM_ROLE_SLUGS.includes(
            slug as (typeof SYSTEM_ROLE_SLUGS)[number],
          ),
          isActive: true,
        }),
      );
    }
  }
}
