import { describe, it, expect } from 'vitest';
import { sanitize } from '@/lib/sanitize';

describe('sanitize', () => {
  it('redacts sensitive fields', () => {
    const data = {
      publicKey: 'GABCDEF',
      secret: 'my-secret-value',
      password: 'hunter2',
      privateKey: 'SXXXX',
    };

    const result = sanitize(data);

    expect(result.publicKey).toBe('GABCDEF');
    expect(result.secret).toBe('[REDACTED]');
    expect(result.password).toBe('[REDACTED]');
    expect(result.privateKey).toBe('[REDACTED]');
  });

  it('passes through non-sensitive fields unchanged', () => {
    const data = {
      name: 'Alice',
      email: 'alice@example.com',
      role: 'admin',
      count: 42,
    };

    const result = sanitize(data);

    expect(result).toEqual(data);
  });

  it('sanitizes nested objects', () => {
    const data = {
      user: {
        name: 'Bob',
        salary: 100000,
        credentials: {
          password: 'secret123',
          publicKey: 'GABCDEF',
        },
      },
    };

    const result = sanitize(data);

    expect(result.user.name).toBe('Bob');
    expect(result.user.salary).toBe('[REDACTED]');
    expect(result.user.credentials.password).toBe('[REDACTED]');
    expect(result.user.credentials.publicKey).toBe('GABCDEF');
  });

  it('sanitizes arrays', () => {
    const data = [
      { name: 'Alice', ssn: '123-45-6789' },
      { name: 'Bob', ssn: '987-65-4321' },
    ];

    const result = sanitize(data);

    expect(result[0].name).toBe('Alice');
    expect(result[0].ssn).toBe('[REDACTED]');
    expect(result[1].name).toBe('Bob');
    expect(result[1].ssn).toBe('[REDACTED]');
  });

  it('handles null and undefined gracefully', () => {
    expect(sanitize(null)).toBeNull();
    expect(sanitize(undefined)).toBeUndefined();
  });

  it('handles primitive values', () => {
    expect(sanitize('hello')).toBe('hello');
    expect(sanitize(42)).toBe(42);
    expect(sanitize(true)).toBe(true);
  });
});
