import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OperationsCommandCenter from '@/components/features/operations/OperationsCommandCenter';
import { useOperationsStore } from '@/stores/operations';

describe('OperationsCommandCenter', () => {
  beforeEach(() => {
    useOperationsStore.setState({
      cards: [
        { id: '1', title: 'Treasury', description: 'OK', state: 'healthy', link: '/treasury' },
        { id: '2', title: 'Failed Run', description: 'Failed', state: 'blocked', link: '/recovery' },
      ],
      filter: 'all',
    });
  });

  it('renders all cards', () => {
    render(<OperationsCommandCenter />);
    expect(screen.getByText('Treasury')).toBeInTheDocument();
    expect(screen.getByText('Failed Run')).toBeInTheDocument();
  });

  it('filters by state', () => {
    render(<OperationsCommandCenter />);
    fireEvent.click(screen.getByText('Blocked'));
    expect(screen.getByText('Failed Run')).toBeInTheDocument();
    expect(screen.queryByText('Treasury')).not.toBeInTheDocument();
  });

  it('shows empty state', () => {
    useOperationsStore.setState({ cards: [], filter: 'all' });
    render(<OperationsCommandCenter />);
    expect(screen.getByText('No items match this filter.')).toBeInTheDocument();
  });
});
