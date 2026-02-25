'use client';

import { useEffect } from 'react';
import { initMonitoring } from '@/lib/monitoring';

export function MonitoringProvider() {
  useEffect(() => {
    initMonitoring();
  }, []);

  return null;
}
