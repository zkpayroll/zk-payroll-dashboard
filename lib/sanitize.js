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
  /^proof$/i,
  /session/i,
  /salt/i,
  /merkle/i,
  /nullifier/i,
  /commitment/i,
  /privateinput/i,
  /private_input/i,
  /publicinput/i,
  /public_input/i,
  /seed/i,
  /mnemonic/i,
  /cipher/i,
];

const SENSITIVE_VALUE_PATTERNS = [
  /S[A-Z2-7]{55}/,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b\d{9}\b/,
];

function isSensitiveKey(key) {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
}

function redactSensitiveValues(text) {
  return SENSITIVE_VALUE_PATTERNS.reduce((acc, pattern) => {
    return acc.replace(pattern, '[REDACTED]');
  }, text);
}

function sanitize(data) {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return redactSensitiveValues(data);
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item));
  }

  const result = {};

  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitize(value);
    } else if (typeof value === 'string') {
      result[key] = redactSensitiveValues(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

module.exports = {
  sanitize,
};
