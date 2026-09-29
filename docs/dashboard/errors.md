# Dashboard Role Handoff Errors

## Error Codes

### INSUFFICIENT_PERMISSIONS
- **Cause**: User attempting to handoff a role they don't own
- **Details**: Includes expected and actual role owners
- **Recovery**: User must obtain role ownership first

### ROLE_HANDOFF_DISABLED
- **Cause**: Target role has handoffs disabled
- **Details**: Role name and configuration
- **Recovery**: Contact admin to enable handoffs

### PERMISSION_BOUNDARY_VIOLATION
- **Cause**: Target role exceeds user's permission boundaries
- **Details**: Role name and permission boundaries
- **Recovery**: Request boundary expansion or alternative role

### HANDOFF_CONFLICT
- **Cause**: Potential handoff conflict detected
- **Details**: Conflicting handoff metadata
- **Recovery**: Resolve conflict with target role owner