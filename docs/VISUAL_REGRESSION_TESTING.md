# Visual Regression Testing Guide

## Overview

Visual regression testing helps protect the dashboard from unintended UI changes in critical workflows. This guide covers how to work with visual regression tests in the ZK Payroll Dashboard.

## What is Covered

Visual regression tests capture representative states for:

- Dashboard home (connected, disconnected, loading states)
- System status displays
- Pinned alerts and tasks panel
- Onboarding checklist
- Payroll wizard and execution flows
- Payroll run detail views
- Payroll comparison views
- Payroll status badge colours, labels, and contrast
- Compliance screens

## Test Organization

Tests are organized by feature area:

```text
__tests__/visual-regression/
├── dashboard-states.test.tsx           # Dashboard and admin panel states
├── payroll-flow-states.test.tsx        # Payroll execution and history views
├── payroll-status-badges.test.tsx      # Status badge colours, labels, contrast
└── README.md                           # This file
```

## Payroll Status Badges

Status badges are the fastest signal an operator gets from a payroll screen, which makes them easy to break with an unrelated change. A renamed Tailwind token or a palette tidy-up can quietly render a failed run in green.

`src/payroll/statusBadges.ts` is the single source of truth for:

- **Labels** — the wording for each run lifecycle and reconciliation status.
- **Variants** — which `badgeVariants` entry each status uses.
- **Contrast** — the one approved colour pair per variant, plus the WCAG ratio it measures.

`components/ui/StatusBadge.tsx` and `components/features/payroll/ReconciliationBadge.tsx` both read their labels and variants from that contract, so a change has to be made once and is then covered by the suite.

### What the suite asserts

| Check | Guards against |
| --- | --- |
| One snapshot per status | Any unintended change to badge markup, classes, or wording |
| Exact approved background/text classes | A `badge.tsx` variant drifting from the contract |
| WCAG AA ratio per payroll variant | Contrast dropping below 4.5:1 for 12px text |
| No colour collisions within a surface | Two statuses becoming indistinguishable by colour |
| Static, value-free labels | A label leaking an amount, count, or contact detail |
| Rendered text free of digits and currency | A failure badge exposing payroll values |
| Contract covers every declared status | A new status shipping without a badge spec |

### Adding or changing a status

1. Add the label, variant, and approved pair to `src/payroll/statusBadges.ts`.
2. Run the suite and review the new snapshot rather than blind-updating it.
3. Confirm the new colour clears WCAG AA; if it does not, darken the text or lighten the background instead of widening the threshold.

### Known contrast deviation

`destructive` (`bg-red-500` / `text-gray-50`) measures 3.60:1, under the 4.5:1 AA floor. It is recorded in `KNOWN_STATUS_BADGE_CONTRAST_DEVIATIONS` rather than silently tolerated, and the suite fails if a deviation is listed for a colour the payroll badges actually use. It is not part of the payroll badge palette — it is used by the retry toast and the transaction detail drawer — so fixing it is a separate change.

## Running Visual Regression Tests

### Run all visual regression tests

```bash
npm test __tests__/visual-regression
```

### Run specific test suite

```bash
npm test __tests__/visual-regression/dashboard-states.test.tsx
```

### Run with coverage

```bash
npm test -- --coverage __tests__/visual-regression
```

## Working with Snapshots

### Initial Snapshot Creation

When you first run the tests, snapshots will be automatically created:

```bash
npm test __tests__/visual-regression
```

Snapshots are stored in `__tests__/visual-regression/__snapshots__/`

### Updating Snapshots

When intentional UI changes are made, update snapshots:

```bash
npm test -- --update-snapshot __tests__/visual-regression
```

Or use the shorthand:

```bash
npm test -- -u __tests__/visual-regression
```

### Reviewing Snapshot Changes

Before updating snapshots, always:

1. Review the test failure output to understand what changed
2. Visually inspect the component in the browser
3. Confirm the change is intentional
4. Check that accessibility requirements are still met
5. Update the snapshot only after verification

### Best Practices

**DO:**

- Update snapshots when you intentionally change UI
- Review snapshot diffs carefully before committing
- Run visual regression tests before submitting PRs
- Add new test cases for new critical UI states
- Document why snapshot updates were needed in commit messages

**DON'T:**

- Blindly update all snapshots without review
- Commit snapshot changes without understanding them
- Skip visual regression tests in CI
- Remove tests because snapshots are "annoying"

## Adding New Visual Regression Tests

To add coverage for a new component or state:

1. Identify the critical states to capture
2. Add test cases to the appropriate file
3. Mock external dependencies (stores, providers)
4. Render the component in the target state
5. Use `expect(container).toMatchSnapshot()`

### Example

```typescript
describe("Visual Regression - New Feature", () => {
  it("renders feature in loading state", () => {
    const { container } = render(<NewFeature loading={true} />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it("renders feature with data", () => {
    const mockData = { id: "1", name: "Test" };
    const { container } = render(<NewFeature data={mockData} />);
    expect(container).toMatchSnapshot();
  });
});
```

## CI Integration

Visual regression tests run automatically in CI:

- On pull requests
- On pushes to main
- Before deployments

If tests fail in CI:

1. Check the test output in the CI logs
2. Reproduce the failure locally
3. Fix the regression or update the snapshot
4. Push the fix or updated snapshot

## Snapshot Files

Snapshot files are committed to version control. This allows:

- Team review of UI changes in PRs
- Historical tracking of visual changes
- Regression detection across branches

### Snapshot Location

```text
__tests__/visual-regression/__snapshots__/
├── dashboard-states.test.tsx.snap
├── payroll-flow-states.test.tsx.snap
└── payroll-status-badges.test.tsx.snap
```

## Troubleshooting

### Snapshots failing after dependency updates

If snapshots fail after updating dependencies:

1. Check if the component behavior actually changed
2. Review the diff carefully
3. Test the component manually
4. Update snapshot if change is acceptable

### Inconsistent snapshots across environments

If snapshots differ between local and CI:

1. Ensure Node.js versions match
2. Check for environment-specific rendering
3. Mock time-dependent values (dates, timestamps)
4. Use deterministic test data

### Large snapshot diffs

If snapshot diffs are too large to review:

1. Break down the component into smaller testable units
2. Test critical sections separately
3. Use more specific assertions for key elements
4. Consider testing logic separately from visual output

## Performance Considerations

Visual regression tests can be slower than unit tests:

- Mock heavy dependencies to speed up rendering
- Limit snapshot scope to critical components
- Run visual tests separately from fast unit tests
- Use `test.skip()` during development if needed

## Related Documentation

- [Testing Guide](./SETUP_GUIDE.md#testing)
- [Component Development](./ARCHITECTURE.md)
- [CI/CD Pipeline](../.github/workflows/)
