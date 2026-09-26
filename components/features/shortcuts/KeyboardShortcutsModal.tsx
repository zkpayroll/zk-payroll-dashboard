"use client";

import { useEffect, useRef } from "react";
import { X, Keyboard, Shield, Check, Slash } from "lucide-react";
import { useKeyboardShortcutsStore } from "@/stores/keyboardShortcuts";
import { PAYROLL_SHORTCUTS, type ShortcutCategory } from "@/src/lib/shortcuts";
import { useSession } from "@/hooks/useSession";

const CATEGORY_TITLES: Record<ShortcutCategory, string> = {
  navigation: "Navigation",
  actions: "Common Payroll Actions",
  general: "General & Help",
};

export default function KeyboardShortcutsModal() {
  const { isModalOpen, closeModal, enabled, setEnabled } =
    useKeyboardShortcutsStore();
  const { sessionInfo } = useSession();
  const currentRole = sessionInfo?.role ?? "admin";
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap / focus close button when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => closeButtonRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  if (!isModalOpen) return null;

  const categories: ShortcutCategory[] = ["navigation", "actions", "general"];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm transition-opacity"
        onClick={closeModal}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-200 p-6 focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Keyboard className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="shortcuts-dialog-title"
                className="text-lg font-bold text-gray-900"
              >
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-gray-500">
                Quick navigation and payroll operations
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeModal}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close keyboard shortcuts dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts Content */}
        <div className="mt-6 space-y-6">
          {categories.map((cat) => {
            const list = PAYROLL_SHORTCUTS.filter((s) => s.category === cat);
            if (list.length === 0) return null;

            return (
              <section key={cat} aria-labelledby={`category-${cat}`}>
                <h3
                  id={`category-${cat}`}
                  className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3"
                >
                  {CATEGORY_TITLES[cat]}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {list.map((shortcut) => {
                    const isAllowed = shortcut.roles.includes(currentRole);

                    return (
                      <div
                        key={shortcut.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-sm ${
                          isAllowed
                            ? "bg-gray-50/50 border-gray-200"
                            : "bg-gray-50/20 border-gray-100 opacity-60"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {shortcut.description}
                          </p>
                          {shortcut.adminOnly && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                              <Shield className="w-2.5 h-2.5" /> Admin only
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {shortcut.keyDisplay.split(" then ").map((keyPart, i) => (
                            <span key={i} className="flex items-center gap-1">
                              {i > 0 && (
                                <span className="text-gray-400 text-xs">then</span>
                              )}
                              <kbd className="px-2 py-0.5 text-xs font-mono font-semibold text-gray-700 bg-white border border-gray-300 rounded shadow-sm">
                                {keyPart}
                              </kbd>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Accessibility settings footer */}
        <div className="mt-8 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span className="font-medium text-gray-700">
              Enable character-key sequences (e.g. &apos;g&apos; then &apos;p&apos;)
            </span>
          </label>
          <span className="text-[11px] text-gray-400">
            Press <kbd className="font-mono bg-gray-100 px-1 py-0.5 rounded">ESC</kbd> to close
          </span>
        </div>
      </div>
    </>
  );
}
