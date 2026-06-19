import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';

/**
 * Read/write CMS JSON files (content/site/*.json, content/site-menu.json).
 * Backend: STORAGE_BACKEND=s3|local (defaults to local; s3 when STORAGE_BACKEND=s3 or S3_BUCKET set).
 */
@Injectable()
export class ContentFileStorageService {
  private readonly backend: 's3' | 'local';
  private readonly s3Client: S3Client | null;
  private readonly s3Bucket: string | null;
  private readonly localRoot: string;

  constructor(private readonly config: ConfigService) {
    const explicit = this.config.get<string>('STORAGE_BACKEND');
    this.s3Bucket = this.config.get<string>('S3_BUCKET') || null;

    if (explicit === 's3' || (!explicit && this.s3Bucket)) {
      this.backend = 's3';
      this.s3Client = new S3Client({
        region: this.config.get('AWS_REGION', 'us-east-1'),
      });
    } else {
      this.backend = 'local';
      this.s3Client = null;
    }

    this.localRoot = this.resolveLocalRoot();
  }

  get driver(): 's3' | 'local' {
    return this.backend;
  }

  /** Relative key e.g. `content/site/home.json` or `content/site-menu.json` */
  async exists(relativeKey: string): Promise<boolean> {
    if (this.backend === 's3') {
      try {
        await this.s3Client!.send(
          new HeadObjectCommand({
            Bucket: this.s3Bucket!,
            Key: relativeKey,
          }),
        );
        return true;
      } catch {
        return false;
      }
    }
    return existsSync(this.localAbsolutePath(relativeKey));
  }

  async readUtf8(relativeKey: string): Promise<string | null> {
    if (this.backend === 's3') {
      try {
        const response = await this.s3Client!.send(
          new GetObjectCommand({
            Bucket: this.s3Bucket!,
            Key: relativeKey,
          }),
        );
        return (await response.Body?.transformToString('utf8')) ?? null;
      } catch {
        return null;
      }
    }

    const path = this.localAbsolutePath(relativeKey);
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf8');
  }

  async writeUtf8(relativeKey: string, content: string): Promise<void> {
    if (this.backend === 's3') {
      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket!,
          Key: relativeKey,
          Body: content,
          ContentType: 'application/json',
        }),
      );
      return;
    }

    const path = this.localAbsolutePath(relativeKey);
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, content, 'utf8');
  }

  localSiteContentDir(): string {
    return join(this.localRoot, 'site');
  }

  localContentRoot(): string {
    return this.localRoot;
  }

  siteContentKey(filename: string): string {
    return `content/site/${filename}`;
  }

  siteMenuKey(): string {
    return 'content/site-menu.json';
  }

  private localAbsolutePath(relativeKey: string): string {
    if (!relativeKey.startsWith('content/')) {
      throw new Error('Invalid content path');
    }
    const underContent = relativeKey.slice('content/'.length);
    const resolved = resolve(this.localRoot, underContent);
    const rootResolved = resolve(this.localRoot);
    if (!resolved.startsWith(rootResolved)) {
      throw new Error('Invalid content path');
    }
    return resolved;
  }

  private resolveLocalRoot(): string {
    const candidates = [
      join(process.cwd(), 'content'),
      join(process.cwd(), '..', 'content'),
    ];
    for (const dir of candidates) {
      if (existsSync(dir)) return resolve(dir);
    }
    return resolve(join(process.cwd(), '..', 'content'));
  }
}
