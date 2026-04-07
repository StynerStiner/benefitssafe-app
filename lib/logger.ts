type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  [key: string]: unknown;
}

class Logger {
  private service = 'benefitssafe';

  private log(level: LogLevel, message: string,
    meta?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      ...meta,
    };
    if (level === 'error') {
      console.error(JSON.stringify(entry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  debug(msg: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== 'production') {
      this.log('debug', msg, meta);
    }
  }
  info(msg: string, meta?: Record<string, unknown>) {
    this.log('info', msg, meta);
  }
  warn(msg: string, meta?: Record<string, unknown>) {
    this.log('warn', msg, meta);
  }
  error(msg: string, meta?: Record<string, unknown>) {
    this.log('error', msg, meta);
  }
}

export const logger = new Logger();
