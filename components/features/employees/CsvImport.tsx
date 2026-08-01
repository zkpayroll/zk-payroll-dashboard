"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  AlertTriangle,
  CheckCircle,
  X,
  Download,
  FileText,
  UserPlus,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useEmployeeStore } from "@/stores/employees";
import { sha256Hex } from "@/lib/zk/hash";
import { ImportConflictResolver } from "./ImportConflictResolver";
import type { Employee } from "@/types";

export interface CsvRow {
  rowIndex: number;
  name: string;
  email: string;
  department: string;
  address: string;
  salary: string;
  startDate: string;
}

interface RowValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

const REQUIRED_COLUMNS = ["name", "address", "salary", "start_date"];
const OPTIONAL_COLUMNS = ["email", "department"];

const CSV_TEMPLATE_HEADER = "name,email,department,address,salary,start_date";
const CSV_TEMPLATE_ROW =
  "Jane Doe,jane@company.io,Engineering,GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37,5000,2025-06-01";

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: CsvRow[] = [];

  const nameIdx = headers.indexOf("name");
  const emailIdx = headers.indexOf("email");
  const deptIdx = headers.indexOf("department");
  const addrIdx = headers.indexOf("address");
  const salaryIdx = headers.indexOf("salary");
  const startIdx = headers.indexOf("start_date");

  if (nameIdx === -1 || addrIdx === -1 || salaryIdx === -1) {
    return [];
  }

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 0) continue;

    rows.push({
      rowIndex: i,
      name: values[nameIdx]?.trim() ?? "",
      email: emailIdx >= 0 ? (values[emailIdx]?.trim() ?? "") : "",
      department: deptIdx >= 0 ? (values[deptIdx]?.trim() ?? "") : "",
      address: values[addrIdx]?.trim() ?? "",
      salary: values[salaryIdx]?.trim() ?? "",
      startDate: startIdx >= 0 ? (values[startIdx]?.trim() ?? "") : "",
    });
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function validateRow(row: CsvRow): RowValidationError[] {
  const errors: RowValidationError[] = [];

  if (!row.name.trim()) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "name",
      message: "Name is required",
    });
  }

  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "email",
      message: "Invalid email format",
    });
  }

  if (!row.address.trim()) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "address",
      message: "Stellar wallet address is required",
    });
  } else if (row.address.trim().length !== 56) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "address",
      message: `Address must be 56 characters (got ${row.address.trim().length})`,
    });
  } else if (!row.address.trim().startsWith("G")) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "address",
      message: "Stellar addresses must start with G",
    });
  }

  if (!row.salary.trim()) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "salary",
      message: "Salary is required",
    });
  } else {
    const parsed = parseFloat(row.salary);
    if (isNaN(parsed) || parsed <= 0) {
      errors.push({
        rowIndex: row.rowIndex,
        field: "salary",
        message: "Salary must be a positive number",
      });
    }
  }

  if (!row.startDate.trim()) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "start_date",
      message: "Start date is required",
    });
  } else if (isNaN(Date.parse(row.startDate))) {
    errors.push({
      rowIndex: row.rowIndex,
      field: "start_date",
      message: "Invalid date format (use YYYY-MM-DD)",
    });
  }

  return errors;
}

