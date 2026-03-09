import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export interface ForecastLiquidity {
  status: 'green' | 'yellow' | 'red';
  availableBalance: number;
  requiredNext2Runs: number;
  shortfallNext2Runs: number;
  assetCode: string;
  assetIssuer: string;
  distributionAccount: string;
}

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
  liquidity: ForecastLiquidity;
  fxRisk?: {
    baseCurrency: string;
    quoteCurrency: string;
    dailyVolatility: number | null;
    points: Array<{ rateDate: string; rate: number }>;
  };
  monthly: ForecastMonthlyPoint[];
}

export interface LiquiditySettings {
  distributionAccount: string;
  assetIssuer: string;
  assetCode?: string;
  benefitsRatePct?: number;
  yellowBufferPct?: number;
  alertEmails?: string[];
}

function authHeaders() {
  const token = localStorage.getItem('payd_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export const getForecast = async (monthsForward: number = 6): Promise<ForecastResponse> => {
  const { data } = await axios.get<{ success: boolean; data: ForecastResponse }>(
    `${API_BASE_URL}/forecast`,
    {
      params: { monthsForward },
      headers: authHeaders(),
    }
  );
  return data.data;
};

export const getLiquiditySettings = async (): Promise<LiquiditySettings | null> => {
  const { data } = await axios.get<{ success: boolean; data: LiquiditySettings | null }>(
    `${API_BASE_URL}/forecast/settings`,
    {
      headers: authHeaders(),
    }
  );
  return data.data;
};

export const updateLiquiditySettings = async (
  input: LiquiditySettings
): Promise<LiquiditySettings> => {
  const { data } = await axios.put<{ success: boolean; data: LiquiditySettings }>(
    `${API_BASE_URL}/forecast/settings`,
    input,
    { headers: authHeaders() }
  );
  return data.data;
};
