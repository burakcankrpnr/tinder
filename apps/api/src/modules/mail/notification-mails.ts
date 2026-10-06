import { escapeHtml, layout } from './auth-mails';
import type { MailMessage } from './mail.service';

/** Başlık/metin kullanıcı girdisi (ör. isim) içerebilir; HTML'e kaçışlanarak yazılır. */
export function notificationMail(to: string, title: string, body: string, url: string): MailMessage {
  return {
    to,
    subject: title,
    text: `${body}\n\n${url}`,
    html: layout(escapeHtml(title), escapeHtml(body), { label: 'Uygulamada aç', url }),
  };
}
