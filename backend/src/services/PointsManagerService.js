// Points Manager Service
// Handles automatic points accrual for active viewers

import { getUser, createUser, addPoints, spendPoints } from '../utils/database.js';
import { POINTS_CONFIG } from '../../config/points.js';
import Logger from '../utils/Logger.js';

export class PointsManagerService {
    constructor(options = {}) {
        this.config = { ...POINTS_CONFIG }; // Copy config to allow runtime updates
        this.activeViewers = new Map(); // twitchId -> { username, lastSeen }
        this.accrualTimer = null;
    }

    setTwitchClient(client = null) {
        if(!client) throw new Error("Twitch Client is required")
        this.twitchClient = client;
    }

    // Start the points accrual system
    start() {
        if (!this.config.enabled) {
            Logger.info('PointsManagerService: Points system is disabled, not starting');
            return;
        }
        
        if (this.accrualTimer) {
            Logger.warn('PointsManagerService: Already running');
            return;
        }
        
        this.accrualTimer = setInterval(() => {
            this.awardPointsToViewers();
        }, this.config.ACCRUAL_INTERVAL);
        
        Logger.info('PointsManagerService: Started', {
            points_per_minute: this.config.POINTS_PER_MINUTE,
            activity_timeout_minutes: this.config.ACTIVITY_TIMEOUT / (60 * 1000),
            interval_seconds: this.config.ACCRUAL_INTERVAL / 1000
        });
    }

    // Stop the points accrual system
    stop() {
        if (this.accrualTimer) {
            clearInterval(this.accrualTimer);
            this.accrualTimer = null;
            Logger.info('PointsManagerService: Stopped');
        }
    }

    /**
     * Record user activity (call this when user sends a chat message)
     * @param {*} twitchId 
     * @param {*} username 
     * @deprecated Will be removed in future  - No alternative
     */
    recordUserActivity(twitchId, username) {
        if (!this.config.enabled) {
            return; // Skip activity recording when points system is disabled
        }
        
        const now = Date.now();
        
        this.activeViewers.set(twitchId, {
            username: username,
            lastSeen: now
        });
        
        Logger.debug('PointsManagerService: User activity recorded', { 
            twitch_id: twitchId, 
            username: username,
            timestamp: new Date(now).toISOString()
        });
    }

    /**
     * Award points to all active users
     * @deprecated Use awardPointsToViewers instead
     */
    async awardPointsToActiveUsers() {
        Logger.error("PointsManagerService: awardPointsToActiveUsers is deprecated. Use awardPointsToViewers instead.");
        process.exit(1);
        const now = Date.now();
        const activeUsers = [];
        const inactiveUsers = [];
        
        // Check all viewers and separate active from inactive
        for (const [twitchId, userInfo] of this.activeViewers.entries()) {
            const timeSinceLastSeen = now - userInfo.lastSeen;
            
            if (timeSinceLastSeen <= this.config.ACTIVITY_TIMEOUT) {
                activeUsers.push({ twitchId, ...userInfo });
            } else {
                inactiveUsers.push({ twitchId, ...userInfo });
            }
        }
        
        // Remove inactive users from tracking
        inactiveUsers.forEach(user => {
            this.activeViewers.delete(user.twitchId);
            Logger.debug('PointsManagerService: User marked inactive', { 
                twitch_id: user.twitchId, 
                username: user.username,
                inactive_for_minutes: Math.round((now - user.lastSeen) / (60 * 1000))
            });
        });
        
        // Award points to active users
        if (activeUsers.length > 0) {
            Logger.info(`PointsManagerService: Awarding points to ${activeUsers.length} active users`);
            
            for (const user of activeUsers) {
                try {
                    await this.awardPointsToUser(user.twitchId, user.username);
                } catch (error) {
                    Logger.error('PointsManagerService: Failed to award points to user', {
                        twitch_id: user.twitchId,
                        username: user.username,
                        error: error.message
                    });
                }
            }
        } else {
            Logger.debug('PointsManagerService: No active users to award points to');
        }
    }

    /**
     * Award points to all viewers currently in chat (fetched from Twitch)
     * @returns {Promise<void>}
     */
    async awardPointsToViewers() {
        const viewers = await this.twitchClient.getUserList() || [];
        Logger.debug('PointsManagerService: Current Twitch viewers:', viewers);
        // Award points to active users
        if (viewers.length > 0) {
            Logger.info(`PointsManagerService: Awarding points to ${viewers.length} active users`);

            for (const user of viewers) {
                Logger.log(user);
                try {
                    await this.awardPointsToUser(user.user_id, user.user_name);
                } catch (error) {
                    Logger.error('PointsManagerService: Failed to award points to user', {
                        twitch_id: user.user_id,
                        username: user.user_name,
                        error: error.message
                    });
                }
            }
        } else {
            Logger.debug('PointsManagerService: No users to award points to');
        }
    }


