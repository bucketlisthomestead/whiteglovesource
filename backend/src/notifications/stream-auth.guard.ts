import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class StreamAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const queryToken =
      typeof req.query?.token === 'string' ? req.query.token : null;
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const token = queryToken || bearer;

    if (!token) throw new UnauthorizedException('Missing stream token');

    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      const user = await this.authService.validateUser(payload.sub);
      if (!user) throw new UnauthorizedException();
      req.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid stream token');
    }
  }
}
