import { describe, expect, it } from 'vitest';
import { renderNotification } from './notification-content';

const matchId = '7f1d8c2e-0d7b-4c55-9d0e-8f0a3c1b2a10';

describe('renderNotification', () => {
  it('renders match and message notifications with deep links', () => {
    expect(renderNotification('NEW_MATCH', { matchId, firstName: 'Ece' }, 1)).toEqual({
      title: 'Yeni eşleşme!',
      body: 'Ece ile eşleştin. İlk mesajı sen gönder.',
      href: `/matches/${matchId}`,
    });
    expect(renderNotification('NEW_MESSAGE', { matchId, firstName: 'Ece' }, 3)).toMatchObject({
      title: 'Ece sana yazdı',
      body: '3 yeni mesaj',
    });
  });

  it('does not reveal who liked the user', () => {
    const content = renderNotification('SOMEONE_LIKED_YOU', {}, 2);
    expect(content).toEqual({ title: 'Biri seni beğendi', body: '2 kişi seni beğendi.', href: '/likes' });
  });

  it('falls back to generic copy when stored data is malformed', () => {
    expect(renderNotification('NEW_MESSAGE', { unexpected: true }, 1)).toEqual({
      title: 'Yeni mesaj',
      body: 'Yeni mesajın var.',
      href: '/matches',
    });
    expect(renderNotification('PAYMENT_FAILED', null, 1).title).toBe('Ödeme alınamadı');
  });

  it('formats subscription expiry dates in Turkish', () => {
    const content = renderNotification(
      'SUBSCRIPTION_EXPIRING',
      { planName: 'Premium', expiresAt: '2026-11-05T00:00:00.000Z' },
      1,
    );
    expect(content.body).toContain('Premium aboneliğin');
    expect(content.body).toMatch(/Kasım 2026/);
  });
});
