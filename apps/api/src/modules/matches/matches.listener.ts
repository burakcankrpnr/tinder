import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DomainEvent,
  type MatchCreatedEvent,
  type MatchEndedEvent,
} from '../../common/events/domain-events';
import { RealtimeService } from '../realtime/realtime.service';
import { MatchesService } from './matches.service';

@Injectable()
export class MatchesRealtimeListener {
  private readonly logger = new Logger(MatchesRealtimeListener.name);

  constructor(
    private readonly matches: MatchesService,
    private readonly realtime: RealtimeService,
  ) {}

  @OnEvent(DomainEvent.MATCH_CREATED, { async: true, promisify: true })
  async onMatchCreated(event: MatchCreatedEvent): Promise<void> {
    try {
      for (const userId of event.userIds) {
        this.realtime.toUser(userId, 'match:new', await this.matches.summaryFor(event.matchId, userId));
      }
    } catch (error) {
      this.logger.error({ err: error, matchId: event.matchId }, 'match:new yayınlanamadı');
    }
  }

  @OnEvent(DomainEvent.MATCH_ENDED)
  onMatchEnded(event: MatchEndedEvent): void {
    this.realtime.toUsers(event.userIds, 'match:ended', { matchId: event.matchId });
  }
}
