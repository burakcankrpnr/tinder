import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type UserProfile } from '@dating/database';
import type { MyProfileDto, ProfileBasicsDto, PublicProfileDto } from '@dating/types';
import {
  type InterestsInput,
  type LocationInput,
  type PreferencesInput,
  type ProfileBasicsInput,
  calculateAge,
} from '@dating/validation';
import { canAuthenticate } from '../../common/auth/user-status';
import { DomainEvent, type ProfileCompletedEvent } from '../../common/events/domain-events';
import { AppException } from '../../common/http/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InterestsService } from '../interests/interests.service';
import { toPhotoDto } from '../photos/photo.mapper';
import { BlocksService } from '../safety/blocks.service';
import { StorageService } from '../storage/storage.service';
import {
  type CompletenessInput,
  calculateCompleteness,
  nextOnboardingStep,
  roundCoordinate,
} from './profile-completeness';
import { isPubliclyVisible, publicProfileInclude, toPublicProfileDto } from './public-profile.mapper';

const USABLE_PHOTO_STATUSES = ['PROCESSING', 'APPROVED', 'PENDING_REVIEW'] as const;

function toBasicsDto(profile: UserProfile): ProfileBasicsDto {
  return {
    firstName: profile.firstName,
    username: profile.username,
    gender: profile.gender,
    bio: profile.bio,
    city: profile.city,
    country: profile.country,
    occupation: profile.occupation,
    education: profile.education,
    heightCm: profile.heightCm,
    languages: profile.languages,
    relationshipIntention: profile.relationshipIntention,
    drinking: profile.drinking,
    smoking: profile.smoking,
    exercise: profile.exercise,
  };
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly interests: InterestsService,
    private readonly audit: AuditService,
    private readonly blocks: BlocksService,
    private readonly events: EventEmitter2,
  ) {}

  private publicUrl = (key: string): string => this.storage.publicUrl(key);

  private async loadOwn(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        preferences: true,
        interests: { include: { interest: true }, orderBy: { interest: { sortOrder: 'asc' } } },
        photos: {
          where: { status: { not: 'PENDING_UPLOAD' } },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!user || !canAuthenticate(user)) throw AppException.unauthorized();
    return user;
  }

  private completenessInput(user: Awaited<ReturnType<ProfilesService['loadOwn']>>): CompletenessInput {
    return {
      profile: user.profile,
      hasPreferences: user.preferences !== null,
      photoCount: user.photos.filter((photo) =>
        (USABLE_PHOTO_STATUSES as readonly string[]).includes(photo.status),
      ).length,
      interestCount: user.interests.length,
    };
  }

  async getMe(userId: string): Promise<MyProfileDto> {
    const user = await this.loadOwn(userId);
    const input = this.completenessInput(user);
    const { profile, preferences } = user;

    return {
      age: calculateAge(user.birthDate),
      profile: profile
        ? {
            ...toBasicsDto(profile),
            verificationStatus: profile.verificationStatus,
            hasLocation: profile.latitude !== null,
            locationUpdatedAt: profile.locationUpdatedAt?.toISOString() ?? null,
          }
        : null,
      preferences: preferences
        ? {
            interestedIn: preferences.interestedIn,
            ageMin: preferences.ageMin,
            ageMax: preferences.ageMax,
            maxDistanceKm: preferences.maxDistanceKm,
          }
        : null,
      interests: user.interests.map(({ interest }) => ({
        id: interest.id,
        slug: interest.slug,
        name: interest.name,
        category: interest.category,
      })),
      photos: user.photos.map((photo) => toPhotoDto(photo, this.publicUrl)),
      completeness: calculateCompleteness(input),
      onboarding: {
        completed: profile?.onboardingCompletedAt != null,
        nextStep: nextOnboardingStep(input),
      },
    };
  }

  async updateBasics(userId: string, input: ProfileBasicsInput): Promise<MyProfileDto> {
    try {
      await this.prisma.userProfile.upsert({
        where: { userId },
        create: { userId, ...input },
        update: input,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException('CONFLICT', 'Bu kullanıcı adı alınmış.', HttpStatus.CONFLICT);
      }
      throw error;
    }
    return this.getMe(userId);
  }

  async isUsernameAvailable(userId: string, username: string): Promise<boolean> {
    const existing = await this.prisma.userProfile.findUnique({
      where: { username },
      select: { userId: true },
    });
    return !existing || existing.userId === userId;
  }

  async updatePreferences(userId: string, input: PreferencesInput): Promise<MyProfileDto> {
    await this.prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
    return this.getMe(userId);
  }

  async updateInterests(userId: string, input: InterestsInput): Promise<MyProfileDto> {
    const existing = await this.interests.countExisting(input.interestIds);
    if (existing !== input.interestIds.length) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Geçersiz ilgi alanı seçimi.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    await this.prisma.$transaction([
      this.prisma.userInterest.deleteMany({ where: { userId } }),
      this.prisma.userInterest.createMany({
        data: input.interestIds.map((interestId) => ({ userId, interestId })),
      }),
    ]);
    return this.getMe(userId);
  }

  async updateLocation(userId: string, input: LocationInput): Promise<MyProfileDto> {
    const updated = await this.prisma.userProfile.updateMany({
      where: { userId },
      data: {
        latitude: roundCoordinate(input.latitude),
        longitude: roundCoordinate(input.longitude),
        locationUpdatedAt: new Date(),
        ...(input.city ? { city: input.city } : {}),
        ...(input.country ? { country: input.country } : {}),
      },
    });
    if (updated.count === 0) {
      throw new AppException('CONFLICT', 'Önce profil bilgilerini doldur.', HttpStatus.CONFLICT);
    }
    return this.getMe(userId);
  }

  async completeOnboarding(userId: string): Promise<MyProfileDto> {
    const user = await this.loadOwn(userId);
    if (user.profile?.onboardingCompletedAt) return this.getMe(userId);

    const nextStep = nextOnboardingStep(this.completenessInput(user));
    if (nextStep) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Onboarding adımları tamamlanmadı.',
        HttpStatus.UNPROCESSABLE_ENTITY,
        [{ path: 'onboarding', message: nextStep }],
      );
    }

    const completedAt = new Date();
    const result = await this.prisma.userProfile.updateMany({
      where: { userId, onboardingCompletedAt: null },
      data: { onboardingCompletedAt: completedAt },
    });
    if (result.count === 1) {
      await this.audit.log({ actorUserId: userId, action: 'profile.onboarding_completed' });
      const event: ProfileCompletedEvent = { userId, completedAt: completedAt.toISOString() };
      this.events.emit(DomainEvent.PROFILE_COMPLETED, event);
    }
    return this.getMe(userId);
  }

  async getPublic(viewerId: string, username: string): Promise<PublicProfileDto> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { username },
      include: publicProfileInclude,
    });
    if (
      !profile ||
      !isPubliclyVisible(profile) ||
      (profile.userId !== viewerId && (await this.blocks.isBlockedBetween(viewerId, profile.userId))) ||
      (profile.incognito && profile.userId !== viewerId && !(await this.hasLiked(profile.userId, viewerId)))
    ) {
      throw AppException.notFound('Profil bulunamadı.');
    }
    return toPublicProfileDto(profile, this.publicUrl);
  }

  /** Incognito profiller yalnızca beğendikleri kişilere görünür. */
  private async hasLiked(actorUserId: string, targetUserId: string): Promise<boolean> {
    const swipe = await this.prisma.swipe.findFirst({
      where: { actorUserId, targetUserId, action: { in: ['LIKE', 'SUPER_LIKE'] } },
      select: { id: true },
    });
    return swipe !== null;
  }
}
