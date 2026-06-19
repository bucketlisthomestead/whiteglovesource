import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, mkdirSync } from 'fs';
import { Repository } from 'typeorm';
import {
  SiteContentDraft,
  SiteContentDraftStatus,
} from '../entities/site-content-draft.entity';
import { SiteContentDraftEntry } from '../entities/site-content-draft-entry.entity';
import { SiteContentFeedback } from '../entities/site-content-feedback.entity';
import { SiteContentVersion } from '../entities/site-content-version.entity';
import { ContentFileStorageService } from '../storage/content-file.storage';
import { DEFAULT_SITE_CONTENT } from './site-content.defaults';
import { SITE_CONTENT_FILES } from './site-content.registry';

type SaveActor = {
  id: string;
  name: string;
};

export type SiteContentDraftSummary = {
  id: string;
  status: SiteContentDraftStatus;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  changedKeys: string[];
  entryCount: number;
  feedbackCount: number;
};

@Injectable()
export class SiteContentService implements OnModuleInit {
  constructor(
    @InjectRepository(SiteContentVersion)
    private readonly versionRepo: Repository<SiteContentVersion>,
    @InjectRepository(SiteContentDraft)
    private readonly draftRepo: Repository<SiteContentDraft>,
    @InjectRepository(SiteContentDraftEntry)
    private readonly draftEntryRepo: Repository<SiteContentDraftEntry>,
    @InjectRepository(SiteContentFeedback)
    private readonly feedbackRepo: Repository<SiteContentFeedback>,
    private readonly contentStorage: ContentFileStorageService,
  ) {}

  async onModuleInit() {
    await this.seedMissingFiles();
  }

  listEditableFiles() {
    return Object.values(SITE_CONTENT_FILES).map((meta) => ({
      ...meta,
      filename: `${meta.key}.json`,
    }));
  }

