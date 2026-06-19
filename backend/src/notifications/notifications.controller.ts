import {
  Controller,
  Get,
  MessageEvent,
  Param,
  Patch,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable, merge, interval, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { NotificationsService } from './notifications.service';
import { StreamAuthGuard } from './stream-auth.guard';
import { Public } from '../common/decorators';
import { User } from '../entities/user.entity';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Req() req: { user: User }, @Query('limit') limit?: string) {
    const take = limit ? Math.min(parseInt(limit, 10) || 40, 100) : 40;
    return this.notificationsService.listForUser(req.user.id, take);
  }

  @Get('unread-count')
  unreadCount(@Req() req: { user: User }) {
    return this.notificationsService
      .unreadCount(req.user.id)
      .then((count) => ({ count }));
  }

  @Patch('read-all')
  markAllRead(@Req() req: { user: User }) {
    return this.notificationsService.markAllRead(req.user.id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Req() req: { user: User }) {
    return this.notificationsService.markRead(req.user.id, id);
  }

  /** Server-Sent Events — real-time push (not polling). Token via query for EventSource. */
  @Public()
  @UseGuards(StreamAuthGuard)
  @Get('stream')
  @Sse()
  stream(@Req() req: { user: User }): Observable<MessageEvent> {
    const userId = req.user.id;
    const live = from(this.notificationsService.connectStream(userId)).pipe(
      switchMap((stream) => stream),
    );
    const heartbeat = interval(25000).pipe(
      map(() => ({ data: JSON.stringify({ type: 'heartbeat' }) })),
    );
    return merge(live, heartbeat);
  }
}
