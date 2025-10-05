// Commands Configuration
// ES6 module version
// To add a new command, add it to the COMMANDS object below

export const COMMANDS = {
    "lurk": {
        "command_name": "lurk",
        "image": "lurk.png",
        "sound": "lurk.mp3",
        "text": "{{username}}",
        "reply": "Thank you for lurking, {{username}}!",
        "transition_in": "fade-in",
        "transition_out": "fade-out",
        "timeout": "6s"
    },
    "discord": {
        "command_name": "discord",
        "reply": "\nJoin our Discord: https://discord.vulps.co.uk",
    },
    "spam": {
        "command_name": "spam",
        "reply": "!spam",
    }
};

// Helper functions (optional)
export function getCommandNames() {
    return Object.keys(COMMANDS);
}

export function getCommand(name) {
    return COMMANDS[name.toLowerCase()];
}

export default COMMANDS;
