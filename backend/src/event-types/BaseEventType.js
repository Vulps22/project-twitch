export class BaseEventType {

    /** @returns {string} Unique identifier for this event type e.g. 'chat_command' */
    get type() {
        throw new Error(`${this.constructor.name} must implement get type()`);
    }

    /**
     * Returns true if the raw incoming event matches the given config entry.
     * @param {object} rawEvent - Raw event data from the platform
     * @param {object} config - A single event config entry from events.js
     * @returns {boolean}
     */
    match(rawEvent, config) {
        throw new Error(`${this.constructor.name} must implement match()`);
    }

    /**
     * Extracts template variables from the raw event for use in replies and overlay text.
     * @param {object} rawEvent - Raw event data from the platform
     * @returns {{ username?: string, count?: string, display_name?: string, [key: string]: string }}
     */
    extractTemplateData(rawEvent) {
        throw new Error(`${this.constructor.name} must implement extractTemplateData()`);
    }
}
