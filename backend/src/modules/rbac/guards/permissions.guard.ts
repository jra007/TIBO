import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { Permission } from '../permissions';
import { RbacService } from '../rbac.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // getAll (not getAllAndOverride): a class-level permission (e.g. settings:access gating the
    // whole admin/settings surface) and a handler-level one (e.g. settings:rbac:edit on a specific
    // route) are both required, not just the more specific one — a class-level gate must not be
    // bypassable by a handler-level override.
    const requiredPermissions = this.reflector
      .getAll<(Permission | undefined)[]>(PERMISSION_KEY, [context.getHandler(), context.getClass()])
      .filter((permission): permission is Permission => Boolean(permission));
    if (requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id;
    if (!userId) throw new ForbiddenException();

    const granted = await this.rbacService.getPermissionsForUser(userId);
    const missing = requiredPermissions.filter((permission) => !granted.includes(permission));
    if (missing.length > 0) throw new ForbiddenException(`Missing permission(s): ${missing.join(', ')}`);
    return true;
  }
}
