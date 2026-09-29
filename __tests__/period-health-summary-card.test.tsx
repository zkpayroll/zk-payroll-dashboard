import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { calculatePeriodHealth, PayrollPeriodMetrics } from '@/lib/payroll/periodHealth';
import { PeriodHealthSummaryCard } from '@/components/features/payroll/PeriodHealthSummaryCard';

const mockHealthyMetrics: PayrollPeriodMetrics = {
  periodId: 'period_2026_10_c1',
  periodLabel: 'October 2026 - Cycle 1',
  startDate: '2026-10-01',
  endDate: '2026-10-15',
  totalBatchesCount: 3,
  pendingApprovalsCount: 0,
  unresolvedExceptionsCount: 0,
  fundingReadinessPercentage: 100,
  daysUntilCutoff: 5,
};

const mockCriticalMetrics: PayrollPeriodMetrics = {
  periodId: 'period_2026_10_c2',
  periodLabel: 'October 2026 - Cycle 2',
  startDate: '2026-10-16',
  endDate: '2026-10-31',
  totalBatchesCount: 4,
  pendingApprovalsCount: 2,
  unresolvedExceptionsCount: 6,
  fundingReadinessPercentage: 40,
  daysUntilCutoff: 1,
};

describe('calculatePeriodHealth', () => {
  it('returns healthy status for flawless period metrics', () => {
    const health = calculatePeriodHealth(mockHealthyMetrics);
    expect(health.status).toBe('healthy');
    expect(health.healthScore).toBe(100);
    expect(health.blockers).toHaveLength(0);
  });

  it('detects critical blockers when funding is low and exceptions exist', () => {
    const health = calculatePeriodHealth(mockCriticalMetrics);
    expect(health.status).toBe('critical');
    expect(health.healthScore).toBeLessThan(60);
    expect(health.blockers.length).toBeGreaterThan(0);
    expect(health.blockers.some((b) => b.includes('below 50%'))).toBe(true);
  });

  it('guarantees privacy guardrails in summary messages and blockers', () => {
    const health = calculatePeriodHealth(mockCriticalMetrics);
    health.blockers.forEach((blocker) => {
      expect(blocker).not.toMatch(/salary/i);
      expect(blocker).not.toMatch(/ssn/i);
      expect(blocker).not.toMatch(/employee_name/i);
    });
  });
});

describe('PeriodHealthSummaryCard Component', () => {
  it('renders period label and healthy badge', () => {
    render(<PeriodHealthSummaryCard metrics={mockHealthyMetrics} />);
    expect(screen.getByText('October 2026 - Cycle 1')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders critical blockers and action button when blockers exist', () => {
    const handleResolve = vi.fn();
    render(
      <PeriodHealthSummaryCard
        metrics={mockCriticalMetrics}
        onResolveBlockers={handleResolve}
      />
    );

    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText(/Active Period Blockers/i)).toBeInTheDocument();

    const resolveBtn = screen.getByRole('button', { name: /resolve active blockers/i });
    expect(resolveBtn).toBeInTheDocument();
    fireEvent.click(resolveBtn);
    expect(handleResolve).toHaveBeenCalledTimes(1);
  });
});
