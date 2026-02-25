"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Runtime error caught by boundary:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="bg-amber-50 p-4 rounded-full mb-6">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
      </div>
      <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
        Something went wrong!
      </h2>
      <p className="text-lg text-gray-600 mb-8 max-w-md">
        We encountered an unexpected error. Don&apos;t worry, your data is safe. 
        You can try refreshing the page or contact support if the issue persists.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          onClick={() => reset()}
          size="lg"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-5 w-5" />
          Try Again
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => window.location.reload()}
        >
          Refresh Page
        </Button>
      </div>
      {error.digest && (
        <p className="mt-8 text-xs text-gray-400 font-mono">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
