import { Injectable } from '@nestjs/common';

export interface ModerationResult {
  /** 0 = güvenli, 1 = kesin ihlal */
  score: number;
  labels: string[];
}

export type ModerationDecision = 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED';

export const REVIEW_THRESHOLD = 0.5;
export const REJECT_THRESHOLD = 0.85;

export function decideModeration(score: number): ModerationDecision {
  if (score >= REJECT_THRESHOLD) return 'REJECTED';
  if (score >= REVIEW_THRESHOLD) return 'PENDING_REVIEW';
  return 'APPROVED';
}

export abstract class ModerationProvider {
  abstract assess(image: Buffer): Promise<ModerationResult>;
}

/** Gerçek sağlayıcı (ör. AWS Rekognition, Sightengine) bağlanana kadar her görseli onaylar. */
@Injectable()
export class NoopModerationProvider extends ModerationProvider {
  async assess(): Promise<ModerationResult> {
    return { score: 0, labels: [] };
  }
}
