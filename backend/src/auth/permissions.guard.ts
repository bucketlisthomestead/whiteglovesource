import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_ANY_KEY,
  PERMISSIONS_KEY,
} from '../common/permissions.decorator';
import type { Permission } from '../common/permissions';
import { UserRole } from '../common/roles';
import { User } from '../entities/user.entity';
import { RolesService } from '../roles/roles.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesService: RolesService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAll = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredAny = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_ANY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredAll?.length && !requiredAny?.length) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user: User & { permissions?: Permission[] } }>();
    if (!user) return false;

    const permissions =
      user.permissions ??
      this.rolesService.resolvePermissions(String(user.role));

    if (user.role === UserRole.ADMIN) return true;

    if (requiredAll?.length) {
      const allowed = requiredAll.every((permission) =>
        permissions.includes(permission),
      );
      if (!allowed) throw new ForbiddenException('Insufficient permissions');
    }

    if (requiredAny?.length) {
      const allowed = requiredAny.some((permission) =>
        permissions.includes(permission),
      );
      if (!allowed) throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
