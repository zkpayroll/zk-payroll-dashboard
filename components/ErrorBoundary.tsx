"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/button";
import { AlertCircle, RefreshCcw, Github } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onLog?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    if (this.props.onLog) {
      this.props.onLog(error, errorInfo);
    }
  }

  private handleReportIssue = () => {
    const errorMsg = this.state.error?.message || "Unknown error";
    const errorStack = this.state.error?.stack || "";
    const title = encodeURIComponent(`Bug: ${errorMsg}`);
    const body = encodeURIComponent(
      `**Error Message:** ${errorMsg}\n\n**Stack Trace:**\n\`\`\`\n${errorStack}\n\`\`\``
    );
    const url = `https://github.com/OluRemiFour/zk-payroll-dashboard/issues/new?title=${title}&body=${body}`;
    window.open(url, "_blank");
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 bg-red-50 border border-red-200 rounded-lg shadow-sm my-4">
          <div className="flex items-center gap-2 text-red-600 mb-4">
            <AlertCircle className="h-6 w-6" />
            <h2 className="text-xl font-semibold">Something went wrong</h2>
          </div>
          <p className="text-red-700 text-sm mb-6 text-center max-w-md">
            {this.state.error?.message || "An unexpected error occurred while processing this section."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={this.handleReset}
              className="flex items-center gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              Try Again
            </Button>
            <Button
              variant="secondary"
              onClick={this.handleReportIssue}
              className="flex items-center gap-2"
            >
              <Github className="h-4 w-4" />
              Report Issue
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
