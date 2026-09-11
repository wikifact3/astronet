import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../../database/entities/plan.entity';

export interface PlanPublic {
  id: string;
  name: string;
  speedMbps: number;
  basePrice: number;
  vatRate: number;
  tscRate: number;
  vatAmount: number;
  tscAmount: number;
  totalPrice: number;
  fupThresholdGb: number | null;
  bundleAddons: object[];
  displayOrder: number;
}

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
  ) {}

  async listActive(): Promise<PlanPublic[]> {
    const plans = await this.planRepo.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', speedMbps: 'ASC' },
    });
    return plans.map((p) => this.toPublic(p));
  }

  async getById(id: string): Promise<PlanPublic> {
    const plan = await this.planRepo.findOne({ where: { id, isActive: true } });
    if (!plan) throw new NotFoundException('Plan not found');
    return this.toPublic(plan);
  }

  private toPublic(p: Plan): PlanPublic {
    const base = Number(p.basePrice);
    const vat = +(base * (Number(p.vatRate) / 100)).toFixed(2);
    const tsc = +(base * (Number(p.tscRate) / 100)).toFixed(2);
    const total = +(base + vat + tsc).toFixed(2);

    return {
      id: p.id,
      name: p.name,
      speedMbps: p.speedMbps,
      basePrice: base,
      vatRate: Number(p.vatRate),
      tscRate: Number(p.tscRate),
      vatAmount: vat,
      tscAmount: tsc,
      totalPrice: total,
      fupThresholdGb: p.fupThresholdGb ?? null,
      bundleAddons: p.bundleAddons ?? [],
      displayOrder: p.displayOrder,
    };
  }
}
