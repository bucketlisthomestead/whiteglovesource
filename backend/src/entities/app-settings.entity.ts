import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export const APP_SETTINGS_ID = 'default';

@Entity('app_settings')
export class AppSettings {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  businessName: string;

  @Column({ type: 'varchar', length: 255 })
  businessEmail: string;

  @Column({ type: 'varchar', length: 50 })
  businessPhone: string;

  @Column({ type: 'varchar', length: 255 })
  businessAddress: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  businessCity: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  businessState: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  businessZip: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  mileRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  projectBaseFee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  additionalPickupSurcharge: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  minimumQuote: number;

  @Column({ type: 'boolean', default: false })
  allowDigitalSignatures: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
