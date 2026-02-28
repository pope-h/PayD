import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export interface AuditRecord {
  id: number;
  tx_hash: string;
  stellar_created_at: string;
  created_at: string;
  employee_name?: string;
  asset?: string;
  amount?: string;
  status?: string;
  is_contract_event?: boolean;
}

export interface AuditListResponse {
  data: AuditRecord[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AuditListFilters {
  page?: number;
  limit?: number;
  sourceAccount?: string;
  dateStart?: string;
  dateEnd?: string;
  status?: string;
  employeeId?: string;
  asset?: string;
  type?: 'all' | 'transaction' | 'contract_event';
}

export const fetchAuditLogs = async (filters: AuditListFilters = {}): Promise<AuditListResponse> => {
  const { data } = await axios.get<AuditListResponse>(`${API_BASE_URL}/audit`, {
    params: filters,
  });
  return data;
};

export interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  department?: string;
}

export const fetchEmployees = async (): Promise<{ data: Employee[], total: number }> => {
  try {
    const { data } = await axios.get<{ data: Employee[], total: number }>(`${API_BASE_URL}/employees`);
    return data;
  } catch (error) {
    console.error('Failed to fetch employees:', error);
    return { data: [], total: 0 };
  }
};
