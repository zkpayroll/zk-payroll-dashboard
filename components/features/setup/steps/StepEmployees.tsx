"use client";

import { useState } from "react";
import { Users, Plus } from "lucide-react";
import { useEmployeeStore } from "@/stores/employees";
import { AddEmployeeModal } from "@/components/features/employees/AddEmployeeModal";

interface StepEmployeesProps {
  onNext: () => void;
  onBack: () => void;
}

export default function StepEmployees({ onNext, onBack }: StepEmployeesProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { employees } = useEmployeeStore();

  const hasEmployees = employees.length > 0;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Add Employees</h2>
        <p className="text-sm text-gray-500 mt-2">
          Add your first employee to start running payroll. You can also skip this and do it later.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-100 rounded-lg space-y-4">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
          <Users className="w-8 h-8 text-indigo-600" />
        </div>
        
        {hasEmployees ? (
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-green-700">
              {employees.length} employee{employees.length !== 1 ? 's' : ''} added!
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Add another
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Employee
          </button>
        )}
      </div>

      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          Back
        </button>
        <div className="flex gap-3">
          {!hasEmployees && (
            <button
              onClick={onNext}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Skip for now
            </button>
          )}
          <button
            onClick={onNext}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {hasEmployees ? "Continue" : "Next"}
          </button>
        </div>
      </div>

      <AddEmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
