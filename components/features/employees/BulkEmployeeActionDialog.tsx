"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Shield, AlertTriangle, Loader2, Users, UserCheck, UserX } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { useEmployeeStore } from "@/stores/employees";
import type { Employee } from "@/types/models";

interface BulkEmployeeActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  action: "activate" | "deactivate" | "delete";
  employees?: Employee[];
}

export function BulkEmployeeActionDialog({
  isOpen,
  onClose,
  action,
  employees = [],
}: BulkEmployeeActionDialogProps) {
  const { updateEmployee } = useEmployeeStore();
  const router = useRouter();
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(
    employees.length > 0 ? new Set(employees.map(e => e.id)) : new Set()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'confirm' | 'success'>('select');
  const storeEmployees = useEmployeeStore(state => state.employees);

  const actionConfig = {
    activate: {
      title: 'Bulk Activate Employees',
      description: 'Activate selected employees, restoring their access and payroll eligibility.',
      warning: 'This will restore access to all selected employees immediately. They will receive payroll allocations in the next run.',
      icon: UserCheck,
      dialogIcon: "shield" as const,
      confirmText: 'Activate Employees',
      variant: 'info' as const,
    },
    deactivate: {
      title: 'Bulk Deactivate Employees',
      description: 'Deactivate selected employees, revoking their access and payroll eligibility.',
      warning: 'This will revoke access for all selected employees. They will not receive payroll in the next run and cannot be reactivated without admin approval.',
      icon: UserX,
      dialogIcon: "warning" as const,
      confirmText: 'Deactivate Employees',
      variant: 'warning' as const,
    },
    delete: {
      title: 'Bulk Delete Employees',
      description: 'Permanently remove selected employees from the system.',
      warning: 'This will permanently delete employee records. All associated data, salary commitments, and audit trails will be retained for compliance but employee access will be revoked.',
      icon: UserX,
      dialogIcon: "alert" as const,
      confirmText: 'Delete Employees',
      variant: 'danger' as const,
    },
  };

  const config = actionConfig[action];
  const allEmployees = employees.length > 0 ? employees : storeEmployees;
  const activeEmployees = allEmployees.filter(e => e.isActive && e.status !== 'inactive');
  const selectedEmployeesArray = allEmployees.filter(e => 
    employees.length > 0 ? selectedEmployees.has(e.id) : e.isActive && selectedEmployees.has(e.id)
  );

  const getStatusChangeText = () => {
    switch (action) {
      case 'activate': return 'Active → Active';
      case 'deactivate': return 'Active → Inactive';
      case 'delete': return 'Active → Deleted';
    }
  };

  const handleEmployeeToggle = (employeeId: string) => {
    setSelectedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedEmployees.size === activeEmployees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(activeEmployees.map(e => e.id)));
    }
  };

  const handleProceed = () => {
    if (selectedEmployees.size === 0) return;
    setStep('confirm');
  };

  const handleConfirm = async (reason?: string) => {
    if (!reason) {
      throw new Error('Please provide a reason for this action');
    }

    setIsLoading(true);
    try {
      await Promise.all(
        Array.from(selectedEmployees).map(id => {
          switch (action) {
            case 'activate':
              return updateEmployee(id, {
                isActive: true,
                status: 'active',
              });
            case 'deactivate':
              return updateEmployee(id, {
                isActive: false,
                status: 'inactive',
              });
            case 'delete':
              return updateEmployee(id, {
                isActive: false,
                status: 'inactive',
              });
          }
        })
      );
      
      setStep('success');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep('select');
      setSelectedEmployees(new Set());
    }, 300);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getActionIconColor = () => {
    switch (action) {
      case 'activate': return 'text-green-600';
      case 'deactivate': return 'text-amber-600';
      case 'delete': return 'text-red-600';
    }
  };

  return (
    <ConfirmationDialog
      title={config.title}
      description={
        step === 'select' 
          ? config.description
          : step === 'confirm'
          ? `Are you sure you want to ${action} ${selectedEmployeesArray.length} employee${selectedEmployeesArray.length !== 1 ? 's' : ''}? This action will affect multiple employees simultaneously.`
          : `Employee action completed successfully for ${selectedEmployeesArray.length} employee${selectedEmployeesArray.length !== 1 ? 's' : 's'}.`
      }
      warning={step === 'select' ? config.warning : undefined}
      confirmText={step === 'confirm' ? config.confirmText : 'Done'}
      cancelText={step === 'success' ? 'Close' : 'Cancel'}
      variant={config.variant}
      icon={config.dialogIcon}
      isOpen={isOpen}
      onConfirm={step === 'confirm' ? (reason) => handleConfirm(reason) : async () => {}}
      onCancel={step === 'success' ? handleClose : handleClose}
      isLoading={isLoading}
      showReasonField={step === 'confirm'}
      reasonLabel="Action Reason"
      reasonPlaceholder="e.g., Promotional change, policy violation, termination, etc..."
    >
      {step === 'select' && (
        <div className="space-y-4">
          <div className={`flex items-start gap-3 p-4 rounded-lg ${
            action === 'activate' ? 'bg-green-50 border border-green-200' :
            action === 'deactivate' ? 'bg-amber-50 border border-amber-200' :
            'bg-red-50 border border-red-200'
          }`}
          >
            <config.icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${getActionIconColor()}`} />
            <div>
              <h4 className={`text-sm font-semibold ${
                action === 'activate' ? 'text-green-800' :
                action === 'deactivate' ? 'text-amber-800' :
                'text-red-800'
              }`}
              >
                {action.charAt(0).toUpperCase() + action.slice(1)} Employees
              </h4>
              <p className={`text-xs mt-1 ${
                action === 'activate' ? 'text-green-700' :
                action === 'deactivate' ? 'text-amber-700' :
                'text-red-700'
              }`}
              >
                {action === 'activate' ? 'Restores access and payroll eligibility.' :
                 action === 'deactivate' ? 'Revokes access and payroll eligibility.' :
                 'Permanently removes from system.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {activeEmployees.length} active employee{activeEmployees.length !== 1 ? 's' : ''} available
            </div>
            <button
              onClick={handleSelectAll}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              {selectedEmployees.size === activeEmployees.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {activeEmployees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No active employees to {action}.</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
              {activeEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center p-4 hover:bg-gray-50 cursor-pointer select-none"
                >
                  <input
                    id={`employee-action-${employee.id}`}
                    type="checkbox"
                    checked={selectedEmployees.has(employee.id)}
                    onChange={() => handleEmployeeToggle(employee.id)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded mr-3"
                  />
                  <label htmlFor={`employee-action-${employee.id}`} className="flex-1 min-w-0 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {employee.name}
                      </p>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 ml-2">
                        {getStatusChangeText()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {employee.department ?? 'No department'} • ${employee.salary?.toLocaleString()}/month
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Since {formatDate(employee.startDate)}
                    </p>
                  </label>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleProceed}
            disabled={selectedEmployees.size === 0}
            className={`w-full py-2 px-4 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed ${config.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' :
              config.variant === 'warning' ? 'bg-amber-600 text-white hover:bg-amber-700' :
              'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            Review Changes ({selectedEmployees.size} selected)
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div className={`rounded-lg p-4 border ${config.variant === 'danger' ? 'bg-red-50 border-red-200' :
          config.variant === 'warning' ? 'bg-amber-50 border-amber-200' :
          'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
              config.variant === 'danger' ? 'text-red-600' :
              config.variant === 'warning' ? 'text-amber-600' :
              'text-green-600'
            }`} />
            <div>
              <h4 className={`text-sm font-semibold ${
                config.variant === 'danger' ? 'text-red-800' :
                config.variant === 'warning' ? 'text-amber-800' :
                'text-green-800'
              }`}
              >
                Confirmation Required
              </h4>
              <p className={`text-sm mt-1 ${
                config.variant === 'danger' ? 'text-red-700' :
                config.variant === 'warning' ? 'text-amber-700' :
                'text-green-700'
              }`}
              >
                This will {action} {selectedEmployeesArray.length} employee{selectedEmployeesArray.length !== 1 ? 's' : ''} simultaneously. Changes cannot be undone for deleted employees.
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className={`rounded-lg p-4 border ${config.variant === 'danger' ? 'bg-red-50 border-red-200' :
          config.variant === 'warning' ? 'bg-amber-50 border-amber-200' :
          'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-start gap-3">
            <config.icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${getActionIconColor()}`} />
            <div>
              <h4 className={`text-sm font-semibold ${
                config.variant === 'danger' ? 'text-red-800' :
                config.variant === 'warning' ? 'text-amber-800' :
                'text-green-800'
              }`}
              >
                Action Completed
              </h4>
              <p className={`text-sm mt-1 ${
                config.variant === 'danger' ? 'text-red-700' :
                config.variant === 'warning' ? 'text-amber-700' :
                'text-green-700'
              }`}
              >
                {action} action has been completed for {selectedEmployeesArray.length} employee{selectedEmployeesArray.length !== 1 ? 's' : ''}. The system has been updated and logs have been created for compliance.
              </p>
            </div>
          </div>
        </div>
      )}
    </ConfirmationDialog>
  );
}

export default BulkEmployeeActionDialog;
