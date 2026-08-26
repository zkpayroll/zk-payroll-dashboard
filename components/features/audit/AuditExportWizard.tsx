"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Download,
  FileJson,
  FileText,
  Filter,
  Printer,
  Search,
  Table2,
  XCircle,
} from "lucide-react";
import { useAuditExportStore } from "@/stores/auditExport";
import type { AuditPacketEntry, ExportFormat, WizardStep } from "@/stores/auditExport";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "select", label: "Select Records" },
  { key: "review", label: "Review" },
  { key: "configure", label: "Configure" },
  { key: "export", label: "Export" },
  { key: "complete", label: "Complete" },
];

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: React.ReactNode; description: string }[] = [
  { value: "csv", label: "CSV", icon: <Table2 className="w-5 h-5" />, description: "Spreadsheet-compatible format" },
  { value: "json", label: "JSON", icon: <FileJson className="w-5 h-5" />, description: "Structured data format" },
  { value: "pdf", label: "PDF", icon: <FileText className="w-5 h-5" />, description: "Printable report format" },
];

const TYPE_LABELS: Record<AuditPacketEntry["type"], string> = {
  payroll_run: "Payroll Run",
  transaction: "Transaction",
  compliance_event: "Compliance Event",
  key_access_log: "Key Access Log",
  treasury_movement: "Treasury Movement",
};

function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {STEPS.map((step, idx) => (
        <div key={step.key} className="flex items-center gap-1 sm:gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
              idx < currentIdx
                ? "bg-green-100 text-green-700"
                : idx === currentIdx
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {idx < currentIdx ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
          </div>
          <span className={`hidden sm:inline text-xs ${idx === currentIdx ? "font-medium text-foreground" : "text-muted-foreground"}`}>
            {step.label}
          </span>
          {idx < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground hidden sm:block" />}
        </div>
      ))}
    </div>
  );
}

