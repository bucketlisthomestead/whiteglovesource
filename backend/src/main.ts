import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  const storageBackend = config.get<string>('STORAGE_BACKEND');
  const s3Bucket = config.get<string>('S3_BUCKET');
  const useS3 =
    storageBackend === 's3' || (!storageBackend && !!s3Bucket);

  if (!useS3 || !s3Bucket) {
    const uploadDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    app.useStaticAssets(uploadDir, { prefix: '/api/files/' });
  }

  app.enableCors({
    origin:
      config.get('NODE_ENV') === 'production' &&
      !config.get<string>('CORS_ORIGIN')
        ? true
        : config.get('CORS_ORIGIN', 'http://localhost:5173'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = config.get<number>('PORT', 3001);
  await app.listen(port);
  console.log(`White Glove Source API running on http://localhost:${port}`);
}
bootstrap();
