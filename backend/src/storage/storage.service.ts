import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createS3Client } from './s3-client.factory';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { extname, join } from 'path';

export interface StoredFile {
  storageKey: string;
  /** Public or API-relative URL for reference (download goes through auth endpoint) */
  fileUrl: string;
}

const PHOTO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

@Injectable()
export class StorageService {
  private readonly localRoot: string;
  private readonly photosLocalRoot: string;
  private readonly s3Client: S3Client | null;
  private readonly s3Bucket: string | null;
  private readonly s3PublicBaseUrl: string | null;

  constructor(private readonly config: ConfigService) {
    this.localRoot = join(process.cwd(), 'storage');
    this.photosLocalRoot = join(process.cwd(), 'uploads');
    this.s3Bucket = this.config.get<string>('S3_BUCKET') || null;
    this.s3PublicBaseUrl =
      this.config.get<string>('S3_PUBLIC_BASE_URL') || null;

    const storageBackend = this.config.get<string>('STORAGE_BACKEND');
    const useS3 =
      storageBackend === 's3' || (!storageBackend && !!this.s3Bucket);

    if (useS3 && this.s3Bucket) {
      this.s3Client = createS3Client(this.config);
    } else {
      this.s3Client = null;
    }
  }

  get driver(): 's3' | 'local' {
    return this.s3Client && this.s3Bucket ? 's3' : 'local';
  }

  /** Prefix object keys with uploads/ in S3 for bucket layout. */
  private objectKey(storageKey: string): string {
    if (this.driver === 's3') {
      return storageKey.startsWith('uploads/') ? storageKey : `uploads/${storageKey}`;
    }
    return storageKey;
  }

  async savePdf(
    projectId: string,
    buffer: Buffer,
    filename: string,
  ): Promise<StoredFile> {
    const storageKey = `project-docs/${projectId}/${randomUUID()}-${filename.replace(/[^\w.-]/g, '_')}`;

    if (this.driver === 's3') {
      const key = this.objectKey(storageKey);
      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket!,
          Key: key,
          Body: buffer,
          ContentType: 'application/pdf',
        }),
      );
      const fileUrl = this.s3PublicBaseUrl
        ? `${this.s3PublicBaseUrl.replace(/\/$/, '')}/${storageKey}`
        : `s3://${this.s3Bucket}/${storageKey}`;
      return { storageKey, fileUrl };
    }

    const absolutePath = join(this.localRoot, storageKey);
    const dir = join(absolutePath, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(absolutePath, buffer);
    return { storageKey, fileUrl: `/api/pdf/documents/local/${storageKey}` };
  }

  async saveFile(
    projectId: string,
    buffer: Buffer,
    filename: string,
    contentType: string,
    folder = 'contract-docs',
  ): Promise<StoredFile> {
    const safeName = filename.replace(/[^\w.-]/g, '_');
    const storageKey = `${folder}/${projectId}/${randomUUID()}-${safeName}`;
    return this.saveAtKey(buffer, storageKey, contentType);
  }

  async saveAtKey(
    buffer: Buffer,
    storageKey: string,
    contentType: string,
  ): Promise<StoredFile> {
    if (this.driver === 's3') {
      const key = this.objectKey(storageKey);
      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket!,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      const fileUrl = this.s3PublicBaseUrl
        ? `${this.s3PublicBaseUrl.replace(/\/$/, '')}/${storageKey}`
        : `s3://${this.s3Bucket}/${storageKey}`;
      return { storageKey, fileUrl };
    }

    const absolutePath = join(this.localRoot, storageKey);
    const dir = join(absolutePath, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(absolutePath, buffer);
    return { storageKey, fileUrl: storageKey };
  }

  async readFile(storageKey: string): Promise<Buffer> {
    if (this.driver === 's3') {
      const key = this.objectKey(storageKey);
      const response = await this.s3Client!.send(
        new GetObjectCommand({ Bucket: this.s3Bucket!, Key: key }),
      );
      const bytes = await response.Body?.transformToByteArray();
      if (!bytes) throw new Error('Empty file from storage');
      return Buffer.from(bytes);
    }

    const absolutePath = join(this.localRoot, storageKey);
    return readFileSync(absolutePath);
  }

  private photoStorageKey(filename: string): string {
    return `photos/${filename}`;
  }

  private photoFilename(storageKey: string): string {
    return storageKey.replace(/^photos\//, '');
  }

  photoContentType(filename: string): string {
    const ext = extname(filename).toLowerCase();
    return PHOTO_MIME[ext] || 'application/octet-stream';
  }

  getPhotoUrl(storageKey: string): string {
    return `/api/files/${this.photoFilename(storageKey)}`;
  }

  filenameFromPhotoUrl(photoUrl: string): string | null {
    const apiMatch = photoUrl.match(/\/api\/files\/(.+)$/);
    if (apiMatch) return apiMatch[1];

    if (!photoUrl.startsWith('http') && !photoUrl.startsWith('/')) {
      return photoUrl;
    }

    if (this.s3PublicBaseUrl) {
      const base = this.s3PublicBaseUrl.replace(/\/$/, '');
      if (photoUrl.startsWith(`${base}/photos/`)) {
        return photoUrl.slice(base.length + '/photos/'.length);
      }
    }

    return null;
  }

  async savePhoto(
    buffer: Buffer,
    originalFilename?: string,
  ): Promise<StoredFile> {
    const ext = extname(originalFilename || '') || '.jpg';
    const filename = `${randomUUID()}${ext}`;
    const storageKey = this.photoStorageKey(filename);
    const contentType = this.photoContentType(filename);

    if (this.driver === 's3') {
      const key = this.objectKey(storageKey);
      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket!,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      return { storageKey, fileUrl: this.getPhotoUrl(storageKey) };
    }

    if (!existsSync(this.photosLocalRoot)) {
      mkdirSync(this.photosLocalRoot, { recursive: true });
    }
    writeFileSync(join(this.photosLocalRoot, filename), buffer);
    return { storageKey, fileUrl: this.getPhotoUrl(storageKey) };
  }

  async readPhoto(filename: string): Promise<Buffer> {
    const storageKey = this.photoStorageKey(filename);

    if (this.driver === 's3') {
      return this.readFile(storageKey);
    }

    const absolutePath = join(this.photosLocalRoot, filename);
    if (existsSync(absolutePath)) {
      return readFileSync(absolutePath);
    }

    throw new Error(`Photo not found: ${filename}`);
  }

  async readPhotoByUrl(photoUrl: string): Promise<Buffer | null> {
    const filename = this.filenameFromPhotoUrl(photoUrl);
    if (!filename) return null;

    try {
      return await this.readPhoto(filename);
    } catch {
      return null;
    }
  }
}
