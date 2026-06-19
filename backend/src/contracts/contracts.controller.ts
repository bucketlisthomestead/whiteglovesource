import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators';
import { UserRole } from '../common/roles';
import { User } from '../entities/user.entity';
import { ProjectsService } from '../projects/projects.service';
import { ContractsService } from './contracts.service';
import { CaptureContractSignatureDto, GenerateContractAmendmentDto } from '../common/contract.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.CLIENT)
  @Get(':id/contract')
  getContract(@Param('id') id: string, @Req() req: { user: User }) {
    return this.contractsService.getForProject(id, req.user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESIGNER)
  @Post(':id/contract/generate')
  generate(@Param('id') id: string, @Req() req: { user: User }) {
    return this.contractsService.generateProposal(id, req.user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.CLIENT)
  @Get(':id/contract/amendments')
  listAmendments(@Param('id') id: string, @Req() req: { user: User }) {
    return this.contractsService.listAmendments(id, req.user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESIGNER)
  @Post(':id/contract/amendments')
  generateAmendment(
    @Param('id') id: string,
    @Body() dto: GenerateContractAmendmentDto,
    @Req() req: { user: User },
  ) {
    return this.contractsService.generateAmendment(id, dto.quoteId, req.user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.CLIENT)
  @Get(':id/contract/amendments/:amendmentId/download')
  async downloadAmendment(
    @Param('id') id: string,
    @Param('amendmentId') amendmentId: string,
    @Req() req: { user: User },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.contractsService.readAmendmentFile(
      id,
      amendmentId,
      req.user,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }

  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.CLIENT)
  @Get(':id/contract/proposal')
  async downloadProposal(
    @Param('id') id: string,
    @Req() req: { user: User },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.contractsService.readProposalFile(
      id,
      req.user,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }

  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.CLIENT)
  @Get(':id/contract/signed')
  async downloadSigned(
    @Param('id') id: string,
    @Req() req: { user: User },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename, mimeType } =
      await this.contractsService.readSignedFile(id, req.user);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }

  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.CLIENT)
  @Post(':id/contract/upload-signed')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  uploadSigned(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: User },
  ) {
    return this.contractsService.uploadSignedAgreement(id, file, req.user);
  }

  @Roles(UserRole.ADMIN, UserRole.DESIGNER, UserRole.CLIENT)
  @Post(':id/contract/signatures')
  captureSignature(
    @Param('id') id: string,
    @Body() dto: CaptureContractSignatureDto,
    @Req() req: { user: User },
  ) {
    return this.contractsService.captureSignature(id, dto, req.user);
  }
}
