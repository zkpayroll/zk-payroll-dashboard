const { sanitize } = require('../sanitize');

function calculatePeriodHealth(metrics) {
  const blockers = [];
  const recommendations = [];
  let score = 100;

  // Evaluate funding readiness
  if (metrics.fundingReadinessPercentage < 50) {
    score -= 35;
    blockers.push('Treasury funding readiness is below 50%.');
    recommendations.push('Replenish treasury account before scheduled cutoff.');
  } else if (metrics.fundingReadinessPercentage < 80) {
    score -= 15;
    recommendations.push('Top up treasury buffer to reach 100% funding readiness.');
  }

  // Evaluate unresolved exceptions
  if (metrics.unresolvedExceptionsCount > 5) {
    score -= 30;
    blockers.push(`${metrics.unresolvedExceptionsCount} unresolved payroll exceptions require immediate triage.`);
    recommendations.push('Review and resolve exceptions in the Exception Triage drawer.');
  } else if (metrics.unresolvedExceptionsCount > 0) {
    score -= 15;
    blockers.push(`${metrics.unresolvedExceptionsCount} unresolved payroll exception(s).`);
    recommendations.push('Resolve open exceptions before final period settlement.');
  }

  // Evaluate pending approvals near cutoff
  if (metrics.pendingApprovalsCount > 0 && metrics.daysUntilCutoff <= 1) {
    score -= 20;
    blockers.push(`${metrics.pendingApprovalsCount} pending approval(s) with cutoff in <= 24 hours.`);
    recommendations.push('Notify designated signers to approve pending batches.');
  } else if (metrics.pendingApprovalsCount > 0) {
    score -= 10;
    recommendations.push(`Complete ${metrics.pendingApprovalsCount} pending approval(s).`);
  }

  const finalScore = Math.max(0, Math.min(100, score));

  let status = 'healthy';
  let statusBadgeText = 'Healthy';

  if (finalScore < 60 || metrics.fundingReadinessPercentage < 50 || metrics.unresolvedExceptionsCount > 5) {
    status = 'critical';
    statusBadgeText = 'Critical';
  } else if (finalScore < 85 || blockers.length > 0) {
    status = 'warning';
    statusBadgeText = 'Needs Attention';
  }

  const summaryMessage = sanitize(
    status === 'healthy'
      ? 'Payroll period is on track for timely settlement.'
      : status === 'warning'
      ? 'Payroll period has open items that should be resolved before cutoff.'
      : 'Critical blockers detected. Immediate operator action required to prevent execution failure.'
  );

  return {
    periodId: metrics.periodId,
    periodLabel: sanitize(metrics.periodLabel),
    status,
    healthScore: finalScore,
    statusBadgeText,
    summaryMessage,
    blockers: blockers.map((b) => sanitize(b)),
    recommendations: recommendations.map((r) => sanitize(r)),
  };
}

module.exports = {
  calculatePeriodHealth,
};
