"use client";

import { useMemo } from "react";
import type { CompanyConfig } from "@/types";
import { validateCompanyConfig, type ValidationResult } from "@/lib/validateCompanyConfig";

export function useCompanyConfigValidation(config: CompanyConfig): {
  result: ValidationResult;
  isValid: boolean;
} {
  const result = useMemo(() => validateCompanyConfig(config), [config]);
  return { result, isValid: result.valid };
}
