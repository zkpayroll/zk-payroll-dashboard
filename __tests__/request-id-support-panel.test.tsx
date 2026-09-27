import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  isValidRequestId,
  generateSupportDiagnosticBundle,
  SupportDiagnosticContext,
} from '@/lib/observability/requestIdPanel';
import { RequestIdSupportPanel } from '@/components/features/errors/RequestIdSupportPanel';

const mockContext: SupportDiagnosticContext = {
  requestId: 'req_20260928_88f91a',
  timestamp: '2026-09-28T00:15:00.000Z',
  environment: 'mainnet',
  operation: 'SUBMIT_PAYROLL_BATCH',
  statusCode: 422,
  errorMessage: 'Validation failed on preflight check',
};

describe('requestIdPanel utilities', () => {
  it('validates request IDs correctly', () => {
    expect(isValidRequestId('req_20260928_88f91a')).toBe(true);
    expect(isValidRequestId('abc12345')).toBe(true);
    expect(isValidRequestId('short')).toBe(false);
    expect(isValidRequestId('')).toBe(false);
  });

  it('generates sanitized support diagnostic bundle', () => {
    const bundle = generateSupportDiagnosticBundle(mockContext);
    expect(bundle).toContain('Request ID: req_20260928_88f91a');
    expect(bundle).toContain('Environment: mainnet');
    expect(bundle).toContain('Operation: SUBMIT_PAYROLL_BATCH');
    expect(bundle).toContain('Status Code: 422');
    expect(bundle).toContain('Privacy Guarantee');
  });

  it('ensures diagnostic bundle never exposes salary or SSN data', () => {
    const contextWithSalary: SupportDiagnosticContext = {
      ...mockContext,
      metadata: { salaryAmount: 50000, employeeSsn: '123-45-6789' },
    };
    const bundle = generateSupportDiagnosticBundle(contextWithSalary);
    expect(bundle).not.toContain('50000');
    expect(bundle).not.toContain('123-45-6789');
    expect(bundle).toContain('[REDACTED]');
  });
});

describe('RequestIdSupportPanel Component', () => {
  it('renders request ID and support panel information', () => {
    render(<RequestIdSupportPanel context={mockContext} />);
    expect(screen.getByText('Support Diagnostic Panel')).toBeInTheDocument();
    expect(screen.getByText('req_20260928_88f91a')).toBeInTheDocument();
    expect(screen.getByText('SUBMIT_PAYROLL_BATCH')).toBeInTheDocument();
    expect(screen.getByText('Privacy Assured:')).toBeInTheDocument();
  });

  it('handles copying request ID to clipboard', async () => {
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    render(<RequestIdSupportPanel context={mockContext} />);

    const copyBtn = screen.getByRole('button', { name: /copy request id/i });
    fireEvent.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith('req_20260928_88f91a');
    await waitFor(() => {
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });
  });

  it('handles copying full diagnostic bundle', async () => {
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    render(<RequestIdSupportPanel context={mockContext} />);

    const copyBundleBtn = screen.getByRole('button', { name: /copy support diagnostic bundle/i });
    fireEvent.click(copyBundleBtn);

    expect(writeTextSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByText('Bundle Copied!')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<RequestIdSupportPanel context={mockContext} onClose={handleClose} />);

    const closeBtn = screen.getByRole('button', { name: /close support panel/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
