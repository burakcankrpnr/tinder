import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { ChatAttachmentUploadDto, ChatMessageDto, MessageDto, MessagePageDto } from '@dating/types';
import {
  type MarkReadInput,
  type MessagesQueryInput,
  type PhotoUploadRequestInput,
  type SendMessageInput,
  chatAttachmentRequestSchema,
  idParamSchema,
  markReadSchema,
  matchIdParamSchema,
  messagesQuerySchema,
  sendMessageSchema,
} from '@dating/validation';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { ChatService } from './chat.service';

@Controller()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('matches/:matchId/messages')
  list(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(matchIdParamSchema)) params: { matchId: string },
    @Query(new ZodValidationPipe(messagesQuerySchema)) query: MessagesQueryInput,
  ): Promise<MessagePageDto> {
    return this.chat.list(user.id, params.matchId, query);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('matches/:matchId/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(matchIdParamSchema)) params: { matchId: string },
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageInput,
  ): Promise<ChatMessageDto> {
    return this.chat.send(user.id, params.matchId, body);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('matches/:matchId/attachments')
  attachment(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(matchIdParamSchema)) params: { matchId: string },
    @Body(new ZodValidationPipe(chatAttachmentRequestSchema)) body: PhotoUploadRequestInput,
  ): Promise<ChatAttachmentUploadDto> {
    return this.chat.createAttachmentUpload(user.id, params.matchId, body);
  }

  @Post('matches/:matchId/read')
  @HttpCode(HttpStatus.OK)
  markRead(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(matchIdParamSchema)) params: { matchId: string },
    @Body(new ZodValidationPipe(markReadSchema)) body: MarkReadInput,
  ): Promise<{ updated: number }> {
    return this.chat.markRead(user.id, params.matchId, body);
  }

  @Delete('messages/:id')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param(new ZodValidationPipe(idParamSchema)) params: { id: string },
  ): Promise<MessageDto> {
    await this.chat.delete(user.id, params.id);
    return { message: 'Mesaj silindi.' };
  }
}
