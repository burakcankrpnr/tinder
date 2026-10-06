import type { MailMessage } from './mail.service';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function layout(title: string, body: string, action?: { label: string; url: string }): string {
  const button = action
    ? `<p><a href="${action.url}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#9C7AF2;color:#FFFFFF;text-decoration:none">${action.label}</a></p>`
    : '';
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>${title}</h2><p>${body}</p>${button}</div>`;
}

export function verificationMail(to: string, url: string): MailMessage {
  return {
    to,
    subject: 'Email adresini doğrula',
    text: `Hesabını aktifleştirmek için bağlantıyı aç: ${url}`,
    html: layout('Hoş geldin!', 'Hesabını aktifleştirmek için email adresini doğrula.', {
      label: 'Emaili doğrula',
      url,
    }),
  };
}

export function accountExistsMail(to: string, loginUrl: string): MailMessage {
  return {
    to,
    subject: 'Zaten bir hesabın var',
    text: `Bu email ile kayıtlı bir hesap zaten var. Giriş yapmak için: ${loginUrl}`,
    html: layout(
      'Zaten bir hesabın var',
      'Bu email adresiyle yeniden kayıt olunmaya çalışıldı. Sen değilsen bu emaili yok sayabilirsin.',
      { label: 'Giriş yap', url: loginUrl },
    ),
  };
}

export function passwordResetMail(to: string, url: string): MailMessage {
  return {
    to,
    subject: 'Şifre sıfırlama',
    text: `Şifreni sıfırlamak için bağlantıyı aç (1 saat geçerli): ${url}`,
    html: layout(
      'Şifre sıfırlama',
      'Şifreni sıfırlamak için aşağıdaki bağlantıyı kullan. Bağlantı 1 saat geçerlidir.',
      { label: 'Şifremi sıfırla', url },
    ),
  };
}

export function newDeviceLoginMail(to: string, deviceName: string | null): MailMessage {
  const device = deviceName ?? 'bilinmeyen bir cihaz';
  return {
    to,
    subject: 'Yeni cihazdan giriş',
    text: `Hesabına ${device} üzerinden giriş yapıldı. Sen değilsen şifreni hemen değiştir.`,
    html: layout(
      'Yeni cihazdan giriş',
      `Hesabına ${device} üzerinden giriş yapıldı. Sen değilsen şifreni hemen değiştir ve tüm oturumlardan çıkış yap.`,
    ),
  };
}
