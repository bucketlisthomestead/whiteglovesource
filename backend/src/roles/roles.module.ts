import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppRole } from '../entities/app-role.entity';
import { User } from '../entities/user.entity';
import { RolesService } from './roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppRole, User])],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
