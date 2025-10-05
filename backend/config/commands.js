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
    "sus": {
        "command_name": "sus",
        "cost": 10,
        "sound": "lurk.mp3",
        "reply": "{{username}} is sus!",
    },
    "dancingfox": {
        "command_name": "dancingfox",
        "cost": 100,
        "video": "follow-dance.mp4"
    },
    "vindication": {
        "command_name": "vindication",
        "cost": 50,
        "sound": "vindication.mp3",
        "volume": 1.0,
        "reply": "Vindication sound played for {{username}}!"
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