  async getAllPublicContent(): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const meta of Object.values(SITE_CONTENT_FILES)) {
      result[meta.key] = await this.readPublishedContent(meta.key);
    }
    return result;
  }

  async getPreviewContent(): Promise<Record<string, unknown>> {
    const published = await this.getAllPublicContent();
    const draft = await this.getActiveDraft();
    if (!draft?.entries?.length) return published;

    const result = { ...published };
    for (const entry of draft.entries) {
      result[entry.contentKey] = JSON.parse(entry.content);
    }
    return result;
  }

  async getPublishedContent(key: string): Promise<unknown> {
    this.assertValidKey(key);
    return this.readPublishedContent(key);
  }

  async getAdminContent(key: string) {
    this.assertValidKey(key);
    const published = await this.readPublishedContent(key);
    const draftEntry = await this.getActiveDraftEntry(key);
    const draftContent = draftEntry
      ? JSON.parse(draftEntry.content)
      : published;
    return {
      key,
      content: draftContent,
      publishedContent: published,
      hasDraftChanges: this.contentDiffers(published, draftContent),
    };
  }

  async getActiveDraftSummary(): Promise<SiteContentDraftSummary | null> {
    const draft = await this.getActiveDraft();
    if (!draft) return null;

    const feedbackCount = await this.feedbackRepo.count({
      where: { draftId: draft.id },
    });

    const changedKeys: string[] = [];
    for (const entry of draft.entries ?? []) {
      const published = await this.readPublishedContent(entry.contentKey);
      const draftContent = JSON.parse(entry.content);
      if (this.contentDiffers(published, draftContent)) {
        changedKeys.push(entry.contentKey);
      }
    }

    return {
      id: draft.id,
      status: draft.status,
      createdByUserId: draft.createdByUserId,
      createdByName: draft.createdByName,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
      changedKeys,
      entryCount: draft.entries?.length ?? 0,
      feedbackCount,
    };
  }

  async saveDraftEntry(
    key: string,
    content: unknown,
    actor: SaveActor,
    changeNote?: string,
  ) {
    this.assertValidKey(key);
    const serialized = this.serializeContent(content);
    const draft = await this.getOrCreateActiveDraft(actor);
    const existing = await this.draftEntryRepo.findOne({
      where: { draftId: draft.id, contentKey: key },
    });

    if (existing) {
      existing.content = serialized;
      await this.draftEntryRepo.save(existing);
    } else {
      await this.draftEntryRepo.save(
        this.draftEntryRepo.create({
          draftId: draft.id,
          contentKey: key,
          content: serialized,
        }),
      );
    }

    await this.draftRepo.update(draft.id, { updatedAt: new Date() });

    return {
      draftId: draft.id,
      contentKey: key,
      changeNote: changeNote?.trim() || null,
    };
  }

  async addFeedback(
    contentKey: string | null,
    message: string,
    actor: SaveActor,
  ) {
    const draft = await this.getActiveDraft();
    if (!draft) {
      throw new BadRequestException('No active draft to comment on');
    }
    if (contentKey) this.assertValidKey(contentKey);

    const trimmed = message.trim();
    if (!trimmed) {
      throw new BadRequestException('Feedback message is required');
    }

    const feedback = this.feedbackRepo.create({
      draftId: draft.id,
      contentKey,
      authorUserId: actor.id,
      authorName: actor.name,
      message: trimmed,
    });
    const saved = await this.feedbackRepo.save(feedback);
    return {
      id: saved.id,
      draftId: saved.draftId,
      contentKey: saved.contentKey,
      authorUserId: saved.authorUserId,
      authorName: saved.authorName,
      message: saved.message,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  async listFeedback() {
    const draft = await this.getActiveDraft();
    if (!draft) return [];

    const items = await this.feedbackRepo.find({
      where: { draftId: draft.id },
      order: { createdAt: 'DESC' },
    });

    return items.map((item) => ({
      id: item.id,
      draftId: item.draftId,
      contentKey: item.contentKey,
      authorUserId: item.authorUserId,
      authorName: item.authorName,
      message: item.message,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  async publishDraft(actor: SaveActor, publishNote?: string) {
    const draft = await this.getActiveDraft();
    if (!draft?.entries?.length) {
      throw new BadRequestException('No pending draft changes to publish');
    }

    const changedKeys: string[] = [];
    for (const entry of draft.entries) {
      const published = await this.readPublishedContent(entry.contentKey);
      const draftContent = JSON.parse(entry.content);
      if (!this.contentDiffers(published, draftContent)) continue;

      const storageKey = this.contentStorage.siteContentKey(`${entry.contentKey}.json`);
      await this.contentStorage.writeUtf8(storageKey, entry.content);
      changedKeys.push(entry.contentKey);

      const version = this.versionRepo.create({
        contentKey: entry.contentKey,
        content: entry.content,
        changedByUserId: actor.id,
        changedByName: actor.name,
        changeNote: publishNote?.trim() || 'Published draft',
        isRestore: false,
        restoredFromVersionId: null,
        isPublish: true,
        draftId: draft.id,
      });
      await this.versionRepo.save(version);
    }

    if (changedKeys.length === 0) {
      throw new BadRequestException('Draft has no changes from published content');
    }

    draft.status = SiteContentDraftStatus.PUBLISHED;
    draft.publishedAt = new Date();
    draft.publishedByUserId = actor.id;
    draft.publishedByName = actor.name;
    await this.draftRepo.save(draft);

    return {
      draftId: draft.id,
      publishedKeys: changedKeys,
      publishedAt: draft.publishedAt.toISOString(),
    };
  }

  async discardDraft(actor: SaveActor) {
    const draft = await this.getActiveDraft();
    if (!draft) {
      throw new BadRequestException('No active draft to discard');
    }

    draft.status = SiteContentDraftStatus.DISCARDED;
    await this.draftRepo.save(draft);

    return {
      draftId: draft.id,
      discardedByUserId: actor.id,
    };
  }

  async getVersionHistory(key: string) {
    this.assertValidKey(key);
    return this.versionRepo.find({
      where: { contentKey: key },
      order: { createdAt: 'DESC' },
    });
  }

  async getVersion(key: string, versionId: string) {
    this.assertValidKey(key);
    const version = await this.versionRepo.findOne({
      where: { id: versionId, contentKey: key },
    });
    if (!version) throw new NotFoundException('Version not found');
    return {
      ...version,
      parsedContent: JSON.parse(version.content),
    };
  }

  async restoreVersion(key: string, versionId: string, actor: SaveActor) {
    this.assertValidKey(key);
    const source = await this.versionRepo.findOne({
      where: { id: versionId, contentKey: key },
    });
    if (!source) throw new NotFoundException('Version not found');

    await this.saveDraftEntry(
      key,
      JSON.parse(source.content),
      actor,
      `Restored from version ${versionId}`,
    );

    return {
      draftRestored: true,
      contentKey: key,
      restoredFromVersionId: source.id,
    };
  }

  private async getOrCreateActiveDraft(actor: SaveActor) {
    const existing = await this.getActiveDraft();
    if (existing) return existing;

    return this.draftRepo.save(
      this.draftRepo.create({
        status: SiteContentDraftStatus.ACTIVE,
        createdByUserId: actor.id,
        createdByName: actor.name,
      }),
    );
  }

  private async getActiveDraft() {
    return this.draftRepo.findOne({
      where: { status: SiteContentDraftStatus.ACTIVE },
      relations: { entries: true },
      order: { createdAt: 'DESC' },
    });
  }

  private async getActiveDraftEntry(key: string) {
    const draft = await this.getActiveDraft();
    if (!draft) return null;
    return this.draftEntryRepo.findOne({
      where: { draftId: draft.id, contentKey: key },
    });
  }

  private contentDiffers(a: unknown, b: unknown) {
    return JSON.stringify(a) !== JSON.stringify(b);
  }

  private async seedMissingFiles() {
    if (this.contentStorage.driver === 'local') {
      const dir = this.contentStorage.localSiteContentDir();
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }

    for (const meta of Object.values(SITE_CONTENT_FILES)) {
      const storageKey = this.contentStorage.siteContentKey(`${meta.key}.json`);
      const exists = await this.contentStorage.exists(storageKey);
      if (!exists) {
        const defaults = DEFAULT_SITE_CONTENT[meta.key];
        await this.contentStorage.writeUtf8(
          storageKey,
          `${JSON.stringify(defaults, null, 2)}\n`,
        );
      }
    }
  }

  private async readPublishedContent(key: string): Promise<unknown> {
    const storageKey = this.contentStorage.siteContentKey(`${key}.json`);
    const raw = await this.contentStorage.readUtf8(storageKey);
    if (raw === null) {
      return DEFAULT_SITE_CONTENT[key] ?? {};
    }
    try {
      return JSON.parse(raw);
    } catch {
      throw new BadRequestException(`Content file for "${key}" is invalid JSON`);
    }
  }

  private assertValidKey(key: string) {
    if (!/^[a-z0-9-]+$/.test(key)) {
      throw new BadRequestException('Invalid content key');
    }
    const filename = `${key}.json`;
    if (!SITE_CONTENT_FILES[filename]) {
      throw new NotFoundException(`Unknown content key: ${key}`);
    }
  }

  private serializeContent(content: unknown): string {
    if (content === null || typeof content !== 'object' || Array.isArray(content)) {
      throw new BadRequestException('Content must be a JSON object');
    }
    try {
      return `${JSON.stringify(content, null, 2)}\n`;
    } catch {
      throw new BadRequestException('Content is not serializable as JSON');
    }
  }
}
