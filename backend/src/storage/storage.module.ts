import { Global, Module } from '@nestjs/common';
import { ContentFileStorageService } from './content-file.storage';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [StorageService, ContentFileStorageService],
  exports: [StorageService, ContentFileStorageService],
})
export class StorageModule {}
