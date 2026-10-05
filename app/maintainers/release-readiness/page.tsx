"use client";

import ReleaseReadinessChecklist from "@/components/features/maintainers/ReleaseReadinessChecklist";

export default function ReleaseReadinessPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Release Readiness
      </h1>
      <ReleaseReadinessChecklist />
    </div>
  );
}
