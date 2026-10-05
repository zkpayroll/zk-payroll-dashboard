import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminOverview from '@/components/features/admin/AdminOverview';

describe('AdminOverview', () => {
  it('renders the section heading', () => {
    render(<AdminOverview />);
    expect(screen.getByRole('region', { name: /admin overview/i })).toBeInTheDocument();
    expect(screen.getByText('Admin Overview')).toBeInTheDocument();
  });

  it('renders company status card', () => {
    render(<AdminOverview />);
    expect(screen.getByText('Company status')).toBeInTheDocument();
  });

  it('renders treasury balance card', () => {
    render(<AdminOverview />);
    expect(screen.getByText('Treasury balance')).toBeInTheDocument();
  });

  it('renders active employees card', () => {
    render(<AdminOverview />);
    expect(screen.getByText('Active employees')).toBeInTheDocument();
  });

  it('renders pending actions card', () => {
    render(<AdminOverview />);
    expect(screen.getByText('Pending actions')).toBeInTheDocument();
  });

  it('renders the pending transaction monitor', () => {
    render(<AdminOverview />);
    expect(screen.getByRole('heading', { name: /pending transaction monitor/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /view explorer/i }).length).toBeGreaterThan(0);
  });

  it('links treasury card to /history', () => {
    render(<AdminOverview />);
    const links = screen.getAllByRole('link', { name: /view details/i });
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/history');
  });

  it('links employees card to /employees', () => {
    render(<AdminOverview />);
    const links = screen.getAllByRole('link', { name: /view details/i });
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/employees');
  });

  it('renders 4 stat cards on a desktop-like layout', () => {
    render(<AdminOverview />);
    const links = screen.getAllByRole('link', { name: /view details/i });
    expect(links.length).toBe(4);
  });
});
