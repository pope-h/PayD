import { DateTime } from 'luxon';
import { pool } from '../../config/database.js';
import taxService from '../taxService.js';
import tenantConfigService from '../tenantConfigService.js';
import { BalanceService } from '../balanceService.js';
import { FxRateService } from './fxRateService.js';

export type LiquidityStatus = 'green' | 'yellow' | 'red';

export interface ForecastRun {
  runTimestamp: string;
  scheduleId: number;
  grossAmount: number;
  taxAmount: number;
  benefitsAmount: number;
  totalLiability: number;
  assetCode: string;
  assetIssuer: string;
}

export interface ForecastMonthlyPoint {
  month: string;
  projectedTotalLiability: number;
  actualTotalCost?: number;
}

export interface ForecastResponse {
  organizationId: number;
  monthsForward: number;
  nextRuns: ForecastRun[];
  liquidity: {
    status: LiquidityStatus;
    availableBalance: number;
    requiredNext2Runs: number;
    shortfallNext2Runs: number;
    assetCode: string;
    assetIssuer: string;
    distributionAccount: string;
  };
  fxRisk?: {
    baseCurrency: string;
    quoteCurrency: string;
    dailyVolatility: number | null;
    points: Array<{ rateDate: string; rate: number }>;
  };
  monthly: ForecastMonthlyPoint[];
}

interface LiquiditySettings {
  distributionAccount: string;
  assetIssuer: string;
  assetCode?: string;
  benefitsRatePct?: number;
  yellowBufferPct?: number;
}

export class ForecastingService {
  static async getForecast(organizationId: number, monthsForward: number): Promise<ForecastResponse> {
    const liquiditySettings = (await tenantConfigService.getConfig(
      organizationId,
      'liquidity_settings'
    )) as LiquiditySettings | null;

    if (!liquiditySettings?.distributionAccount || !liquiditySettings.assetIssuer) {
      const err = new Error('Missing liquidity_settings configuration') as any;
      err.statusCode = 400;
      throw err;
    }

    const assetCode = (liquiditySettings.assetCode || 'ORGUSD').toUpperCase();
    const assetIssuer = liquiditySettings.assetIssuer;
    const benefitsRatePct = Number(liquiditySettings.benefitsRatePct ?? 0);
    const yellowBufferPct = Number(liquiditySettings.yellowBufferPct ?? 10);

    const schedules = await this.getActiveSchedules(organizationId);

    const nextRunsAll: ForecastRun[] = [];
    const now = DateTime.utc();
    const end = now.plus({ months: monthsForward });

    for (const schedule of schedules) {
      const occurrences = this.generateOccurrences(schedule, now, end);
      for (const occ of occurrences) {
        const runTimestamp = occ.toISO() ?? occ.toUTC().toISO() ?? new Date().toISOString();
        const grossAmount = this.sumRecipients(schedule.paymentConfig?.recipients || []);
        const taxResult = await taxService.calculateDeductions(organizationId, grossAmount);
        const taxAmount = Number(taxResult.total_tax);
        const benefitsAmount = Number(((grossAmount * benefitsRatePct) / 100).toFixed(7));
        const totalLiability = Number((grossAmount + taxAmount + benefitsAmount).toFixed(7));

        nextRunsAll.push({
          runTimestamp,
          scheduleId: schedule.id,
          grossAmount,
          taxAmount,
          benefitsAmount,
          totalLiability,
          assetCode,
          assetIssuer,
        });
      }
    }

    nextRunsAll.sort((a, b) => new Date(a.runTimestamp).getTime() - new Date(b.runTimestamp).getTime());

    const next2 = nextRunsAll.slice(0, 2);
    const requiredNext2Runs = Number(next2.reduce((s, r) => s + r.totalLiability, 0).toFixed(7));

    const availableBalance = await this.getAvailableBalance(
      liquiditySettings.distributionAccount,
      assetCode,
      assetIssuer
    );

    const bufferRequired = Number(((requiredNext2Runs * yellowBufferPct) / 100).toFixed(7));
    const requiredWithBuffer = Number((requiredNext2Runs + bufferRequired).toFixed(7));

    const shortfallNext2Runs = Number(Math.max(0, requiredNext2Runs - availableBalance).toFixed(7));

    let status: LiquidityStatus = 'green';
    if (availableBalance < requiredNext2Runs) status = 'red';
    else if (availableBalance < requiredWithBuffer) status = 'yellow';

    const monthly = this.groupMonthly(nextRunsAll);

    const fxRisk = await this.getFxRisk(organizationId);

    return {
      organizationId,
      monthsForward,
      nextRuns: nextRunsAll,
      liquidity: {
        status,
        availableBalance,
        requiredNext2Runs,
        shortfallNext2Runs,
        assetCode,
        assetIssuer,
        distributionAccount: liquiditySettings.distributionAccount,
      },
      fxRisk,
      monthly,
    };
  }

