import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncRecord } from '../entities/sync-record.entity';
import { ProjectsService } from '../projects/projects.service';
import { SyncMutationDto } from '../common/auth.dto';
import { User } from '../entities/user.entity';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(SyncRecord)
    private readonly syncRepo: Repository<SyncRecord>,
    private readonly projectsService: ProjectsService,
    private readonly storage: StorageService,
  ) {}

  async processBatch(user: User, mutations: SyncMutationDto[]) {
    const results: {
      clientMutationId: string;
      success: boolean;
      error?: string;
    }[] = [];

    for (const mutation of mutations) {
      const existing = await this.syncRepo.findOne({
        where: { clientMutationId: mutation.clientMutationId },
      });
      if (existing) {
        results.push({
          clientMutationId: mutation.clientMutationId,
          success: true,
        });
        continue;
      }

      try {
        await this.processMutation(user, mutation);
        await this.syncRepo.save(
          this.syncRepo.create({
            clientMutationId: mutation.clientMutationId,
            userId: user.id,
            mutationType: mutation.type,
          }),
        );
        results.push({
          clientMutationId: mutation.clientMutationId,
          success: true,
        });
      } catch (err) {
        results.push({
          clientMutationId: mutation.clientMutationId,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return { results, syncedAt: new Date().toISOString() };
  }

  private async processMutation(user: User, mutation: SyncMutationDto) {
    const payload = mutation.payload || {};

    switch (mutation.type) {
      case 'piece_event': {
        const {
          pieceId,
          stage,
          condition,
          location,
          notes,
          verifiedBy,
          photoUrl,
          photoBase64,
          photoMilestone,
        } = payload as Record<string, string>;
        let finalPhotoUrl = photoUrl;

        if (photoBase64 && !photoUrl) {
          finalPhotoUrl = await this.saveBase64Photo(photoBase64);
        }

        await this.projectsService.addPieceEvent(pieceId, {
          stage,
          condition,
          location,
          notes,
          verifiedBy: verifiedBy || user.name,
          photoUrl: finalPhotoUrl,
          photoMilestone,
        });
        break;
      }
      default:
        throw new Error(`Unknown mutation type: ${mutation.type}`);
    }
  }

  private async saveBase64Photo(base64: string): Promise<string> {
    const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/);
    const ext = matches?.[1] || 'jpg';
    const data = matches?.[2] || base64;
    const stored = await this.storage.savePhoto(
      Buffer.from(data, 'base64'),
      `photo.${ext}`,
    );
    return stored.fileUrl;
  }
}
