import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export interface PaymentRecipient {
    walletAddress: string;
    amount: string;
    assetCode: string;
}

export interface PaymentConfig {
    recipients: PaymentRecipient[];
    memo?: string;
}

export interface CreateScheduleInput {
    frequency: 'once' | 'weekly' | 'biweekly' | 'monthly';
    timeOfDay: string;
    startDate: string;
    endDate?: string;
    paymentConfig: PaymentConfig;
}

export interface ScheduleRecord {
    id: number;
    frequency: string;
    timeOfDay: string;
    startDate: string;
    endDate?: string;
    nextRunTimestamp: string;
    lastRunTimestamp?: string;
    status: 'active' | 'completed' | 'cancelled' | 'failed';
    paymentConfig: PaymentConfig;
    createdAt: string;
}

export interface GetSchedulesResponse {
    schedules: ScheduleRecord[];
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
}

export const createSchedule = async (input: CreateScheduleInput): Promise<ScheduleRecord> => {
    const { data } = await axios.post<ScheduleRecord>(`${API_BASE_URL}/schedules`, input);
    return data;
};

export const getSchedules = async (params: { status?: string; page?: number; limit?: number } = {}): Promise<GetSchedulesResponse> => {
    const { data } = await axios.get<GetSchedulesResponse>(`${API_BASE_URL}/schedules`, {
        params,
    });
    return data;
};

export const deleteSchedule = async (id: number): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/schedules/${id}`);
};
