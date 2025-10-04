// Safe Logger for Streaming
// Automatically sanitizes sensitive data from console output

export class Logger {
    // Sensitive patterns to detect and sanitize
    static SENSITIVE_PATTERNS = [
        // Environment variable patterns
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
        
        // Twitch specific
        /twitch.*token/i,
        /twitch.*id/i,
        /twitch.*secret/i,
        /broadcaster.*id/i,
        /user.*id/i,
        /channel.*id/i,
        /session.*id/i,
    ];

    // Values that should always be hidden (exact matches)
    static SENSITIVE_VALUES = [
        process.env.TWITCH_ACCESS_TOKEN,
        process.env.TWITCH_CLIENT_ID,
        process.env.TWITCH_CLIENT_SECRET,
    ].filter(Boolean); // Remove undefined values

    // Sanitize a single value
    static sanitizeValue(key, value) {
        if (value == null) return value;
        
        // Check if the key matches sensitive patterns
        const isSensitiveKey = this.SENSITIVE_PATTERNS.some(pattern => 
            pattern.test(key)
        );

        // Check if the value matches known sensitive values
        const isSensitiveValue = this.SENSITIVE_VALUES.some(sensitiveVal => 
            String(value).includes(sensitiveVal)
        );

        if (isSensitiveKey || isSensitiveValue) {
            // Different masking based on value type and length
            if (typeof value === 'string') {
                if (value.length <= 4) return 'XXX';
                if (value.length <= 10) return 'XXXXXXX';
                return value.substring(0, 2) + 'X'.repeat(value.length - 4) + value.substring(value.length - 2);
            }
            return 'XXXXXXX';
        }

        return value;
    }

    // Deep sanitize an object or array
    static sanitizeObject(obj, maxDepth = 10) {
        if (maxDepth <= 0) return '[Max Depth Reached]';
        if (obj == null) return obj;
        
        // Handle arrays
        if (Array.isArray(obj)) {
            return obj.map(item => 
                typeof item === 'object' ? this.sanitizeObject(item, maxDepth - 1) : item
            );
        }

        // Handle objects
        if (typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'object' && value !== null) {
                    sanitized[key] = this.sanitizeObject(value, maxDepth - 1);
                } else {
                    sanitized[key] = this.sanitizeValue(key, value);
                }
            }
            return sanitized;
        }

        return obj;
    }

    // Main logging methods
    static log(...args) {
        const sanitizedArgs = args.map(arg => 
            typeof arg === 'object' ? this.sanitizeObject(arg) : arg
        );
        console.log(...sanitizedArgs);
    }

    static error(...args) {
        const sanitizedArgs = args.map(arg => 
            typeof arg === 'object' ? this.sanitizeObject(arg) : arg
        );
        console.error(...sanitizedArgs);
    }

    static warn(...args) {
        const sanitizedArgs = args.map(arg => 
            typeof arg === 'object' ? this.sanitizeObject(arg) : arg
        );
        console.warn(...sanitizedArgs);
    }

    static info(...args) {
        const sanitizedArgs = args.map(arg => 
            typeof arg === 'object' ? this.sanitizeObject(arg) : arg
        );
        console.info(...sanitizedArgs);
    }

    static debug(...args) {
        const sanitizedArgs = args.map(arg => 
            typeof arg === 'object' ? this.sanitizeObject(arg) : arg
        );
        console.debug(...sanitizedArgs);
    }

    // Special method for logging with context (useful for debugging)
    static logWithContext(context, ...args) {
        this.log(`[${context}]`, ...args);
    }

    // Utility method to test sanitization
    static testSanitization(obj) {
        console.log('🧪 SANITIZATION TEST:');
        console.log('Original (UNSAFE):', obj);
        console.log('Sanitized (SAFE):', this.sanitizeObject(obj));
    }

    // Method to add custom sensitive patterns at runtime
    static addSensitivePattern(pattern) {
        if (pattern instanceof RegExp) {
            this.SENSITIVE_PATTERNS.push(pattern);
        } else {
            this.SENSITIVE_PATTERNS.push(new RegExp(pattern, 'i'));
        }
    }

    // Method to add custom sensitive values at runtime
    static addSensitiveValue(value) {
        if (value && !this.SENSITIVE_VALUES.includes(value)) {
            this.SENSITIVE_VALUES.push(value);
        }
    }
}

export default Logger;