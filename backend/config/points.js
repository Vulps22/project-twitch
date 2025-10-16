// Points Configuration
// ES6 module version

export const POINTS_CONFIG = {
    //We recommend you disable this alpha feature for now
    enabled: true,                       // Enable/disable the entire points system
    POINTS_PER_MINUTE: 10,              // Points awarded per minute
    ACTIVITY_TIMEOUT: 5 * 60 * 1000,    // 5 minutes in milliseconds
    ACCRUAL_INTERVAL: 60 * 1000         // 1 minute in milliseconds
};

export default POINTS_CONFIG;