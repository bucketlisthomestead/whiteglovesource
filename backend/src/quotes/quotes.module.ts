import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuoteRequest } from '../entities/quote-request.entity';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { CatalogModule } from '../catalog/catalog.module';
import { MileageModule } from '../mileage/mileage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuoteRequest]),
    CatalogModule,
    MileageModule,
  ],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
