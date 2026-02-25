"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Critical root error caught by GlobalError boundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 font-sans">
        <div className="bg-white p-10 rounded-2xl shadow-xl max-w-lg w-full text-center border border-gray-100">
          <div className="inline-flex items-center justify-center bg-red-100 p-4 rounded-full mb-6">
            <AlertCircle className="h-12 w-12 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Critical App Error</h1>
          <p className="text-gray-600 mb-8 leading-relaxed">
            The application encountered a critical error initialization. 
            This usually happens due to connection issues or incompatible browser environments.
          </p>
          <button
            onClick={() => reset()}
            className="w-full bg-primary text-white font-semibold py-3 px-6 rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-5 w-5" />
            Restart Application
          </button>
          
          {error.digest && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 font-mono uppercase tracking-widest">
                System Diagnostics: {error.digest}
              </p>
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
