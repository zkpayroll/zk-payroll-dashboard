const { sanitize } = require('../sanitize');

function isValidRequestId(requestId) {
  if (!requestId || typeof requestId !== 'string') return false;
  const trimmed = requestId.trim();
  return trimmed.length >= 8 && /^[a-zA-Z0-9_\-]+$/.test(trimmed);
}

function generateSupportDiagnosticBundle(context) {
  const sanitizedContext = {
    requestId: sanitize(context.requestId || 'UNKNOWN_REQ_ID'),
    timestamp: context.timestamp || new Date().toISOString(),
    environment: sanitize(context.environment || 'production'),
    operation: sanitize(context.operation || 'GENERAL_OPERATION'),
    statusCode: context.statusCode,
    errorMessage: context.errorMessage ? sanitize(context.errorMessage) : undefined,
    metadata: context.metadata ? sanitize(context.metadata) : undefined,
  };

  const lines = [
    '=== ZK Payroll Support Diagnostic Bundle ===',
    `Request ID: ${sanitizedContext.requestId}`,
    `Timestamp: ${sanitizedContext.timestamp}`,
    `Environment: ${sanitizedContext.environment}`,
    `Operation: ${sanitizedContext.operation}`,
  ];

  if (sanitizedContext.statusCode !== undefined) {
    lines.push(`Status Code: ${sanitizedContext.statusCode}`);
  }

  if (sanitizedContext.errorMessage) {
    lines.push(`Error Message: ${sanitizedContext.errorMessage}`);
  }

  if (sanitizedContext.metadata) {
    lines.push(`Metadata: ${JSON.stringify(sanitizedContext.metadata)}`);
  }

  lines.push('============================================');
  lines.push('Privacy Guarantee: Sanitized telemetry trace. No salary, SSN, or employee PII attached.');

  return lines.join('\n');
}

module.exports = {
  isValidRequestId,
  generateSupportDiagnosticBundle,
};
