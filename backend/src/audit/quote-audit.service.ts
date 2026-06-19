import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuoteRequest } from '../entities/quote-request.entity';
import { QuoteMessage } from '../entities/quote-message.entity';
import { CreateQuoteMessageDto } from '../common/quote-message.dto';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/roles';
import { RecordAuditService } from './record-audit.service';
import { RecordChangeAction } from '../entities/record-change.entity';

export interface QuoteActivityEntry {
  id: string;
  type: 'message' | 'edit' | 'quote_sent';
  occurredAt: string;
  title: string;
  summary?: string;
  actor?: string;
  changes?: {
    field: string;
    label: string;
    from: string | null;
    to: string | null;
  }[];
}

@Injectable()
export class QuoteAuditService {
  constructor(
    @InjectRepository(QuoteRequest)
    private readonly quoteRepo: Repository<QuoteRequest>,
    @InjectRepository(QuoteMessage)
    private readonly messageRepo: Repository<QuoteMessage>,
    private readonly recordAudit: RecordAuditService,
  ) {}

  async getMessages(quoteId: string) {
    await this.assertQuote(quoteId);
    const messages = await this.messageRepo.find({
      where: { quoteId },
      order: { createdAt: 'ASC' },
    });
    return messages.map((m) => this.serializeMessage(m));
  }

  async createMessage(quoteId: string, user: User, dto: CreateQuoteMessageDto) {
    await this.assertQuote(quoteId);
    const body = dto.body.trim();
    if (!body) throw new ForbiddenException('Message cannot be empty');

    const isInternal = user.role === UserRole.ADMIN && dto.isInternal === true;
    const saved = await this.messageRepo.save(
      this.messageRepo.create({
        quoteId,
        authorUserId: user.id,
        authorName: user.name,
        authorRole: user.role,
        body,
        isInternal,
      }),
    );
    return this.serializeMessage(saved);
  }

  async getActivity(quoteId: string): Promise<QuoteActivityEntry[]> {
    await this.assertQuote(quoteId);
    const [messages, changes] = await Promise.all([
      this.messageRepo.find({
        where: { quoteId },
        order: { createdAt: 'DESC' },
      }),
      this.recordAudit.listForQuote(quoteId),
    ]);

    const entries: QuoteActivityEntry[] = [];

    for (const change of changes) {
      entries.push({
        id: change.id,
        type:
          change.action === RecordChangeAction.QUOTE_SENT
            ? 'quote_sent'
            : 'edit',
        occurredAt: change.createdAt.toISOString(),
        title:
          change.action === RecordChangeAction.QUOTE_SENT
            ? 'Quote sent to client'
            : 'Quote updated',
        summary: change.summary ?? undefined,
        actor: change.actorName,
        changes: change.changes,
      });
    }

    for (const message of messages) {
      entries.push({
        id: message.id,
        type: 'message',
        occurredAt: message.createdAt.toISOString(),
        title: message.isInternal ? 'Internal note' : 'Message',
        summary: message.body,
        actor: message.authorName,
      });
    }

    return entries.sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
  }

  private async assertQuote(quoteId: string) {
    const quote = await this.quoteRepo.findOne({ where: { id: quoteId } });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  private serializeMessage(m: QuoteMessage) {
    return {
      id: m.id,
      quoteId: m.quoteId,
      authorUserId: m.authorUserId,
      authorName: m.authorName,
      authorRole: m.authorRole,
      body: m.body,
      isInternal: m.isInternal,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
