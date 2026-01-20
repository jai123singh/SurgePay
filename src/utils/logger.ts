type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatTimestamp(): string {
    return new Date().toISOString();
}

function log(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>
): void {
    const timestamp = formatTimestamp();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (meta) {
        console.log(`${prefix} ${message}`, meta);
    } else {
        console.log(`${prefix} ${message}`);
    }
}

export function info(message: string, meta?: Record<string, unknown>): void {
    log('info', message, meta);
}

export function warn(message: string, meta?: Record<string, unknown>): void {
    log('warn', message, meta);
}

export function error(message: string, meta?: Record<string, unknown>): void {
    log('error', message, meta);
}

export function debug(message: string, meta?: Record<string, unknown>): void {
    // only log debug messages in development
    if (process.env.NODE_ENV === 'development') {
        log('debug', message, meta);
    }
}
