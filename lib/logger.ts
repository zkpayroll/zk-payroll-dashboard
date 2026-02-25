import { sanitize } from './sanitize';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',  // gray
  info: '\x1b[36m',   // cyan
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
  fatal: '\x1b[35m',  // magenta
};

const RESET = '\x1b[0m';

function getMinLevel(): LogLevel {
  const envLevel = (typeof process !== 'undefined' ? process.env?.LOG_LEVEL : undefined) as LogLevel | undefined;
  if (envLevel && envLevel in LEVEL_PRIORITY) return envLevel;
  const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
  return isDev ? 'debug' : 'info';
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getMinLevel()];
}

function isProduction(): boolean {
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
}

function formatDev(entry: LogEntry): string {
  const { timestamp, level, context, message, ...metadata } = entry;
  const color = LEVEL_COLORS[level];
  const time = timestamp.split('T')[1]?.replace('Z', '') ?? timestamp;
  const meta = Object.keys(metadata).length > 0
    ? ` ${JSON.stringify(metadata)}`
    : '';
  return `${color}[${level.toUpperCase()}]${RESET} ${time} [${context}] ${message}${meta}`;
}

function output(entry: LogEntry): void {
  if (isProduction()) {
    const consoleMethod = entry.level === 'fatal' ? 'error' : entry.level === 'debug' ? 'log' : entry.level;
    // eslint-disable-next-line no-console
    console[consoleMethod](JSON.stringify(entry));
  } else {
    const formatted = formatDev(entry);
    switch (entry.level) {
      case 'debug':
        // eslint-disable-next-line no-console
        console.debug(formatted);
        break;
      case 'info':
        // eslint-disable-next-line no-console
        console.info(formatted);
        break;
      case 'warn':
        // eslint-disable-next-line no-console
        console.warn(formatted);
        break;
      case 'error':
      case 'fatal':
        // eslint-disable-next-line no-console
        console.error(formatted);
        break;
    }
  }
}

export interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
  fatal(message: string, metadata?: Record<string, unknown>): void;
}

export function createLogger(context: string): Logger {
  function log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      ...(metadata ? sanitize(metadata) : {}),
    };

    output(entry);
  }

  return {
    debug: (message, metadata) => log('debug', message, metadata),
    info: (message, metadata) => log('info', message, metadata),
    warn: (message, metadata) => log('warn', message, metadata),
    error: (message, metadata) => log('error', message, metadata),
    fatal: (message, metadata) => log('fatal', message, metadata),
  };
}

export const logger = createLogger('app');