    // Award points to a specific user
    async awardPointsToUser(twitchId, username) {

        Logger.log('PointsManagerService: Awarding points to user', { 
            twitch_id: twitchId, 
            username: username,
            points: this.config.POINTS_PER_MINUTE
        });

        try {
            // Check if user exists in database
            let user = await getUser(twitchId);
            
            // Create user if they don't exist
            if (!user) {
                await createUser(twitchId, username);
                Logger.info('PointsManagerService: New user created for points accrual', { 
                    twitch_id: twitchId, 
                    username: username 
                });
            }
            
            // Award points
            await addPoints(twitchId, this.config.POINTS_PER_MINUTE, 'accrual:watching');
            
            Logger.debug('PointsManagerService: Points awarded', { 
                twitch_id: twitchId, 
                username: username,
                points: this.config.POINTS_PER_MINUTE
            });
            
        } catch (error) {        
            throw new Error(`Failed to award points: ${error.message}`);
        }
    }

    /**
     * Get the count of currently active viewers
     * @returns {number} Count of currently active viewers
     * @deprecated TODO: create alternative
     */
    getActiveViewersCount() {
        const now = Date.now();
        let activeCount = 0;
        
        for (const [twitchId, userInfo] of this.activeViewers.entries()) {
            const timeSinceLastSeen = now - userInfo.lastSeen;
            if (timeSinceLastSeen <= this.config.ACTIVITY_TIMEOUT) {
                activeCount++;
            }
        }
        
        return activeCount;
    }

    // Get list of active viewers (for debugging)
    getActiveViewers() {
        if(!this.twitchClient) {
            throw new Error("Twitch Client is required to fetch viewers");
        }
        
        const viewers = this.twitchClient.getUserList();

        Logger.log('PointsManagerService: Current Twitch viewers:', viewers);
        const now = Date.now();
        const activeUsers = [];
        
        for (const [twitchId, userInfo] of this.activeViewers.entries()) {
            const timeSinceLastSeen = now - userInfo.lastSeen;
            if (timeSinceLastSeen <= this.config.ACTIVITY_TIMEOUT) {
                activeUsers.push({
                    twitchId,
                    username: userInfo.username,
                    lastSeenMinutesAgo: Math.round(timeSinceLastSeen / (60 * 1000))
                });
            }
        }
        
        return activeUsers;
    }

    async canUserAfford(twitchId, cost) {
        if (!this.config.enabled) {
            return true; // Always afford when points system is disabled
        }
        const points = await this.getUserPoints(twitchId);
        return points >= cost; //user has more points and can afford: true
    }

    async getUserPoints(twitchId) {
        const user = await getUser(twitchId);
        return user ? user.points : 0;
    }

    spendUserPoints(twitchId, amount, reason) {
        if (!this.config.enabled) {
            return; // Skip spending points when system is disabled
        }
        
        if (!this.canUserAfford(twitchId, amount)) {
            throw new Error('Insufficient points');
        }

        spendPoints(twitchId, amount, reason);

        
    }

    // Get points accrual statistics
    getStats() {
        return {
            config: {
                pointsPerMinute: this.config.POINTS_PER_MINUTE,
                activityTimeoutMinutes: this.config.ACTIVITY_TIMEOUT / (60 * 1000),
                accrualIntervalSeconds: this.config.ACCRUAL_INTERVAL / 1000
            },
            activeViewers: this.getActiveViewersCount(),
            totalTrackedViewers: this.activeViewers.size,
            isRunning: this.accrualTimer !== null
        };
    }

    // Update configuration (runtime configuration changes)
    updateConfig(newConfig) {
        if (newConfig.pointsPerMinute !== undefined) {
            this.config.POINTS_PER_MINUTE = newConfig.pointsPerMinute;
        }
        if (newConfig.activityTimeoutMinutes !== undefined) {
            this.config.ACTIVITY_TIMEOUT = newConfig.activityTimeoutMinutes * 60 * 1000;
        }
        if (newConfig.accrualIntervalSeconds !== undefined) {
            this.config.ACCRUAL_INTERVAL = newConfig.accrualIntervalSeconds * 1000;
            
            // Restart timer with new interval if running
            if (this.accrualTimer) {
                this.stop();
                this.start();
            }
        }
        
        Logger.info('PointsManagerService: Configuration updated', this.config);
    }
}

export default PointsManagerService;