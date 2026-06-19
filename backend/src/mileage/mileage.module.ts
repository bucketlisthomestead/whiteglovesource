import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageLocation } from '../entities/storage-location.entity';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { MileageService } from './mileage.service';

@Module({
  imports: [TypeOrmModule.forFeature([StorageLocation]), GeocodingModule],
  providers: [MileageService],
  exports: [MileageService],
})
export class MileageModule {}
