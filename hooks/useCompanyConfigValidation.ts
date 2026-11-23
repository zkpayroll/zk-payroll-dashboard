"use client";

import { useMemo } from "react";
import type { CompanyConfig } from "@/types";
import { validateCompanyConfig, type ValidationResult } from "@/lib/validateCompanyConfig";
import {
  validateCompanyConfigMigration,
  type PolicyMigrationValidationResult,
} from "@/lib/company/policyMigration";

export function useCompanyConfigValidation(config: CompanyConfig): {
  result: ValidationResult;
  isValid: boolean;
  /** Organization policy migration state (see `PolicyMigrationStatus`). */
  migration: PolicyMigrationValidationResult;
} {
  const result = useMemo(() => validateCompanyConfig(config), [config]);
  const migration = useMemo(() => validateCompanyConfigMigration(config), [config]);
  return { result, isValid: result.valid, migration };
}
