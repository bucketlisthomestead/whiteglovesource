import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SignoffsService } from './signoffs.service';
import { CreateSignoffDto } from '../common/signoff.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../entities/user.entity';
import { Public } from '../common/decorators';

@Controller('signoffs')
export class SignoffsController {
  constructor(private readonly signoffsService: SignoffsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateSignoffDto, @Req() req: { user: User }) {
    return this.signoffsService.create(dto, req.user);
  }

  @Public()
  @Get('project/:projectId')
  findByProject(@Param('projectId') projectId: string) {
    return this.signoffsService.findByProject(projectId);
  }

  @Public()
  @Get('piece/:pieceId')
  findByPiece(@Param('pieceId') pieceId: string) {
    return this.signoffsService.findByPiece(pieceId);
  }
}