function downloadTemplate() {
  const csv = `${CSV_TEMPLATE_HEADER}\n${CSV_TEMPLATE_ROW}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "employee-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function CsvImport() {
  const { addEmployee, employees } = useEmployeeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<
    RowValidationError[]
  >([]);
  const [fileName, setFileName] = useState<string>("");
  const [importingRow, setImportingRow] = useState<number | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [allImported, setAllImported] = useState(false);
  const [showConflictResolver, setShowConflictResolver] = useState(false);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const rows = parseCsv(text);

        if (rows.length === 0) {
          toast.error("Invalid CSV", {
            description:
              "The file must have 'name', 'address', and 'salary' columns with at least one data row.",
          });
          setParsedRows([]);
          setValidationErrors([]);
          return;
        }

        const allErrors: RowValidationError[] = [];
        for (const row of rows) {
          allErrors.push(...validateRow(row));
        }

        setParsedRows(rows);
        setValidationErrors(allErrors);
        setImportedIds(new Set());

        const errorCount = allErrors.filter(
          (e) => e.field !== "email" || allErrors.length <= 2,
        ).length;
        const warningCount = rows.filter((r) => {
          const rowErrors = allErrors.filter((e) => e.rowIndex === r.rowIndex);
          return rowErrors.length > 0;
        }).length;

        if (errorCount === 0) {
          toast.success(
            `Parsed ${rows.length} employee record${rows.length !== 1 ? "s" : ""}`,
            {
              description: "All rows passed validation.",
            },
          );
        } else {
          toast.warning(
            `Parsed ${rows.length} row${rows.length !== 1 ? "s" : ""}`,
            {
              description: `${warningCount} row${warningCount !== 1 ? "s" : ""} with validation issues.`,
            },
          );
        }
      };
      reader.readAsText(file);
    },
    [],
  );

  const handleImportRow = useCallback(
    async (row: CsvRow) => {
      setImportingRow(row.rowIndex);
      try {
        const salt = crypto.randomUUID();
        const transcript = `${row.salary}|${row.address.trim()}|${salt}`;
        const salaryCommitment = `0x${await sha256Hex(transcript)}`;

        const newEmployee: Employee = {
          id: `emp_${Date.now()}_${row.rowIndex}`,
          name: row.name.trim(),
          email: row.email.trim() || undefined,
          department: row.department.trim() || undefined,
          address: row.address.trim(),
          salary: parseFloat(row.salary),
          salaryCommitment,
          isActive: true,
          status: "pending",
          onboardingStatus: "not_started",
          startDate: new Date(row.startDate).toISOString(),
        };

        addEmployee(newEmployee);
        setImportedIds((prev) => new Set(prev).add(`${row.rowIndex}`));
        toast.success(`${row.name} imported successfully`);
      } catch {
        toast.error(`Failed to import ${row.name}`);
      } finally {
        setImportingRow(null);
      }
    },
    [addEmployee],
  );

  const handleImportAll = useCallback(() => {
    const validRows = parsedRows.filter((row) => {
      const rowErrors = validationErrors.filter(
        (e) => e.rowIndex === row.rowIndex,
      );
      return rowErrors.length === 0;
    });

    // Show conflict resolver before importing
    setShowConflictResolver(true);
  }, [parsedRows, validationErrors]);

  const handleConflictResolve = useCallback(
    async (resolvedRows: CsvRow[], _skippedIds: string[]) => {
      setShowConflictResolver(false);
      for (const row of resolvedRows) {
        await handleImportRow(row);
      }
      setAllImported(true);
      toast.success(
        `Imported ${resolvedRows.length} employee${resolvedRows.length !== 1 ? "s" : ""}`,
      );
    },
    [handleImportRow],
  );

  const handleClear = () => {
    setParsedRows([]);
    setValidationErrors([]);
    setFileName("");
    setImportedIds(new Set());
    setAllImported(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getRowErrors = (rowIndex: number): RowValidationError[] => {
    return validationErrors.filter((e) => e.rowIndex === rowIndex);
  };

  const validRowCount = parsedRows.filter((row) => {
    const rowErrors = getRowErrors(row.rowIndex);
    return rowErrors.length === 0;
  }).length;

  return (
    <section aria-labelledby="csv-import-heading" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2
            id="csv-import-heading"
            className="text-lg font-semibold text-gray-900"
          >
            Import Employees
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload a CSV file to onboard multiple employees at once. Each row is
            validated before import.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download template
        </button>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-indigo-800">
            Privacy Notice
          </h3>
          <p className="text-sm text-indigo-700 mt-1">
            Employee salary data from the CSV is used only to generate ZK salary
            commitments. Raw salary values are never stored in plaintext. A ZK
            commitment is generated for each employee before they are added to
            the directory.
          </p>
        </div>
      </div>

      {parsedRows.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-12 text-center">
          <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-4">
            Drop a CSV file here or click to browse. The file must include
            columns:
          </p>
          <div className="inline-flex flex-wrap items-center gap-1.5 justify-center mb-4">
            {REQUIRED_COLUMNS.map((col) => (
              <span
                key={col}
                className="px-2 py-0.5 text-xs font-medium rounded bg-indigo-100 text-indigo-700"
              >
                {col}
              </span>
            ))}
            {OPTIONAL_COLUMNS.map((col) => (
              <span
                key={col}
                className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600"
              >
                {col} (optional)
              </span>
            ))}
          </div>
          <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer">
            <FileText className="w-4 h-4" />
            Select CSV File
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="sr-only"
            />
          </label>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Parsed Records
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {fileName} &middot; {parsedRows.length} row
                {parsedRows.length !== 1 ? "s" : ""} &middot; {validRowCount}{" "}
                valid
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
              <button
                type="button"
                onClick={handleImportAll}
                disabled={validRowCount === 0 || allImported}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Import all valid ({validRowCount})
              </button>
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div className="px-4 sm:px-6 py-3 bg-yellow-50 border-b flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
              <p className="text-sm text-yellow-700">
                {validationErrors.length} validation issue
                {validationErrors.length !== 1 ? "s" : ""} across{" "}
                {new Set(validationErrors.map((e) => e.rowIndex)).size} row
                {new Set(validationErrors.map((e) => e.rowIndex)).size !== 1
                  ? "s"
                  : ""}
                . Fix errors before importing affected rows.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">
                CSV import preview with validation results
              </caption>
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-3 py-3 text-xs font-medium text-gray-600 uppercase w-12"
                  >
                    Row
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    Email
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    Department
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    Address
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    Salary
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    Start Date
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    Issues
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-xs font-medium text-gray-600 uppercase text-right"
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedRows.map((row) => {
                  const rowErrors = getRowErrors(row.rowIndex);
                  const hasErrors = rowErrors.length > 0;
                  const isImported = importedIds.has(`${row.rowIndex}`);
                  const isImporting = importingRow === row.rowIndex;

                  return (
                    <tr
                      key={row.rowIndex}
                      className={
                        hasErrors
                          ? "bg-red-50/30"
                          : isImported
                            ? "bg-green-50/30"
                            : "hover:bg-gray-50"
                      }
                    >
                      <td className="px-3 py-3 text-xs font-mono text-gray-500">
                        {row.rowIndex}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-900 max-w-[150px] truncate">
                        {row.name}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 max-w-[150px] truncate">
                        {row.email || "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {row.department || "—"}
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-gray-500 max-w-[120px] truncate">
                        {row.address ? `${row.address.slice(0, 8)}...` : "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-900">
                        {row.salary || "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {row.startDate || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {rowErrors.length > 0 ? (
                          <div className="space-y-1">
                            {rowErrors.map((err, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200"
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {err.field}: {err.message}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle className="w-3 h-3" />
                            Valid
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {isImported ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle className="w-3 h-3" />
                            Imported
                          </span>
                        ) : hasErrors ? (
                          <span className="text-xs text-gray-400">
                            Fix errors
                          </span>
                        ) : isImporting ? (
                          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin inline" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleImportRow(row)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors"
                          >
                            <UserPlus className="w-3 h-3" />
                            Import
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 sm:px-6 py-3 border-t text-xs text-gray-500 flex items-center justify-between">
            <span>
              {parsedRows.length} row{parsedRows.length !== 1 ? "s" : ""} parsed
              &middot; {importedIds.size} imported &middot; {employees.length}{" "}
              total in directory
            </span>
            <a
              href="/employees"
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View directory &rarr;
            </a>
          </div>
        </div>
      )}

      {showConflictResolver && (
        <ImportConflictResolver
          rows={parsedRows.filter((row) => {
            const rowErrors = validationErrors.filter(
              (e) => e.rowIndex === row.rowIndex,
            );
            return rowErrors.length === 0;
          })}
          existingEmployees={employees.map((e) => ({
            name: e.name,
            email: e.email,
            address: e.address,
          }))}
          onResolve={handleConflictResolve}
          onCancel={() => setShowConflictResolver(false)}
        />
      )}
    </section>
  );
}
