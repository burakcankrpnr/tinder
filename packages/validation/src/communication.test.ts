import { describe, expect, it } from 'vitest';
import {
  markNotificationsReadSchema,
  notificationPreferencesSchema,
  reportSchema,
  sendMessageSchema,
} from './communication';

const id = '0b3c9b7e-2f8a-4d3e-9a4b-6c1d2e3f4a5b';

describe('sendMessageSchema', () => {
  it('trims text and rejects empty or oversized bodies', () => {
    expect(sendMessageSchema.parse({ type: 'TEXT', clientMessageId: id, body: '  merhaba  ' })).toEqual({
      type: 'TEXT',
      clientMessageId: id,
      body: 'merhaba',
    });
    expect(sendMessageSchema.safeParse({ type: 'TEXT', clientMessageId: id, body: '   ' }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ type: 'TEXT', clientMessageId: id, body: 'x'.repeat(2001) }).success).toBe(
      false,
    );
  });

  it('requires an attachment key for image messages and a uuid client id', () => {
    expect(sendMessageSchema.safeParse({ type: 'IMAGE', clientMessageId: id }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ type: 'TEXT', clientMessageId: 'abc', body: 'hi' }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ type: 'IMAGE', clientMessageId: id, attachmentKey: 'chat/x' }).success).toBe(
      true,
    );
  });
});

describe('reportSchema', () => {
  it('defaults block to false and drops empty details', () => {
    expect(reportSchema.parse({ reportedUserId: id, reason: 'SPAM', details: '  ' })).toEqual({
      reportedUserId: id,
      reason: 'SPAM',
      details: undefined,
      block: false,
    });
  });

  it('rejects unknown reasons', () => {
    expect(reportSchema.safeParse({ reportedUserId: id, reason: 'BORING' }).success).toBe(false);
  });
});

describe('notification schemas', () => {
  it('requires at least one preference', () => {
    expect(notificationPreferencesSchema.safeParse({}).success).toBe(false);
    expect(notificationPreferencesSchema.parse({ email: false })).toEqual({ email: false });
  });

  it('accepts either all or a list of ids', () => {
    expect(markNotificationsReadSchema.safeParse({ all: true }).success).toBe(true);
    expect(markNotificationsReadSchema.safeParse({ ids: [id] }).success).toBe(true);
    expect(markNotificationsReadSchema.safeParse({ ids: [] }).success).toBe(false);
  });
});
