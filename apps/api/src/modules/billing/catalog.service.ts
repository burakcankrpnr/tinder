import { Injectable } from '@nestjs/common';
import type { Product, SubscriptionPlan } from '@dating/database';
import type { CatalogDto, PlanDto, ProductDto } from '@dating/types';
import { AppException } from '../../common/http/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { yearlySavingsPercent } from './periods';

export const FREE_PLAN_SLUG = 'free';
const CACHE_TTL_MS = 60_000;

export function toPlanDto(plan: SubscriptionPlan): PlanDto {
  return {
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    currency: plan.currency,
    yearlySavingsPercent: yearlySavingsPercent(plan.monthlyPrice, plan.yearlyPrice),
    features: plan.features,
    limits: {
      dailyLikes: plan.swipeLimit,
      superLikesPerWeek: plan.superLikeLimit,
      boostsPerMonth: plan.boostLimit,
    },
    perks: {
      rewind: plan.rewindEnabled,
      seeLikes: plan.seeLikesEnabled,
      incognito: plan.incognitoEnabled,
      passport: plan.passportEnabled,
      advancedFilters: plan.advancedFiltersEnabled,
      adFree: plan.adFree,
      priorityVisibility: plan.visibilityBoost > 0,
    },
  };
}

export function toProductDto(product: Product): ProductDto {
  return {
    slug: product.slug,
    name: product.name,
    description: product.description,
    type: product.type,
    quantity: product.quantity,
    price: product.price,
    currency: product.currency,
  };
}

interface CatalogSnapshot {
  plans: SubscriptionPlan[];
  products: Product[];
  loadedAt: number;
}

/** Paket ve ürünler DB'de yönetilir; sık okunduğu için kısa süreli bellek içi cache. */
@Injectable()
export class CatalogService {
  private snapshot: CatalogSnapshot | null = null;

  constructor(private readonly prisma: PrismaService) {}

  invalidate(): void {
    this.snapshot = null;
  }

  private async load(): Promise<CatalogSnapshot> {
    if (this.snapshot && Date.now() - this.snapshot.loadedAt < CACHE_TTL_MS) return this.snapshot;
    const [plans, products] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({ orderBy: [{ sortOrder: 'asc' }, { monthlyPrice: 'asc' }] }),
      this.prisma.product.findMany({ orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] }),
    ]);
    this.snapshot = { plans, products, loadedAt: Date.now() };
    return this.snapshot;
  }

  async catalog(): Promise<CatalogDto> {
    const { plans, products } = await this.load();
    return {
      plans: plans.filter((plan) => plan.active).map(toPlanDto),
      products: products.filter((product) => product.active).map(toProductDto),
    };
  }

  async freePlan(): Promise<SubscriptionPlan> {
    const { plans } = await this.load();
    const free = plans.find((plan) => plan.slug === FREE_PLAN_SLUG);
    if (!free) throw new Error('Free plan tanımlı değil (subscription_plans)');
    return free;
  }

  /** Satın alınabilir (aktif, ücretli) plan. */
  async purchasablePlan(slug: string): Promise<SubscriptionPlan> {
    const { plans } = await this.load();
    const plan = plans.find((item) => item.slug === slug && item.active && item.slug !== FREE_PLAN_SLUG);
    if (!plan) throw AppException.notFound('Paket bulunamadı.');
    return plan;
  }

  async purchasableProduct(slug: string): Promise<Product> {
    const { products } = await this.load();
    const product = products.find((item) => item.slug === slug && item.active);
    if (!product) throw AppException.notFound('Ürün bulunamadı.');
    return product;
  }
}
