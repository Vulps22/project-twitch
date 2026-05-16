export class Logger {
    static SENSITIVE_PATTERNS: RegExp[] = [
        /.*token.*/i,
        /.*secret.*/i,
        /.*key.*/i,
        /.*password.*/i,
        /.*auth.*/i,
        /.*_id$/i,
        /.*id$/i,
        /.*client_id.*/i,
        /.*access_token.*/i,
        /.*refresh_token.*/i,
        /.*api_key.*/i,
        /.*private.*/i,
        /.*credential.*/i,
        /.*session.*/i,
        /twitch.*token/i,
        /twitch.*id/i,
        /twitch.*secret/i,
        /broadcaster.*id/i,
        /user.*id/i,
        /channel.*id/i,
        /session.*id/i,
    ];

    static SENSITIVE_VALUES: string[] = [
        process.env.TWITCH_ACCESS_TOKEN,
        process.env.TWITCH_CLIENT_ID,
        process.env.TWITCH_CLIENT_SECRET,
    ].filter((v): v is string => Boolean(v));

    static sanitizeValue(key: string, value: unknown): unknown {
        if (value == null) return value;

        const isSensitiveKey = this.SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
        const isSensitiveValue = this.SENSITIVE_VALUES.some(sensitiveVal =>
            String(value).includes(sensitiveVal)
        );

        if (isSensitiveKey || isSensitiveValue) {
            if (typeof value === 'string') {
                if (value.length <= 4) return 'XXX';
                if (value.length <= 10) return 'XXXXXXX';
                return value.substring(0, 2) + 'X'.repeat(value.length - 4) + value.substring(value.length - 2);
            }
            return 'XXXXXXX';
        }

        return value;
    }

    static sanitizeObject(obj: unknown, maxDepth = 10): unknown {
        if (maxDepth <= 0) return '[Max Depth Reached]';
        if (obj == null) return obj;

        if (Array.isArray(obj)) {
            return obj.map(item =>
                typeof item === 'object' ? this.sanitizeObject(item, maxDepth - 1) : item
            );
        }

        if (typeof obj === 'object') {
            const sanitized: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = typeof value === 'object' && value !== null
                    ? this.sanitizeObject(value, maxDepth - 1)
                    : this.sanitizeValue(key, value);
            }
            return sanitized;
        }

        return obj;
    }

    static log(...args: unknown[]): void {
        const sanitized = args.map(a => typeof a === 'object' ? this.sanitizeObject(a) : a);
        console.log(...(sanitized as unknown[]));
    }

    static error(...args: unknown[]): void {
        const sanitized = args.map(a => typeof a === 'object' ? this.sanitizeObject(a) : a);
        console.error(...(sanitized as unknown[]));
    }

    static warn(...args: unknown[]): void {
        const sanitized = args.map(a => typeof a === 'object' ? this.sanitizeObject(a) : a);
        console.warn(...(sanitized as unknown[]));
    }

    static info(...args: unknown[]): void {
        const sanitized = args.map(a => typeof a === 'object' ? this.sanitizeObject(a) : a);
        console.info(...(sanitized as unknown[]));
    }

    static debug(...args: unknown[]): void {
        const sanitized = args.map(a => typeof a === 'object' ? this.sanitizeObject(a) : a);
        console.debug(...(sanitized as unknown[]));
    }

    static logWithContext(context: string, ...args: unknown[]): void {
        this.log(`[${context}]`, ...args);
    }

    static testSanitization(obj: unknown): void {
        console.log('Original (UNSAFE):', obj);
        console.log('Sanitized (SAFE):', this.sanitizeObject(obj));
    }

    static addSensitivePattern(pattern: RegExp | string): void {
        this.SENSITIVE_PATTERNS.push(
            pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i')
        );
    }

    static addSensitiveValue(value: string): void {
        if (value && !this.SENSITIVE_VALUES.includes(value)) {
            this.SENSITIVE_VALUES.push(value);
        }
    }
}

export default Logger;
