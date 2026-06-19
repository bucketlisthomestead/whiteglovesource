import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

/** Shared S3 client config for production AWS and LocalStack (AWS_ENDPOINT_URL). */
export function createS3Client(config: ConfigService): S3Client {
  const region = config.get<string>('AWS_REGION', 'us-east-1');
  const endpoint = config.get<string>('AWS_ENDPOINT_URL');
  const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
  const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');

  return new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });
}
