import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecordChange } from '../entities/record-change.entity';
import { QuoteMessage } from '../entities/quote-message.entity';
import { QuoteRequest } from '../entities/quote-request.entity';
import { RecordAuditService } from './record-audit.service';
import { QuoteAuditService } from './quote-audit.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([RecordChange, QuoteMessage, QuoteRequest]),
  ],
  providers: [RecordAuditService, QuoteAuditService],
  exports: [RecordAuditService, QuoteAuditService],
})
export class AuditModule {}
