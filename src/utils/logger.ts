export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
  userId?: string;
  component?: string;
  action?: string;
}

export class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogSize = 1000; // Maximum logs to keep in memory
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {
    // Initialize log level from environment
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLevel) {
      this.logLevel = LogLevel[envLevel as keyof typeof LogLevel] || LogLevel.INFO;
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private createLogEntry(level: LogLevel, message: string, context?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      component: context?.component,
      action: context?.action,
      userId: context?.userId
    };
  }

  private addLog(entry: LogEntry) {
    this.logs.push(entry);
    
    // Keep logs under maximum size
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      const levelName = LogLevel[entry.level];
      const prefix = `[${entry.timestamp}] ${levelName}:`;
      
      switch (entry.level) {
        case LogLevel.ERROR:
          console.error(prefix, entry.message, entry.context);
          break;
        case LogLevel.WARN:
          console.warn(prefix, entry.message, entry.context);
          break;
        case LogLevel.INFO:
          console.info(prefix, entry.message, entry.context);
          break;
        case LogLevel.DEBUG:
          console.debug(prefix, entry.message, entry.context);
          break;
      }
    }
  }

  error(message: string, context?: any) {
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry = this.createLogEntry(LogLevel.ERROR, message, context);
      this.addLog(entry);
    }
  }

  warn(message: string, context?: any) {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry = this.createLogEntry(LogLevel.WARN, message, context);
      this.addLog(entry);
    }
  }

  info(message: string, context?: any) {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry = this.createLogEntry(LogLevel.INFO, message, context);
      this.addLog(entry);
    }
  }

  debug(message: string, context?: any) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const entry = this.createLogEntry(LogLevel.DEBUG, message, context);
      this.addLog(entry);
    }
  }

  // AI Service specific logging
  logAIRequest(action: string, prompt: string, userId?: string) {
    this.info(`AI Request: ${action}`, {
      component: 'AIService',
      action,
      userId,
      promptLength: prompt.length,
      timestamp: new Date().toISOString()
    });
  }

  logAIResponse(action: string, success: boolean, responseLength?: number, userId?: string, error?: any) {
    if (success) {
      this.info(`AI Response: ${action}`, {
        component: 'AIService',
        action,
        userId,
        responseLength,
        timestamp: new Date().toISOString()
      });
    } else {
      this.error(`AI Error: ${action}`, {
        component: 'AIService',
        action,
        userId,
        error: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Database specific logging
  logDatabaseOperation(operation: string, table: string, userId?: string, recordId?: string) {
    this.debug(`DB Operation: ${operation}`, {
      component: 'Database',
      action: operation,
      userId,
      table,
      recordId,
      timestamp: new Date().toISOString()
    });
  }

  logDatabaseError(operation: string, error: any, userId?: string) {
    this.error(`DB Error: ${operation}`, {
      component: 'Database',
      action: operation,
      userId,
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }

  // Authentication logging
  logAuthAttempt(email: string, success: boolean, userId?: string) {
    if (success) {
      this.info('User login successful', {
        component: 'Auth',
        action: 'login',
        userId,
        email,
        timestamp: new Date().toISOString()
      });
    } else {
      this.warn('User login failed', {
        component: 'Auth',
        action: 'login_failed',
        email,
        timestamp: new Date().toISOString()
      });
    }
  }

  logUserAction(action: string, userId: string, details?: any) {
    this.info(`User Action: ${action}`, {
      component: 'UserAction',
      action,
      userId,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // Get logs for debugging
  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filteredLogs = this.logs;
    
    if (level !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.level <= level);
    }
    
    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }
    
    return filteredLogs;
  }

  // Get error logs specifically
  getErrorLogs(limit?: number): LogEntry[] {
    return this.getLogs(LogLevel.ERROR, limit);
  }

  // Export logs for analysis
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Clear logs (useful for testing)
  clearLogs() {
    this.logs = [];
  }

  // Get log statistics
  getLogStats(): {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    debug: number;
  } {
    return {
      total: this.logs.length,
      errors: this.logs.filter(log => log.level === LogLevel.ERROR).length,
      warnings: this.logs.filter(log => log.level === LogLevel.WARN).length,
      info: this.logs.filter(log => log.level === LogLevel.INFO).length,
      debug: this.logs.filter(log => log.level === LogLevel.DEBUG).length
    };
  }
}

// Export singleton instance
export const logger = Logger.getInstance();