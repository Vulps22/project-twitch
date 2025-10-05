# Points Manager Service

Handles automatic points accrual for active Twitch viewers using proper service architecture.

## Location
`backend/src/services/PointsManagerService.js`

## Configuration
Configuration is stored in `backend/config/points.js`:

```javascript
export const POINTS_CONFIG = {
    POINTS_PER_MINUTE: 10,              // Points awarded per minute  
    ACTIVITY_TIMEOUT: 5 * 60 * 1000,    // 5 minutes in milliseconds
    ACCRUAL_INTERVAL: 60 * 1000         // 1 minute in milliseconds
};
```

## Service Architecture

### Dependency Injection
The service is injected into `TwitchClient` via constructor:

```javascript
// In backend/index.js
const pointsManagerService = new PointsManagerService();
const twitchClient = new TwitchClient({
    pointsManagerService: pointsManagerService
});
```

### Service Methods
- `start()` - Start the points accrual timer
- `stop()` - Stop the points accrual timer  
- `recordUserActivity(twitchId, username)` - Record user chat activity
- `getActiveViewersCount()` - Get count of active viewers
- `getActiveViewers()` - Get detailed list of active viewers
- `getStats()` - Get system statistics and configuration
- `updateConfig(newConfig)` - Update configuration at runtime

## Integration Points

### TwitchClient Integration
- Service is injected during TwitchClient construction
- `recordUserActivity()` called on every chat message
- Automatic user creation when first points are awarded

### Database Integration  
- Uses existing database utility functions
- Creates users automatically via `createUser()`
- Awards points via `addPoints()` with reason `'accrual:watching'`
- All transactions logged automatically

### API Endpoints
- `GET /api/points/stats` - Service statistics
- `GET /api/points/viewers` - Active viewers list

## Service Lifecycle

1. **Initialization**: Service created in `backend/index.js`
2. **Injection**: Service injected into `TwitchClient`
3. **Startup**: `start()` called after TwitchClient initialization
4. **Operation**: Automatically tracks activity and awards points
5. **Shutdown**: `stop()` called during application shutdown

## Error Handling
- Service continues operation even with database errors
- Failed point awards logged but don't crash the system
- Graceful handling of missing dependencies

## Testing
The service can be tested independently:

```javascript
import PointsManagerService from './backend/src/services/PointsManagerService.js';

const service = new PointsManagerService();
service.start();
service.recordUserActivity('user123', 'TestUser');
// Points awarded automatically every minute
```