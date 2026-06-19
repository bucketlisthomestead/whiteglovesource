import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageLocation } from '../entities/storage-location.entity';
import { GeocodingService } from '../geocoding/geocoding.service';
import { haversineMiles, roundMiles } from '../common/geo';

export interface MileageCalculation {
  milesToStorage: number;
  milesToInstall: number;
  storageLocationId: string | null;
  storageLocationName: string | null;
  mileageNote: string | null;
}

@Injectable()
export class MileageService {
  constructor(
    @InjectRepository(StorageLocation)
    private readonly storageRepo: Repository<StorageLocation>,
    private readonly geocoding: GeocodingService,
  ) {}

  async calculateMileage(
    pickupAddress?: string | null,
    propertyAddress?: string | null,
  ): Promise<MileageCalculation> {
    const warehouses = await this.storageRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    if (!warehouses.length) {
      return {
        milesToStorage: 0,
        milesToInstall: 0,
        storageLocationId: null,
        storageLocationName: null,
        mileageNote:
          'No storage warehouses configured — add locations in admin.',
      };
    }

    const geocodedWarehouses = warehouses.filter(
      (w) => w.latitude != null && w.longitude != null,
    );
    if (!geocodedWarehouses.length) {
      return {
        milesToStorage: 0,
        milesToInstall: 0,
        storageLocationId: null,
        storageLocationName: null,
        mileageNote:
          'Storage warehouses need valid coordinates — update in admin.',
      };
    }

    if (!pickupAddress?.trim()) {
      return {
        milesToStorage: 0,
        milesToInstall: 0,
        storageLocationId: null,
        storageLocationName: null,
        mileageNote:
          'Enter a pickup address to calculate mileage to our nearest warehouse.',
      };
    }

    const pickup = await this.geocoding.geocode(pickupAddress);
    if (!pickup) {
      return {
        milesToStorage: 0,
        milesToInstall: 0,
        storageLocationId: null,
        storageLocationName: null,
        mileageNote:
          'Could not locate pickup address — check spelling or add city/state.',
      };
    }

    let closest = geocodedWarehouses[0];
    let closestDistance = Infinity;
    for (const warehouse of geocodedWarehouses) {
      const distance = haversineMiles(
        pickup.latitude,
        pickup.longitude,
        Number(warehouse.latitude),
        Number(warehouse.longitude),
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = warehouse;
      }
    }

    const milesToStorage = roundMiles(closestDistance);
    let milesToInstall = 0;
    let mileageNote: string | null = `Nearest warehouse: ${closest.name}`;

    if (propertyAddress?.trim()) {
      const install = await this.geocoding.geocode(propertyAddress);
      if (install) {
        milesToInstall = roundMiles(
          haversineMiles(
            Number(closest.latitude),
            Number(closest.longitude),
            install.latitude,
            install.longitude,
          ),
        );
      } else {
        mileageNote =
          'Install address could not be located — storage leg priced; install mileage pending review.';
      }
    } else {
      mileageNote = `${mileageNote} — add install address for delivery mileage.`;
    }

    return {
      milesToStorage,
      milesToInstall,
      storageLocationId: closest.id,
      storageLocationName: closest.name,
      mileageNote,
    };
  }

  async geocodeStorageLocation(
    location: StorageLocation,
  ): Promise<StorageLocation> {
    const point = await this.geocoding.geocode(location.fullAddress());
    if (point) {
      location.latitude = point.latitude;
      location.longitude = point.longitude;
    }
    return location;
  }
}
