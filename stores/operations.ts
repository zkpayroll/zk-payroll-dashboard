import { create } from 'zustand';

export type OperationState = 'healthy' | 'urgent' | 'blocked' | 'ready' | 'requires-review';

export interface OperationCard {
  id: string;
  title: string;
  description: string;
  state: OperationState;
  link: string;
}

interface OperationsState {
  cards: OperationCard[];
  filter: OperationState | 'all';
  setFilter: (filter: OperationState | 'all') => void;
}

const initialCards: OperationCard[] = [
  { id: 'payroll-batches', title: 'Pending Payroll Batches', description: '3 batches awaiting execution', state: 'requires-review', link: '/payroll/execute' },
  { id: 'treasury', title: 'Treasury Readiness', description: 'Balance above minimum threshold', state: 'healthy', link: '/treasury' },
  { id: 'audit', title: 'Audit Requests', description: '2 pending access requests', state: 'urgent', link: '/compliance' },
  { id: 'failed-execution', title: 'Failed Execution', description: '1 run failed in last 24h', state: 'blocked', link: '/payroll/recovery' },
  { id: 'approvals', title: 'Pending Approvals', description: '4 items awaiting sign-off', state: 'requires-review', link: '/payroll/approvals' },
];

export const useOperationsStore = create<OperationsState>((set) => ({
  cards: initialCards,
  filter: 'all',
  setFilter: (filter) => set({ filter }),
}));
