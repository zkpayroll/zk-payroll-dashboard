const SENSITIVE_PATTERNS = [
  /secret/i,
  /password/i,
  /privatekey/i,
  /private_key/i,
  /ssn/i,
  /salary/i,
  /salaryamount/i,
  /salary_amount/i,
  /token/i,
  /authorization/i,
  /cookie/i,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
}

export function sanitize<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item)) as T;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitize(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
