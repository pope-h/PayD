import { pool } from '../../config/database.js';

export interface FxRatePoint {
  rateDate: string;
  rate: number;
}

export class FxRateService {
  static async getDailyRates(
    baseCurrency: string,
    quoteCurrency: string,
    startDate: string,
    endDate: string
  ): Promise<FxRatePoint[]> {
    const result = await pool.query(
      `SELECT rate_date, rate
       FROM fx_rates
       WHERE base_currency = $1
         AND quote_currency = $2
         AND rate_date >= $3
         AND rate_date <= $4
       ORDER BY rate_date ASC`,
      [baseCurrency.toUpperCase(), quoteCurrency.toUpperCase(), startDate, endDate]
    );

    return result.rows.map((r: any) => ({
      rateDate: new Date(r.rate_date).toISOString().slice(0, 10),
      rate: Number(r.rate),
    }));
  }

  static calculateDailyReturnsVolatility(rates: FxRatePoint[]): number | null {
    if (rates.length < 2) return null;

    const returns: number[] = [];
    for (let i = 1; i < rates.length; i++) {
      const prevPoint = rates[i - 1];
      const currPoint = rates[i];
      if (!prevPoint || !currPoint) continue;
      const prev = prevPoint.rate;
      const curr = currPoint.rate;
      if (prev <= 0 || curr <= 0) continue;
      returns.push(Math.log(curr / prev));
    }

    if (returns.length < 2) return null;

    const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
    const variance =
      returns.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (returns.length - 1);

    return Math.sqrt(variance);
  }
}
