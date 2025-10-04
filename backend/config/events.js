// Events Configuration
// ES6 module version
// To add a new event, add it to the EVENTS object below

export const EVENTS = {
    "follow": {
        "event_name": "follow",
        "text": "{{username}} is following!",
        "video": "follow-dance.mp4",
        "sound": "follow.mp3",
        "reply": "Thanks {{username}} for the follow!",
        "transition_in": "bounce-in",
        "transition_out": "bounce-out",
        "timeout": "20s"
    },
    "subscription": {
        "event_name": "subscription",
        "text": "{{username}} just subscribed!",
        "reply": "Welcome to the community, {{username}}!",
        "transition_in": "scale-in",
        "transition_out": "scale-out",
        "timeout": "6s"
    },
    "raid": {
        "event_name": "raid",
        "text": "{{username}} is raiding with {{count}} viewers!",
        "reply": "Thanks for the raid, {{username}}!",
        "transition_in": "slide-right-in",
        "transition_out": "slide-right-out",
        "timeout": "8s"
    }
};

// Helper functions (optional)
export function getEventNames() {
    return Object.keys(EVENTS);
}

export function getEvent(name) {
    return EVENTS[name.toLowerCase()];
}

export default EVENTS;
