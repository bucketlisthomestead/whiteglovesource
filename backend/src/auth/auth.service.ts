import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { LoginDto, RegisterUserDto } from '../common/auth.dto';
import { RolesService } from '../roles/roles.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly rolesService: RolesService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  async register(dto: RegisterUserDto) {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepo.save(
      this.userRepo.create({
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        role: dto.role,
        designerId: dto.designerId ?? null,
        clientId: dto.clientId ?? null,
      }),
    );

    return this.buildAuthResponse(user);
  }

  async validateUser(id: string) {
    const user = await this.userRepo.findOne({ where: { id, isActive: true } });
    if (!user) throw new UnauthorizedException();
    return this.attachPermissions(user);
  }

  attachPermissions(user: User) {
    const permissions = this.rolesService.resolvePermissions(user.role);
    return Object.assign(user, { permissions });
  }

  async findAll() {
    return this.userRepo.find({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        designerId: true,
        clientId: true,
        isActive: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  private buildAuthResponse(user: User) {
    const permissions = this.rolesService.resolvePermissions(user.role);
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        designerId: user.designerId,
        clientId: user.clientId,
        permissions,
      },
    };
  }
}
