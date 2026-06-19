import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectAuditService } from './project-audit.service';
import { CreatePieceEventDto } from '../common/dto';
import { CreateProjectMessageDto } from '../common/project-message.dto';
import { Public } from '../common/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators';
import { UserRole } from '../common/roles';
import { User } from '../entities/user.entity';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly auditService: ProjectAuditService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Req() req: { user: User }) {
    return this.projectsService.findAll(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  findMy(@Req() req: { user: User }) {
    return this.projectsService.findForUser(req.user);
  }

  @Public()
  @Get('demo')
  findDemo() {
    return this.projectsService.findDemo();
  }

  @Public()
  @Get('pieces/:pieceId')
  findPiece(@Param('pieceId') pieceId: string) {
    return this.projectsService.findPiece(pieceId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DESIGNER)
  @Post('pieces/:pieceId/events')
  addPieceEvent(
    @Param('pieceId') pieceId: string,
    @Body() dto: CreatePieceEventDto,
    @Req() req: { user: User },
  ) {
    return this.projectsService.addPieceEvent(pieceId, dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/activity')
  getActivity(@Param('id') id: string, @Req() req: { user: User }) {
    return this.auditService.getActivity(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/quote')
  getQuote(@Param('id') id: string, @Req() req: { user: User }) {
    return this.auditService.getLinkedQuote(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/messages')
  getMessages(@Param('id') id: string, @Req() req: { user: User }) {
    return this.auditService.getMessages(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/messages')
  postMessage(
    @Param('id') id: string,
    @Body() dto: CreateProjectMessageDto,
    @Req() req: { user: User },
  ) {
    return this.auditService.createMessage(id, req.user, dto);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: { user?: User }) {
    return this.projectsService.findOne(id, req.user);
  }
}
