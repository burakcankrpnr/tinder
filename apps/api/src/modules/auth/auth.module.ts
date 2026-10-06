import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { OriginGuard } from '../../common/auth/origin.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { HttpThrottlerGuard } from '../../common/http/http-throttler.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleOAuthController } from './google-oauth.controller';
import { GoogleOAuthService } from './google-oauth.service';
import { LoginAttemptsService } from './login-attempts.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, GoogleOAuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    SessionService,
    LoginAttemptsService,
    GoogleOAuthService,
    OriginGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: HttpThrottlerGuard },
  ],
  exports: [TokenService, SessionService, PasswordService],
})
export class AuthModule {}
