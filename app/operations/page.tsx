"use client";

import OperationsCommandCenter from "@/components/features/operations/OperationsCommandCenter";

export default function OperationsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Operations Command Center
      </h1>
      <OperationsCommandCenter />
    </div>
  );
}