function SelectStep() {
  const { entries, searchQuery, setSearchQuery, toggleEntry, selectAll, deselectAll, getFilteredEntries } = useAuditExportStore();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const filteredEntries = typeFilter === "all" ? getFilteredEntries() : getFilteredEntries(typeFilter as AuditPacketEntry["type"]);
  const searchFiltered = searchQuery.trim()
    ? filteredEntries.filter(
        (e) =>
          e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.summary.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredEntries;
  const selectedCount = entries.filter((e) => e.selected).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Select Audit Records</h3>
          <p className="text-sm text-muted-foreground">{entries.length} records available, {selectedCount} selected</p>
        </div>
        <div className="flex gap-2">
          <button onClick={selectAll} className="text-sm text-blue-600 hover:underline">Select all</button>
          <button onClick={deselectAll} className="text-sm text-muted-foreground hover:underline">Deselect all</button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="all">All Types</option>
          <option value="payroll_run">Payroll Runs</option>
          <option value="transaction">Transactions</option>
          <option value="compliance_event">Compliance Events</option>
          <option value="key_access_log">Key Access Logs</option>
          <option value="treasury_movement">Treasury Movements</option>
        </select>
      </div>

      <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
        {searchFiltered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No records match your filters</p>
          </div>
        ) : (
          searchFiltered.map((entry) => (
            // eslint-disable-next-line jsx-a11y/label-has-associated-control
            <label
              key={entry.id}
              className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${entry.selected ? "bg-blue-50/50" : ""}`}
            >
              <input
                type="checkbox"
                checked={entry.selected}
                onChange={() => toggleEntry(entry.id)}
                className="h-4 w-4 mt-0.5 rounded border-gray-300"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{entry.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {TYPE_LABELS[entry.type]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{entry.summary}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{new Date(entry.date).toLocaleDateString()}</p>
              </div>
            </label>
          ))

        )}
      </div>
    </div>
  );
}

function ReviewStep() {
  const { getSelectedEntries } = useAuditExportStore();
  const selected = getSelectedEntries();
  const byType = selected.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Review Selection</h3>
      <div className="border rounded-lg p-4 space-y-3">
        <div className="text-sm font-medium">{selected.length} records selected</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(byType).map(([type, count]) => (
            <div key={type} className="border rounded p-3">
              <div className="text-lg font-bold">{count}</div>
              <div className="text-xs text-muted-foreground">{TYPE_LABELS[type as AuditPacketEntry["type"]]}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
        {selected.map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 p-3">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm">{entry.title}</span>
              <span className="text-xs text-muted-foreground ml-2">{TYPE_LABELS[entry.type]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfigureStep() {
  const { exportFormat, setExportFormat, includeMetadata, setIncludeMetadata, dateRangeStart, dateRangeEnd, setDateRange } = useAuditExportStore();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Configure Export</h3>

      <div>
        <span className="text-sm font-medium mb-3 block">Export Format</span>
        <div className="grid grid-cols-3 gap-3">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setExportFormat(opt.value)}
              className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors ${
                exportFormat === opt.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-border hover:border-blue-200"
              }`}
            >
              {opt.icon}
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-xs text-muted-foreground text-center">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-sm font-medium mb-3 block">Date Range</span>
        <div className="flex gap-3">
          <input
            type="date"
            aria-label="Start date"
            value={dateRangeStart}
            onChange={(e) => setDateRange(e.target.value, dateRangeEnd)}
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
          />
          <span className="flex items-center text-muted-foreground">to</span>
          <input
            type="date"
            aria-label="End date"
            value={dateRangeEnd}
            onChange={(e) => setDateRange(dateRangeStart, e.target.value)}
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label htmlFor="include-metadata-checkbox" className="flex items-center gap-2 cursor-pointer">
          <input
            id="include-metadata-checkbox"
            type="checkbox"
            checked={includeMetadata}
            onChange={(e) => setIncludeMetadata(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm">Include metadata (timestamps, hashes, actor info)</span>
        </label>
      </div>

    </div>
  );
}

function ExportStep() {
  const { activeExportJob, startExport, updateExportProgress, completeExport } = useAuditExportStore();
  const [started, setStarted] = useState(false);

  const handleStart = () => {
    startExport();
    setStarted(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        clearInterval(interval);
        completeExport("https://example.com/export/audit_packet.csv", 24500);
      } else {
        updateExportProgress(Math.min(Math.round(progress), 99));
      }
    }, 500);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Exporting Audit Packet</h3>
      {!started ? (
        <div className="text-center py-8">
          <Download className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">Ready to export your audit packet</p>
          <button
            onClick={handleStart}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Start Export
          </button>
        </div>
      ) : activeExportJob ? (
        <div className="space-y-4">
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {activeExportJob.status === "complete" ? "Export complete" : `Exporting ${activeExportJob.format.toUpperCase()}...`}
              </span>
              <span className="text-sm text-muted-foreground">{activeExportJob.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  activeExportJob.status === "complete" ? "bg-green-500" : "bg-blue-600"
                }`}
                style={{ width: `${activeExportJob.progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {activeExportJob.recordCount} records
            </p>
          </div>
          {activeExportJob.status === "complete" && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">Export complete</p>
                <p className="text-xs text-green-700">
                  {(activeExportJob.fileSize ?? 0 / 1024).toFixed(1)} KB
                </p>
              </div>
              <a
                href={activeExportJob.downloadUrl}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CompleteStep() {
  const { activeExportJob, reset } = useAuditExportStore();

  return (
    <div className="text-center py-8 space-y-4">
      <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
      <h3 className="text-lg font-semibold">Export Complete</h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        Your audit packet has been exported successfully. You can download it or start a new export.
      </p>
      <div className="flex items-center justify-center gap-3">
        {activeExportJob?.downloadUrl && (
          <a
            href={activeExportJob.downloadUrl}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Download Again
          </a>
        )}
        <button
          onClick={() => { reset(); }}
          className="px-4 py-2 border rounded-lg font-medium hover:bg-muted"
        >
          New Export
        </button>
      </div>
    </div>
  );
}

export default function AuditExportWizard() {
  const { currentStep, nextStep, prevStep, getSelectedEntries } = useAuditExportStore();
  const selectedCount = getSelectedEntries().length;
  const canProceed =
    (currentStep === "select" && selectedCount > 0) ||
    currentStep === "review" ||
    currentStep === "configure" ||
    currentStep === "export" ||
    currentStep === "complete";

  const renderStep = () => {
    switch (currentStep) {
      case "select": return <SelectStep />;
      case "review": return <ReviewStep />;
      case "configure": return <ConfigureStep />;
      case "export": return <ExportStep />;
      case "complete": return <CompleteStep />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Packet Export</h1>
        <p className="text-sm text-muted-foreground mt-1">Review and export audit records for compliance</p>
      </div>

      <StepIndicator currentStep={currentStep} />

      <div className="border rounded-lg p-6">{renderStep()}</div>

      <div className="flex items-center justify-between">
        <button
          onClick={prevStep}
          disabled={currentStep === "select" || currentStep === "complete"}
          className="flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        {currentStep !== "complete" && (
          <button
            onClick={nextStep}
            disabled={!canProceed || currentStep === "export"}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentStep === "configure" ? "Start Export" : "Next"}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
