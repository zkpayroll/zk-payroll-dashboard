"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Clock,
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  Save,
  X,
} from "lucide-react";
import { MOCK_PAYROLL_TEMPLATES, MOCK_EMPLOYEES } from "@/lib/api/mockData";
import type { PayrollTemplate, PayrollFrequency } from "@/types";

// ─── Frequency labels ────────────────────────────────────────────────────────

const FREQUENCY_LABELS: Record<PayrollFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

const FREQUENCY_OPTIONS: PayrollFrequency[] = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getFrequencyDescription(template: PayrollTemplate): string {
  const freq = FREQUENCY_LABELS[template.frequency];
  if (template.frequency === "monthly" && template.dayOfMonth) {
    return `${freq} (day ${template.dayOfMonth})`;
  }
  if (template.frequency === "quarterly" && template.dayOfMonth) {
    return `${freq} (day ${template.dayOfMonth})`;
  }
  if (
    (template.frequency === "weekly" || template.frequency === "biweekly") &&
    template.dayOfWeek !== undefined
  ) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${freq} (${days[template.dayOfWeek]})`;
  }
  return freq;
}

// ─── Empty form state ────────────────────────────────────────────────────────

const EMPTY_FORM: Omit<
  PayrollTemplate,
  "id" | "companyId" | "createdAt" | "updatedAt" | "createdBy" | "lastExecuted" | "nextScheduled"
> = {
  name: "",
  description: "",
  frequency: "monthly",
  employeeIds: [],
  dayOfMonth: 28,
  dayOfWeek: 5,
  isActive: true,
};

// ─── Component ───────────────────────────────────────────────────────────────

function RecurringPayrollTemplateEditor() {
  const [templates, setTemplates] = useState<PayrollTemplate[]>(
    MOCK_PAYROLL_TEMPLATES,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Form helpers ──────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditingId(null);
    setIsCreating(false);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Template name is required.";
    if (form.employeeIds.length === 0)
      errors.employeeIds = "Select at least one employee.";
    if (
      (form.frequency === "monthly" || form.frequency === "quarterly") &&
      (form.dayOfMonth === undefined || form.dayOfMonth < 1 || form.dayOfMonth > 31)
    )
      errors.dayOfMonth = "Day must be between 1 and 31.";
    if (
      (form.frequency === "weekly" || form.frequency === "biweekly") &&
      (form.dayOfWeek === undefined || form.dayOfWeek < 0 || form.dayOfWeek > 6)
    )
      errors.dayOfWeek = "Day of week is required.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    if (isCreating) {
      const newTemplate: PayrollTemplate = {
        id: `tpl_${Date.now()}`,
        companyId: "company_001",
        ...form,
        lastExecuted: null,
        nextScheduled: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
      };
      setTemplates((prev) => [...prev, newTemplate]);
    } else if (editingId) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? { ...t, ...form, updatedAt: new Date().toISOString() }
            : t,
        ),
      );
    }
    resetForm();
  };

  const handleEdit = (template: PayrollTemplate) => {
    setForm({
      name: template.name,
      description: template.description,
      frequency: template.frequency,
      employeeIds: template.employeeIds,
      dayOfMonth: template.dayOfMonth,
      dayOfWeek: template.dayOfWeek,
      isActive: template.isActive,
    });
    setEditingId(template.id);
    setIsCreating(false);
    setFormErrors({});
  };

  const handleDelete = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) resetForm();
  };

  const handleToggleActive = (id: string) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, isActive: !t.isActive, updatedAt: new Date().toISOString() }
          : t,
      ),
    );
  };

  const toggleEmployee = (empId: string) => {
    setForm((prev) => ({
      ...prev,
      employeeIds: prev.employeeIds.includes(empId)
        ? prev.employeeIds.filter((id) => id !== empId)
        : [...prev.employeeIds, empId],
    }));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section aria-labelledby="template-editor-heading" className="space-y-6">
      <div className="flex items-center justify-between">
        <h2
          id="template-editor-heading"
          className="text-lg font-semibold text-gray-900"
        >
          Recurring Payroll Templates
        </h2>
        {!isCreating && !editingId && (
          <button
            type="button"
            onClick={() => {
              setIsCreating(true);
              setForm(EMPTY_FORM);
              setFormErrors({});
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        )}
      </div>

      {/* ── Create / Edit Form ─────────────────────────────────────────────── */}
      {(isCreating || editingId) && (
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4 border border-indigo-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {isCreating ? "Create Template" : "Edit Template"}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label
                htmlFor="tpl-name"
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                Template Name *
              </label>
              <input
                id="tpl-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={`w-full rounded-md border px-3 py-2 text-sm ${
                  formErrors.name ? "border-red-300" : "border-gray-300"
                } focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500`}
                placeholder="e.g. Monthly Engineering Payroll"
              />
              {formErrors.name && (
                <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
              )}
            </div>

            {/* Frequency */}
            <div>
              <label
                htmlFor="tpl-frequency"
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                Frequency *
              </label>
              <select
                id="tpl-frequency"
                value={form.frequency}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    frequency: e.target.value as PayrollFrequency,
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {FREQUENCY_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>

            {/* Day of month (monthly/quarterly) */}
            {(form.frequency === "monthly" || form.frequency === "quarterly") && (
              <div>
                <label
                  htmlFor="tpl-day-month"
                  className="block text-xs font-medium text-gray-700 mb-1"
                >
                  Day of Month *
                </label>
                <input
                  id="tpl-day-month"
                  type="number"
                  min={1}
                  max={31}
                  value={form.dayOfMonth ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      dayOfMonth: parseInt(e.target.value, 10) || undefined,
                    }))
                  }
                  className={`w-full rounded-md border px-3 py-2 text-sm ${
                    formErrors.dayOfMonth ? "border-red-300" : "border-gray-300"
                  } focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500`}
                />
                {formErrors.dayOfMonth && (
                  <p className="text-xs text-red-600 mt-1">
                    {formErrors.dayOfMonth}
                  </p>
                )}
              </div>
            )}

            {/* Day of week (weekly/biweekly) */}
            {(form.frequency === "weekly" ||
              form.frequency === "biweekly") && (
              <div>
                <label
                  htmlFor="tpl-day-week"
                  className="block text-xs font-medium text-gray-700 mb-1"
                >
                  Day of Week *
                </label>
                <select
                  id="tpl-day-week"
                  value={form.dayOfWeek ?? 5}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      dayOfWeek: parseInt(e.target.value, 10),
                    }))
                  }
                  className={`w-full rounded-md border px-3 py-2 text-sm ${
                    formErrors.dayOfWeek ? "border-red-300" : "border-gray-300"
                  } focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500`}
                >
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day, i) => (
                      <option key={day} value={i}>
                        {day}
                      </option>
                    ),
                  )}
                </select>
                {formErrors.dayOfWeek && (
                  <p className="text-xs text-red-600 mt-1">
                    {formErrors.dayOfWeek}
                  </p>
                )}
              </div>
            )}

            {/* Description */}
            <div className="md:col-span-2">
              <label
                htmlFor="tpl-desc"
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                Description
              </label>
              <textarea
                id="tpl-desc"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Optional description of this template"
              />
            </div>
          </div>

          {/* Employee selection */}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">
              Included Employees *
            </p>
            {formErrors.employeeIds && (
              <p className="text-xs text-red-600 mb-2">
                {formErrors.employeeIds}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {MOCK_EMPLOYEES.filter((e) => e.isActive).map((emp) => {
                const selected = form.employeeIds.includes(emp.id);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => toggleEmployee(emp.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm text-left transition-colors ${
                      selected
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selected
                          ? "bg-indigo-600 border-indigo-600"
                          : "border-gray-300"
                      }`}
                    >
                      {selected && (
                        <CheckCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="truncate">{emp.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      ${emp.salary}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-2">
            <input
              id="tpl-active"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((p) => ({ ...p, isActive: e.target.checked }))
              }
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="tpl-active" className="text-sm text-gray-700">
              Template is active
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              {isCreating ? "Create Template" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* ── Template list ──────────────────────────────────────────────────── */}
      {templates.length === 0 && !isCreating && (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <Clock className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900">No templates yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Create a recurring payroll template to automate frequent pay cycles.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const includedEmployees = MOCK_EMPLOYEES.filter((e) =>
            template.employeeIds.includes(e.id),
          );

          return (
            <article
              key={template.id}
              className={`bg-white rounded-lg shadow-sm border-l-4 ${
                template.isActive
                  ? "border-l-indigo-500"
                  : "border-l-gray-300"
              } p-4 space-y-3`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {template.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {getFrequencyDescription(template)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEdit(template)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    aria-label="Edit template"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(template.id)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                    aria-label="Delete template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {template.description && (
                <p className="text-xs text-gray-500">{template.description}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {includedEmployees.length} employee
                  {includedEmployees.length !== 1 ? "s" : ""}
                </span>
                {template.lastExecuted && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Last: {formatDate(template.lastExecuted)}
                  </span>
                )}
              </div>

              {/* Employee list */}
              <div className="flex flex-wrap gap-1">
                {includedEmployees.map((emp) => (
                  <span
                    key={emp.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    {emp.name}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <button
                  type="button"
                  onClick={() => handleToggleActive(template.id)}
                  className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
                    template.isActive
                      ? "text-green-600 hover:text-green-700"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {template.isActive ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Active
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      Inactive
                    </>
                  )}
                </button>
                {template.nextScheduled && (
                  <span className="text-xs text-gray-400">
                    Next: {formatDate(template.nextScheduled)}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default RecurringPayrollTemplateEditor;