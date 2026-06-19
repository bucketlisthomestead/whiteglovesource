import { Repository } from 'typeorm';
import { StorageLocation } from '../entities/storage-location.entity';

const WAREHOUSES: Array<Partial<StorageLocation>> = [
  {
    name: 'WGS High Point Climate Warehouse',
    address: '1920 N Main St',
    city: 'High Point',
    state: 'NC',
    zip: '27262',
    latitude: 35.9708,
    longitude: -80.0053,
    isActive: true,
    notes: 'Primary receiving & climate-controlled storage — Triad hub',
  },
  {
    name: 'WGS Greensboro Storage',
    address: '2400 W Meadowview Rd',
    city: 'Greensboro',
    state: 'NC',
    zip: '27407',
    latitude: 36.045,
    longitude: -79.89,
    isActive: true,
    notes: 'Secondary overflow & staging facility',
  },
];

export async function seedStorageLocations(repo: Repository<StorageLocation>) {
  const count = await repo.count();
  if (count > 0) return;

  for (const data of WAREHOUSES) {
    await repo.save(repo.create(data));
  }
}
