import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  isAssetDeactivated,
  getDeactivatedAssetWarning,
} from '@/lib/assets/deactivatedAsset';
import { DeactivatedAssetBanner } from '@/components/features/assets/DeactivatedAssetBanner';

describe('deactivatedAsset utilities', () => {
  it('correctly identifies active vs deactivated assets', () => {
    expect(isAssetDeactivated('USDC')).toBe(false);
    expect(isAssetDeactivated('XLM')).toBe(false);
    expect(isAssetDeactivated('USDC_DEPRECATED')).toBe(true);
    expect(isAssetDeactivated('OLD_TOKEN')).toBe(true);
  });

  it('generates clear warning info for deactivated assets', () => {
    const warning = getDeactivatedAssetWarning('USDC_DEPRECATED');
    expect(warning.isDeactivated).toBe(true);
    expect(warning.title).toContain('USDC_DEPRECATED');
    expect(warning.message).toContain('deactivated');
    expect(warning.remediation).toContain('Select an active settlement asset');
  });

  it('returns clean inactive state for active assets', () => {
    const warning = getDeactivatedAssetWarning('USDC');
    expect(warning.isDeactivated).toBe(false);
  });

  it('ensures warnings do not leak salary or employee PII', () => {
    const warning = getDeactivatedAssetWarning('OLD_TOKEN');
    expect(warning.message).not.toMatch(/salary/i);
    expect(warning.message).not.toMatch(/ssn/i);
    expect(warning.remediation).not.toMatch(/salary/i);
  });
});

describe('DeactivatedAssetBanner Component', () => {
  it('does not render when asset is active', () => {
    const { container } = render(<DeactivatedAssetBanner assetSymbol="USDC" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders alert banner when asset is deactivated', () => {
    render(<DeactivatedAssetBanner assetSymbol="USDC_DEPRECATED" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Deactivated Asset Alert: USDC_DEPRECATED/i)).toBeInTheDocument();
    expect(screen.getByText(/Recommended Action:/i)).toBeInTheDocument();
  });

  it('triggers onSwitchAsset callback when action button is clicked', () => {
    const handleSwitch = vi.fn();
    render(
      <DeactivatedAssetBanner
        assetSymbol="USDC_DEPRECATED"
        onSwitchAsset={handleSwitch}
      />
    );

    const button = screen.getByRole('button', { name: /switch asset configuration/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleSwitch).toHaveBeenCalledTimes(1);
  });
});
