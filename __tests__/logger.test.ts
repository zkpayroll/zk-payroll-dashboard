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
});
