import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PayrollSummary from '@/components/PayrollSummary';

describe('PayrollSummary', () => {
  it('renders all three summary cards', () => {
    render(<PayrollSummary />);

    expect(screen.getByText('Total Payroll')).toBeInTheDocument();
    expect(screen.getByText('$124,500')).toBeInTheDocument();

    expect(screen.getByText('Active Employees')).toBeInTheDocument();
    expect(screen.getByText('48')).toBeInTheDocument();

    expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('displays status indicators', () => {
    render(<PayrollSummary />);

    expect(screen.getByText('+12% from last month')).toBeInTheDocument();
    expect(screen.getByText('2 new this week')).toBeInTheDocument();
    expect(screen.getByText('Action required')).toBeInTheDocument();
  });
});
