import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CurrentUserDto, MessageDto } from '@dating/types';
import { type DeleteAccountInput, deleteAccountSchema } from '@dating/validation';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<CurrentUserDto> {
    return this.users.getMe(user.id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('me/delete')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(deleteAccountSchema)) body: DeleteAccountInput,
  ): Promise<MessageDto> {
    await this.users.deleteAccount(user.id, body);
    return { message: 'Hesabın silindi.' };
  }
}
