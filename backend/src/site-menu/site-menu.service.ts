import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, mkdirSync } from 'fs';
import { Repository } from 'typeorm';
import { SiteMenuVersion } from '../entities/site-menu-version.entity';
import { ContentFileStorageService } from '../storage/content-file.storage';
import { DEFAULT_SITE_MENU } from './site-menu.defaults';
import type { SiteMenuConfig, SiteMenuNavItem } from './site-menu.types';

type SaveActor = {
  id: string;
  name: string;
};

@Injectable()
export class SiteMenuService implements OnModuleInit {
  constructor(
    @InjectRepository(SiteMenuVersion)
    private readonly versionRepo: Repository<SiteMenuVersion>,
    private readonly contentStorage: ContentFileStorageService,
  ) {}

  async onModuleInit() {
    if (this.contentStorage.driver === 'local') {
      const root = this.contentStorage.localContentRoot();
      if (!existsSync(root)) mkdirSync(root, { recursive: true });
    }
    await this.bootstrapMenuFile();
    await this.stripLegacyNavFromSiteContent();
  }

  async getPublishedMenu(): Promise<SiteMenuConfig> {
    return this.readMenuFile();
  }

  async getAdminMenu() {
    const menu = await this.readMenuFile();
    return { menu, publishedMenu: menu, hasChanges: false };
  }

  async saveMenu(
    menu: SiteMenuConfig,
    actor: SaveActor,
    changeNote?: string,
  ) {
    const normalized = this.normalizeMenu(menu);
    const serialized = this.serializeMenu(normalized);
    const current = await this.readMenuFile();

    if (JSON.stringify(current) === JSON.stringify(normalized)) {
      throw new BadRequestException('No changes from the current menu');
    }

    await this.contentStorage.writeUtf8(
      this.contentStorage.siteMenuKey(),
      serialized,
    );

    const version = this.versionRepo.create({
      content: serialized,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeNote: changeNote?.trim() || 'Updated site menu',
      isRestore: false,
      restoredFromVersionId: null,
    });
    await this.versionRepo.save(version);

    return {
      menu: normalized,
      versionId: version.id,
      savedAt: version.createdAt.toISOString(),
    };
  }

