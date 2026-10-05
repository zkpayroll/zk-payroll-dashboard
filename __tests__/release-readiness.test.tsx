import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReleaseReadinessChecklist from '@/components/features/maintainers/ReleaseReadinessChecklist';
import { useReleaseReadinessStore } from '@/stores/releaseReadiness';

describe('ReleaseReadinessChecklist', () => {
  beforeEach(() => {
    useReleaseReadinessStore.setState({
      items: [
        { id: 'ci', section: 'CI', label: 'CI passing', status: 'pending' },
        { id: 'docs', section: 'Docs', label: 'Docs updated', status: 'pending' },
      ],
    });
  });

  it('renders all checklist items', () => {
    render(<ReleaseReadinessChecklist />);
    expect(screen.getByText('CI passing')).toBeInTheDocument();
    expect(screen.getByText('Docs updated')).toBeInTheDocument();
  });

  it('shows in progress when not all passed', () => {
    render(<ReleaseReadinessChecklist />);
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('shows ready when all passed', () => {
    useReleaseReadinessStore.setState({
      items: [
        { id: 'ci', section: 'CI', label: 'CI passing', status: 'passed' },
        { id: 'docs', section: 'Docs', label: 'Docs updated', status: 'passed' },
      ],
    });
    render(<ReleaseReadinessChecklist />);
    expect(screen.getByText('Ready for release')).toBeInTheDocument();
  });

  it('shows blockers', () => {
    useReleaseReadinessStore.setState({
      items: [
        { id: 'ci', section: 'CI', label: 'CI passing', status: 'blocked' },
        { id: 'docs', section: 'Docs', label: 'Docs updated', status: 'pending' },
      ],
    });
    render(<ReleaseReadinessChecklist />);
    expect(screen.getByText(/Blockers/)).toBeInTheDocument();
    expect(screen.getAllByText('CI passing')[0]).toBeInTheDocument();
  });


  it('allows status change', () => {
    render(<ReleaseReadinessChecklist />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'passed' } });
    expect(useReleaseReadinessStore.getState().items[0].status).toBe('passed');
  });

  it('allows notes update', () => {
    render(<ReleaseReadinessChecklist />);
    const inputs = screen.getAllByPlaceholderText('Notes');
    fireEvent.change(inputs[0], { target: { value: 'All green' } });
    expect(useReleaseReadinessStore.getState().items[0].notes).toBe('All green');
  });
});
