import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 space-y-4">
      <Loader2 className="h-12 w-12 text-primary animate-spin" />
      <div className="space-y-2 text-center">
        <h3 className="text-xl font-medium text-gray-900">Loading Dashboard...</h3>
        <p className="text-gray-500 max-w-xs mx-auto">
          Please wait while we fetch the latest data and prepare your ZK proofs.
        </p>
      </div>
      
      {/* Skeleton placeholders to give a sense of layout */}
      <div className="w-full max-w-4xl mt-12 space-y-8 animate-pulse">
        <div className="h-32 bg-gray-100 rounded-xl w-full"></div>
        <div className="h-64 bg-gray-100 rounded-xl w-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-48 bg-gray-100 rounded-xl"></div>
          <div className="h-48 bg-gray-100 rounded-xl"></div>
        </div>
      </div>
    </div>
  );
}
