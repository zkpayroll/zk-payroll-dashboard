# Role-Aware Navigation QA Steps

## Successful Path (Admin Role)
1. Log in to the application as an Administrator.
2. Verify that all navigation items are visible in the Sidebar, including "Employees", "Treasury", "Company Setup", and "Settings".
3. Open the Command Palette (`Ctrl/Cmd + K`).
4. Ensure that you see admin-only commands such as "Go to Payroll Policy Editor", "Create New Payroll Run", and "Add New Employee".
5. Execute one of the admin-only commands and confirm that access is granted.

## Edge Case / Restricted Path (Operator & Auditor Roles)
1. Log in to the application as an Operator (or change the role using a mock session if applicable).
2. Check the Sidebar. Verify that "Employees" and "Treasury" are either greyed out (disabled) or not clickable, and that the hover text indicates why access is disabled (e.g., "Treasury controls are admin-only").
3. Ensure that "Company Setup" is completely hidden if it is not in the operator's allowed roles.
4. Open the Command Palette (`Ctrl/Cmd + K`).
5. Ensure that the Current Role shows "Operator" instead of "Admin".
6. Search for an admin-only action, such as "Go to Payroll Policy Editor" or "Create New Payroll Run".
7. These items should appear greyed out with a lock icon.
8. Click on an admin-only action and verify that a toast error appears with "Access Denied" and you are not navigated to the restricted route.
9. Verify the same behavior for an Auditor role, noting that Auditor restrictions apply to actions like executing payroll.

## Employer Company-Access Recovery
1. Open **Switch Company** and verify company choices remain unavailable until the current session role has been checked.
2. With an Admin session, select an active company and confirm the active company context changes.
3. With an Operator or Auditor session, confirm company switching remains blocked and the message offers sign-in to refresh employer permissions.
4. Simulate an unavailable session and confirm the page offers sign-in without showing employee or payroll details.
5. Simulate a temporary session-check failure and confirm retrying the check restores the normal Admin flow when the session is valid.
