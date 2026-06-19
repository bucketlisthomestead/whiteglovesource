import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { finalize } from 'rxjs/operators';
import {
  Notification,
  NotificationType,
} from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { QuoteRequest } from '../entities/quote-request.entity';
import { UserRole } from '../common/roles';

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  quoteId: string | null;
  projectId: string | null;
  read: boolean;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  private readonly streams = new Map<string, Subject<MessageEvent>>();

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async connectStream(userId: string): Promise<Observable<MessageEvent>> {
    let subject = this.streams.get(userId);
    if (!subject) {
      subject = new Subject<MessageEvent>();
      this.streams.set(userId, subject);
    }
    await this.pushUnreadCount(userId);
    return subject.asObservable().pipe(
      finalize(() => {
        /* keep subject for other tabs / reconnects */
      }),
    );
  }

  async listForUser(userId: string, limit = 40) {
    const rows = await this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.map((n) => this.serialize(n));
  }

  async unreadCount(userId: string) {
    return this.notificationRepo.count({ where: { userId, read: false } });
  }

  async markRead(userId: string, notificationId: string) {
    const row = await this.notificationRepo.findOne({
      where: { id: notificationId, userId },
    });
    if (!row) return { ok: false };
    if (!row.read) {
      row.read = true;
      await this.notificationRepo.save(row);
      await this.pushUnreadCount(userId);
    }
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.notificationRepo.update({ userId, read: false }, { read: true });
    await this.pushUnreadCount(userId);
    return { ok: true };
  }

  async notifyQuoteLead(quote: QuoteRequest) {
    const title = 'New quote lead';
    const body = `${quote.contactName} started a quote (${quote.serviceType})`;
    await this.notifyQuoteEvent(
      quote,
      NotificationType.QUOTE_LEAD,
      title,
      body,
    );
  }

  async notifyQuoteSubmitted(quote: QuoteRequest) {
    const place = quote.propertyAddress?.split(',')[0]?.trim();
    const title = 'Quote submitted';
    const body = place
      ? `${quote.contactName} — ${place}`
      : `${quote.contactName} submitted a quote for review`;
    await this.notifyQuoteEvent(
      quote,
      NotificationType.QUOTE_SUBMITTED,
      title,
      body,
    );
  }

  async notifyProjectOpened(project: Project, source: 'quote' | 'direct') {
    const title =
      source === 'quote'
        ? 'Quote accepted — project opened'
        : 'New project created';
    const body = project.name;
    const userIds = await this.resolveProjectParticipantIds(project);
    await this.notifyMany(userIds, {
      type: NotificationType.PROJECT_OPENED,
      title,
      body,
      link: `/project/${project.id}`,
      quoteId: null,
      projectId: project.id,
    });
  }

  async notifyProjectMessage(
    project: Project,
    author: User,
    body: string,
    isInternal: boolean,
  ) {
    let userIds = await this.resolveProjectParticipantIds(project);
    userIds = userIds.filter((id) => id !== author.id);

    if (isInternal) {
      const admins = await this.userRepo.find({
        where: { role: UserRole.ADMIN, isActive: true },
        select: { id: true },
      });
      userIds = admins.map((a) => a.id).filter((id) => id !== author.id);
    }

    const preview = body.length > 120 ? `${body.slice(0, 120)}…` : body;
    await this.notifyMany(userIds, {
      type: NotificationType.PROJECT_MESSAGE,
      title: isInternal
        ? `Internal note — ${project.name}`
        : `Message — ${project.name}`,
      body: `${author.name}: ${preview}`,
      link: `/project/${project.id}?tab=audit`,
      quoteId: null,
      projectId: project.id,
    });
  }

  private async notifyQuoteEvent(
    quote: QuoteRequest,
    type: NotificationType,
    title: string,
    body: string,
  ) {
    const userIds = await this.resolveQuoteRecipientIds(quote.email);
    await this.notifyMany(userIds, {
      type,
      title,
      body,
      link: `/admin/quotes/${quote.id}`,
      quoteId: quote.id,
      projectId: null,
    });
  }

  private async resolveQuoteRecipientIds(email: string) {
    const normalized = email.toLowerCase();
    const users = await this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.designer', 'd')
      .leftJoin('u.client', 'c')
      .where('u.isActive = true')
      .andWhere(
        '(u.role = :admin OR LOWER(u.email) = :email OR LOWER(d.email) = :email OR LOWER(c.email) = :email)',
        { admin: UserRole.ADMIN, email: normalized },
      )
      .getMany();

    return [...new Set(users.map((u) => u.id))];
  }

  private async resolveProjectParticipantIds(project: Project) {
    const ids = new Set<string>();

    const admins = await this.userRepo.find({
      where: { role: UserRole.ADMIN, isActive: true },
      select: { id: true },
    });
    admins.forEach((a) => ids.add(a.id));

    if (project.designerId) {
      const designers = await this.userRepo.find({
        where: { designerId: project.designerId, isActive: true },
        select: { id: true },
      });
      designers.forEach((u) => ids.add(u.id));
    }

    if (project.clientId) {
      const clients = await this.userRepo.find({
        where: { clientId: project.clientId, isActive: true },
        select: { id: true },
      });
      clients.forEach((u) => ids.add(u.id));
    }

    return [...ids];
  }

  private async notifyMany(
    userIds: string[],
    payload: Omit<NotificationDto, 'id' | 'read' | 'createdAt'> & {
      type: NotificationType;
    },
  ) {
    const unique = [...new Set(userIds)];
    await Promise.all(
      unique.map((userId) => this.createAndPush(userId, payload)),
    );
  }

  private async createAndPush(
    userId: string,
    payload: Omit<NotificationDto, 'id' | 'read' | 'createdAt'> & {
      type: NotificationType;
    },
  ) {
    const saved = await this.notificationRepo.save(
      this.notificationRepo.create({
        userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        link: payload.link,
        quoteId: payload.quoteId,
        projectId: payload.projectId,
        read: false,
      }),
    );
    const dto = this.serialize(saved);
    this.emit(userId, { type: 'notification', notification: dto });
    await this.pushUnreadCount(userId);
    return dto;
  }

  private async pushUnreadCount(userId: string) {
    const count = await this.unreadCount(userId);
    this.emit(userId, { type: 'unread_count', count });
  }

  private emit(userId: string, payload: Record<string, unknown>) {
    const subject = this.streams.get(userId);
    if (!subject) return;
    subject.next({ data: JSON.stringify(payload) });
  }

  private serialize(n: Notification): NotificationDto {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      quoteId: n.quoteId,
      projectId: n.projectId,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
