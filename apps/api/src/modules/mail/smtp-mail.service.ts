import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ApiEnv } from '@dating/config';
import { type Transporter, createTransport } from 'nodemailer';
import { ENV } from '../../config/env.module';
import { type MailMessage, MailService } from './mail.service';

@Injectable()
export class SmtpMailService extends MailService {
  private readonly logger = new Logger(SmtpMailService.name);
  private readonly transporter: Transporter;

  constructor(@Inject(ENV) private readonly env: ApiEnv) {
    super();
    this.transporter = createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? '' } : undefined,
    });
  }

  async send(message: MailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.env.MAIL_FROM, ...message });
    } catch (error) {
      this.logger.error({ err: error, subject: message.subject }, 'E-posta gönderilemedi');
    }
  }
}