  async getVersionHistory() {
    return this.versionRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getVersion(versionId: string) {
    const version = await this.versionRepo.findOne({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Version not found');
    return {
      ...version,
      parsedContent: JSON.parse(version.content) as SiteMenuConfig,
    };
  }

  async restoreVersion(versionId: string, actor: SaveActor) {
    const source = await this.versionRepo.findOne({ where: { id: versionId } });
    if (!source) throw new NotFoundException('Version not found');

    const restored = this.normalizeMenu(
      JSON.parse(source.content) as SiteMenuConfig,
    );
    const serialized = this.serializeMenu(restored);
    await this.contentStorage.writeUtf8(
      this.contentStorage.siteMenuKey(),
      serialized,
    );

    const version = this.versionRepo.create({
      content: serialized,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeNote: `Restored from version ${versionId}`,
      isRestore: true,
      restoredFromVersionId: source.id,
    });
    await this.versionRepo.save(version);

    return {
      menu: restored,
      restoredFromVersionId: source.id,
      versionId: version.id,
    };
  }

  private async bootstrapMenuFile() {
    const menuKey = this.contentStorage.siteMenuKey();
    if (await this.contentStorage.exists(menuKey)) return;

    const legacyHeader = (await this.readLegacySiteContentFile('header.json')) as
      | { navLinks?: SiteMenuNavItem[] }
      | null;
    const legacyFooter = (await this.readLegacySiteContentFile('footer.json')) as
      | { quickLinks?: SiteMenuNavItem[] }
      | null;

    const menu: SiteMenuConfig = {
      headerNav: legacyHeader?.navLinks?.length
        ? this.inferHeaderVisibility(legacyHeader.navLinks)
        : [...DEFAULT_SITE_MENU.headerNav],
      footerNav: legacyFooter?.quickLinks?.length
        ? legacyFooter.quickLinks.map(({ to, label }) => ({ to, label }))
        : [...DEFAULT_SITE_MENU.footerNav],
      mobileNav: [...DEFAULT_SITE_MENU.mobileNav],
    };

    await this.contentStorage.writeUtf8(menuKey, this.serializeMenu(menu));
  }

  private async stripLegacyNavFromSiteContent() {
    for (const [filename, keysToRemove] of [
      ['header.json', ['navLinks']],
      ['footer.json', ['quickLinks']],
    ] as const) {
      const storageKey = this.contentStorage.siteContentKey(filename);
      const raw = await this.contentStorage.readUtf8(storageKey);
      if (raw === null) continue;

      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        let changed = false;
        for (const key of keysToRemove) {
          if (key in parsed) {
            delete parsed[key];
            changed = true;
          }
        }
        if (changed) {
          await this.contentStorage.writeUtf8(
            storageKey,
            `${JSON.stringify(parsed, null, 2)}\n`,
          );
        }
      } catch {
        // Leave invalid files untouched; site-content service will surface errors.
      }
    }
  }

  private inferHeaderVisibility(
    links: SiteMenuNavItem[],
  ): SiteMenuNavItem[] {
    return links.map((link) => {
      if (link.to === '/demo') {
        return { ...link, visibleWhen: 'loggedIn' as const };
      }
      if (link.to === '/projects') {
        return { ...link, visibleWhen: 'loggedOut' as const };
      }
      return { ...link, visibleWhen: link.visibleWhen ?? 'always' };
    });
  }

  private async readLegacySiteContentFile(filename: string): Promise<unknown | null> {
    const raw = await this.contentStorage.readUtf8(
      this.contentStorage.siteContentKey(filename),
    );
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private async readMenuFile(): Promise<SiteMenuConfig> {
    const raw = await this.contentStorage.readUtf8(
      this.contentStorage.siteMenuKey(),
    );
    if (raw === null) {
      return { ...DEFAULT_SITE_MENU };
    }
    try {
      return this.normalizeMenu(JSON.parse(raw) as SiteMenuConfig);
    } catch {
      throw new BadRequestException('Site menu file is invalid JSON');
    }
  }

  private normalizeMenu(menu: SiteMenuConfig): SiteMenuConfig {
    if (!menu || typeof menu !== 'object') {
      throw new BadRequestException('Menu must be a JSON object');
    }

    const headerNav = this.normalizeNavItems(menu.headerNav, 'headerNav');
    const footerNav = this.normalizeNavItems(menu.footerNav, 'footerNav', false);
    const mobileNav = this.normalizeMobileNavItems(menu.mobileNav);

    return { headerNav, footerNav, mobileNav };
  }

  private normalizeNavItems(
    items: unknown,
    field: string,
    allowVisibility = true,
  ): SiteMenuNavItem[] {
    if (!Array.isArray(items)) {
      throw new BadRequestException(`${field} must be an array`);
    }

    return items.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new BadRequestException(`${field}[${index}] must be an object`);
      }
      const record = item as Record<string, unknown>;
      const to = this.normalizePath(record.to, `${field}[${index}].to`);
      const label = this.normalizeLabel(record.label, `${field}[${index}].label`);
      const visibleWhen = allowVisibility
        ? this.normalizeVisibility(record.visibleWhen, `${field}[${index}].visibleWhen`)
        : undefined;

      return visibleWhen ? { to, label, visibleWhen } : { to, label };
    });
  }

  private normalizeMobileNavItems(items: unknown) {
    if (!Array.isArray(items)) {
      throw new BadRequestException('mobileNav must be an array');
    }

    return items.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new BadRequestException(`mobileNav[${index}] must be an object`);
      }
      const record = item as Record<string, unknown>;
      const to = this.normalizePath(record.to, `mobileNav[${index}].to`);
      const label = this.normalizeLabel(record.label, `mobileNav[${index}].label`);
      const icon =
        typeof record.icon === 'string' && record.icon.trim()
          ? record.icon.trim()
          : undefined;
      const visibleWhen = this.normalizeVisibility(
        record.visibleWhen,
        `mobileNav[${index}].visibleWhen`,
      );

      return icon ? { to, label, icon, visibleWhen } : { to, label, visibleWhen };
    });
  }

  private normalizePath(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
    const trimmed = value.trim();
    if (!trimmed.startsWith('/')) {
      throw new BadRequestException(`${field} must start with /`);
    }
    return trimmed;
  }

  private normalizeLabel(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private normalizeVisibility(
    value: unknown,
    field: string,
  ): 'always' | 'loggedIn' | 'loggedOut' {
    if (value === undefined || value === null || value === 'always') return 'always';
    if (value === 'loggedIn' || value === 'loggedOut') return value;
    throw new BadRequestException(
      `${field} must be "always", "loggedIn", or "loggedOut"`,
    );
  }

  private serializeMenu(menu: SiteMenuConfig): string {
    return `${JSON.stringify(menu, null, 2)}\n`;
  }
}
