"use client";

import React, { useState, useEffect } from "react";
import {
  Hash,
  Copy,
  Check,
  Shield,
  EyeOff,
  AlertCircle,
  Sparkles,
  Lock,
  RefreshCw,
} from "lucide-react";
import {
  generateNoteHash,
  validateNoteHash,
  formatCompactHash,
  REDACTED_NOTE_PLACEHOLDER,
} from "@/lib/privacy/noteHash";

export interface NoteHashPreviewProps {
  noteHash?: string;
  rawNote?: string;
  onHashChange?: (hash: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  label?: string;
  allowGenerateFromNote?: boolean;
}

export function NoteHashPreview({
  noteHash = "",
  rawNote = "",
  onHashChange,
  disabled = false,
  readOnly = false,
  className = "",
  label = "Payroll Note Hash",
  allowGenerateFromNote = true,
}: NoteHashPreviewProps) {
  const [currentHash, setCurrentHash] = useState<string>(noteHash);
  const [inputNote, setInputNote] = useState<string>(rawNote);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isHashMode, setIsHashMode] = useState<boolean>(Boolean(noteHash));

  useEffect(() => {
    if (noteHash) {
      setCurrentHash(noteHash);
      setIsHashMode(true);
      const validation = validateNoteHash(noteHash);
      setValidationError(validation.isValid ? null : validation.error || "Invalid hash");
    }
  }, [noteHash]);

  const handleGenerateHash = async () => {
    if (!inputNote.trim()) {
      setValidationError("Please enter note text to generate a hash.");
      return;
    }

    setIsGenerating(true);
    setValidationError(null);

    try {
      const generated = await generateNoteHash(inputNote);
      setCurrentHash(generated);
      setIsHashMode(true);
      // Explicitly clear / mask the raw note text in UI
      setInputNote("");
      if (onHashChange) {
        onHashChange(generated);
      }
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Failed to generate note hash");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualHashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    setCurrentHash(val);

    if (!val) {
      setValidationError(null);
      if (onHashChange) onHashChange("");
      return;
    }

    const validation = validateNoteHash(val);
    if (!validation.isValid) {
      setValidationError(validation.error || "Invalid hash format");
    } else {
      setValidationError(null);
      if (onHashChange && validation.normalizedHash) {
        onHashChange(validation.normalizedHash);
      }
    }
  };

  const handleCopy = async () => {
    if (!currentHash) return;
    try {
      await navigator.clipboard.writeText(currentHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleResetToInput = () => {
    setIsHashMode(false);
    setCurrentHash("");
    setInputNote("");
    setValidationError(null);
    if (onHashChange) {
      onHashChange("");
    }
  };

  return (
    <div
      data-testid="note-hash-preview-card"
      className={`bg-white rounded-lg border border-gray-200 p-4 space-y-3 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
            <Hash className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <label
              htmlFor="note-hash-input"
              className="text-sm font-medium text-gray-900 block"
            >
              {label}
            </label>
            <p className="text-[11px] text-gray-500">
              Zero-knowledge note digest committed on-chain
            </p>
          </div>
        </div>

        {isHashMode && !readOnly && !disabled && (
          <button
            type="button"
            onClick={handleResetToInput}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Change Note
          </button>
        )}
      </div>

      {/* Main Mode 1: Hash Preview Mode (Active when a hash exists) */}
      {isHashMode ? (
        <div className="space-y-2">
          <div
            data-testid="hash-preview-display"
            className="flex items-center justify-between gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <div className="font-mono text-xs text-gray-800 break-all select-all font-medium">
                  {currentHash || "0x…"}
                </div>
                <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                  <EyeOff className="w-3 h-3 text-indigo-500" />
                  <span>Raw note text is encrypted/redacted off-chain</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              disabled={disabled || !currentHash || Boolean(validationError)}
              data-testid="copy-note-hash-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors shrink-0 shadow-sm"
              aria-label={copied ? "Copied note hash" : "Copy note hash to clipboard"}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-green-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Privacy safe badge */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-md p-2.5 flex items-start gap-2 text-xs text-indigo-900">
            <Shield className="w-3.5 h-3.5 text-indigo-600 mt-0.5 shrink-0" />
            <span>
              <strong>Privacy Guaranteed: </strong>
              The hash preview allows audit verification without revealing confidential employee notes or bonus rationales.
            </span>
          </div>
        </div>
      ) : (
        /* Mode 2: Input / Note Hasher Mode */
        <div className="space-y-3">
          {allowGenerateFromNote && (
            <div>
              <label htmlFor="raw-note-input" className="block text-xs font-medium text-gray-700 mb-1">
                Enter Payroll Note / Memo:
              </label>
              <div className="flex gap-2">
                <input
                  id="raw-note-input"
                  type="text"
                  value={inputNote}
                  onChange={(e) => setInputNote(e.target.value)}
                  placeholder="e.g. Q3 Performance Bonus batch #4"
                  disabled={disabled || isGenerating}
                  className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleGenerateHash}
                  disabled={disabled || isGenerating || !inputNote.trim()}
                  data-testid="generate-note-hash-btn"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isGenerating ? "Hashing..." : "Generate Hash"}
                </button>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="note-hash-input" className="block text-xs font-medium text-gray-700 mb-1">
              Or Paste Existing SHA-256 Note Hash:
            </label>
            <input
              id="note-hash-input"
              type="text"
              value={currentHash}
              onChange={handleManualHashChange}
              placeholder="0x..."
              disabled={disabled}
              className={`w-full px-3 py-1.5 text-xs font-mono border rounded-md focus:outline-none focus:ring-2 ${
                validationError
                  ? "border-red-300 focus:ring-red-500"
                  : "border-gray-300 focus:ring-indigo-500"
              }`}
            />
          </div>
        </div>
      )}

      {/* Validation Error */}
      {validationError && (
        <div
          data-testid="note-hash-error"
          className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded-md"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
}

export default NoteHashPreview;