  private static async getActiveSchedules(organizationId: number): Promise<any[]> {
    const result = await pool.query(
      `SELECT id, organization_id as "organizationId", frequency, time_of_day as "timeOfDay", start_date as "startDate",
              end_date as "endDate", payment_config as "paymentConfig", timezone, next_run_timestamp as "nextRunTimestamp",
              status
       FROM schedules
       WHERE organization_id = $1 AND status = 'active'
       ORDER BY next_run_timestamp ASC`,
      [organizationId]
    );

    return result.rows.map((r: any) => ({
      ...r,
      startDate: new Date(r.startDate),
      endDate: r.endDate ? new Date(r.endDate) : undefined,
      nextRunTimestamp: new Date(r.nextRunTimestamp),
    }));
  }

  private static generateOccurrences(schedule: any, from: DateTime, to: DateTime): DateTime[] {
    const occurrences: DateTime[] = [];

    const timezone = schedule.timezone || 'UTC';
    const nextRun = DateTime.fromJSDate(new Date(schedule.nextRunTimestamp), { zone: 'utc' });

    let cursor = nextRun;
    while (cursor <= to) {
      if (cursor >= from) occurrences.push(cursor);

      if (schedule.frequency === 'once') break;
      if (schedule.frequency === 'weekly') cursor = cursor.plus({ weeks: 1 });
      else if (schedule.frequency === 'biweekly') cursor = cursor.plus({ weeks: 2 });
      else if (schedule.frequency === 'monthly') cursor = cursor.plus({ months: 1 });
      else break;

      cursor = cursor.setZone(timezone).toUTC();
    }

    return occurrences;
  }

  private static sumRecipients(recipients: Array<{ amount: string }>): number {
    return Number(
      recipients
        .reduce((sum, r) => sum + (isNaN(parseFloat(r.amount)) ? 0 : parseFloat(r.amount)), 0)
        .toFixed(7)
    );
  }

  private static groupMonthly(runs: ForecastRun[]): ForecastMonthlyPoint[] {
    const byMonth = new Map<string, number>();

    for (const run of runs) {
      const month = run.runTimestamp.slice(0, 7);
      byMonth.set(month, Number(((byMonth.get(month) || 0) + run.totalLiability).toFixed(7)));
    }

    return Array.from(byMonth.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([month, projectedTotalLiability]) => ({ month, projectedTotalLiability }));
  }

  private static async getAvailableBalance(
    distributionAccount: string,
    assetCode: string,
    assetIssuer: string
  ): Promise<number> {
    if (assetCode === 'XLM') {
      const server = (await import('../stellarService.js')).StellarService.getServer();
      const account = await server.loadAccount(distributionAccount);
      const native = account.balances.find((b: any) => b.asset_type === 'native');
      return Number(parseFloat((native as any)?.balance || '0').toFixed(7));
    }

    if (assetCode === 'ORGUSD') {
      const { balance } = await BalanceService.getOrgUsdBalance(distributionAccount, assetIssuer);
      return Number(parseFloat(balance).toFixed(7));
    }

    const server = (await import('../stellarService.js')).StellarService.getServer();
    const account = await server.loadAccount(distributionAccount);
    const entry = account.balances.find(
      (b: any) =>
        b.asset_type !== 'native' &&
        b.asset_code === assetCode &&
        (assetIssuer ? b.asset_issuer === assetIssuer : true)
    );

    return Number(parseFloat((entry as any)?.balance || '0').toFixed(7));
  }

  private static async getFxRisk(organizationId: number): Promise<ForecastResponse['fxRisk']> {
    const paymentSettings = (await tenantConfigService.getConfig(
      organizationId,
      'payment_settings'
    )) as any;

    const baseCurrency = String(paymentSettings?.default_currency || 'USD').toUpperCase();
    const quoteCurrency = 'USD';

    if (baseCurrency === quoteCurrency) {
      return {
        baseCurrency,
        quoteCurrency,
        dailyVolatility: null,
        points: [],
      };
    }

    const end = DateTime.utc();
    const start = end.minus({ days: 90 });
    const points = await FxRateService.getDailyRates(
      baseCurrency,
      quoteCurrency,
      start.toISODate()!,
      end.toISODate()!
    );

    const dailyVolatility = FxRateService.calculateDailyReturnsVolatility(points);

    return {
      baseCurrency,
      quoteCurrency,
      dailyVolatility,
      points,
    };
  }
}
