import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ChecklistStatus = 'pending' | 'passed' | 'blocked';

export interface ReleaseChecklistItem {
  id: string;
  section: string;
  label: string;
  status: ChecklistStatus;
  notes?: string;
}

interface ReleaseReadinessState {
  items: ReleaseChecklistItem[];
  setStatus: (id: string, status: ChecklistStatus) => void;
  setNotes: (id: string, notes: string) => void;
  isReady: () => boolean;
  getBlockers: () => ReleaseChecklistItem[];
}

const initialItems: ReleaseChecklistItem[] = [
  { id: 'ci', section: 'CI', label: 'CI pipeline passing on main', status: 'pending' },
  { id: 'prs', section: 'PRs', label: 'No open PRs requiring review', status: 'pending' },
  { id: 'issues', section: 'Issues', label: 'No critical open issues', status: 'pending' },
  { id: 'docs', section: 'Docs', label: 'Documentation updated', status: 'pending' },
  { id: 'deployments', section: 'Deployments', label: 'Deployment notes ready', status: 'pending' },
  { id: 'demo', section: 'Demo', label: 'Demo evidence collected', status: 'pending' },
];

export const useReleaseReadinessStore = create<ReleaseReadinessState>()(
  persist(
    (set, get) => ({
      items: initialItems,
      setStatus: (id, status) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, status } : item
          ),
        })),
      setNotes: (id, notes) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, notes } : item
          ),
        })),
      isReady: () => get().items.every((item) => item.status === 'passed'),
      getBlockers: () => get().items.filter((item) => item.status === 'blocked'),
    }),
    { name: 'zk-payroll-release-readiness' }
  )
);
