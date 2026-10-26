import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('LOG_LEVEL', 'debug');
  });

  async function getLoggerModule() {
    return import('@/lib/logger');
  }

  it('createLogger returns a logger with all log level methods', async () => {
    const { createLogger } = await getLoggerModule();
    const log = createLogger('test');

    expect(typeof log.debug).toBe('function');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.fatal).toBe('function');
  });

  it('logger scopes context correctly', async () => {
    const { createLogger } = await getLoggerModule();
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const log = createLogger('my-module');
    log.info('test message');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('[my-module]');
    expect(spy.mock.calls[0][0]).toContain('test message');

    spy.mockRestore();
  });

  it('outputs colorized human-readable logs in development', async () => {
    const { createLogger } = await getLoggerModule();
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const log = createLogger('test');
    log.warn('warning message');

    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0];
    expect(output).toContain('[WARN]');
    expect(output).toContain('[test]');
    expect(output).toContain('warning message');

    spy.mockRestore();
  });

  it('outputs JSON-structured logs in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { createLogger } = await getLoggerModule();
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const log = createLogger('api');
    log.info('request received', { method: 'GET' });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.level).toBe('info');
    expect(parsed.context).toBe('api');
    expect(parsed.message).toBe('request received');
    expect(parsed.method).toBe('GET');
    expect(parsed.timestamp).toBeDefined();

    spy.mockRestore();
  });

  it('sanitizes sensitive data in log messages', async () => {
    const { createLogger } = await getLoggerModule();
    vi.stubEnv('NODE_ENV', 'production');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const log = createLogger('test');
    log.warn('Employee SSN is 123-45-6789');

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.message).toBe('Employee SSN is [REDACTED]');

    spy.mockRestore();
  });

  it('sanitizes sensitive metadata in log entries', async () => {
    const { createLogger } = await getLoggerModule();
    vi.stubEnv('NODE_ENV', 'production');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const log = createLogger('test');
    log.info('payroll event', { salary: 50000, employeeSsn: '123-45-6789' });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.salary).toBe('[REDACTED]');
    expect(parsed.employeeSsn).toBe('[REDACTED]');

    spy.mockRestore();
  });

  it('respects LOG_LEVEL and suppresses lower levels', async () => {
    vi.stubEnv('LOG_LEVEL', 'warn');
    const { createLogger } = await getLoggerModule();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const log = createLogger('test');
    log.debug('should not appear');
    log.info('should not appear');
    log.warn('should appear');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('redacts sensitive data in development human-readable output', async () => {
    const { createLogger } = await getLoggerModule();
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const log = createLogger('payroll');
    log.info('processing payment', { accountNumber: '1234567890', routingNumber: '987654321' });

    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0] as string;
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain(1234567890);
    expect(output).not.toContain('987654321');

    spy.mockRestore();
  });

  it('redacts sensitive data in production nested metadata', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { createLogger } = await getLoggerModule();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const log = createLogger('payroll');
    log.error('payment failed', {
      error: 'insufficient funds',
      employee: {
        name: 'John Doe',
        ssn: '123-45-6789',
        bankAccount: '1234567890',
      },
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.error).toBe('insufficient funds');
    expect(parsed.employee.name).toBe('John Doe');
    expect(parsed.employee.ssn).toBe('[REDACTED]');
    expect(parsed.employee.bankAccount).toBe('[REDACTED]');

    spy.mockRestore();
  });

  it('redacts sensitive data in arrays of metadata', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { createLogger } = await getLoggerModule();
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const log = createLogger('payroll');
    log.info('batch processed', {
      employees: [
        { id: 1, ssn: '111-11-1111' },
        { id: 2, ssn: '222-22-2222' },
      ],
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.employees[0].id).toBe(1);
    expect(parsed.employees[0].ssn).toBe('[REDACTED]');
    expect(parsed.employees[1].id).toBe(2);
    expect(parsed.employees[1].ssn).toBe('[REDACTED]');

    spy.mockRestore();
  });

  it('handles circular metadata without throwing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { createLogger } = await getLoggerModule();
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const circular: Record<string, unknown> = { name: 'circular' };
    circular.self = circular;

    const log = createLogger('test');
    expect(() => log.info('circular metadata', circular)).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});
