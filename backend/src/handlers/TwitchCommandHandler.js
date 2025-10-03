// Twitch Command Handler
// ES6 module version

// Import dependencies
import { COMMANDS } from '../../config/commands.js';
import { Handler } from '../base/Handler.js';
import Logger from '../utils/Logger.js';



export class TwitchCommandHandler extends Handler {
    constructor(twitchClient = null, overlayBroadcaster = null) {
        super(twitchClient, overlayBroadcaster);
        this.commands = {};
        this.modules = {};
        this.init();
    }

    async init() {
        await this.loadCommands();
        Logger.info('TwitchCommandHandler: Initialized and ready to process commands');
    }

    async loadCommands() {
        try {
            // Use the imported COMMANDS from commands.js
            this.commands = COMMANDS;
            Logger.info('TwitchCommandHandler: Commands loaded:', Object.keys(this.commands));
        } catch (error) {
            console.error('TwitchCommandHandler: Failed to load commands:', error);
        }
    }

    // Main method to process chat messages and execute commands
    processChatMessage(messageText, userInfo) {
        Logger.debug('TwitchCommandHandler: Processing message:', messageText);
        
        if (messageText.startsWith('!')) {
            const commandText = messageText.substring(1);
            const commandName = commandText.split(' ')[0].toLowerCase();
            const args = commandText.split(' ').slice(1);
            
            Logger.logWithContext('COMMAND', 'Command detected:', {
                command_text: commandText,
                command_name: commandName,
                arguments: args,
                user_info: userInfo
            });
            
            this.executeCommand(commandName, args, userInfo);
        }
    }

    async executeCommand(commandName, args, userInfo) {
        console.log('=== EXECUTE COMMAND ===');
        console.log('Looking for command:', commandName);
        console.log('Available commands:', Object.keys(this.commands));
        console.log('Command found:', !!this.commands[commandName]);
        console.log('======================');
        
        if (this.commands[commandName]) {
            console.log('Executing JSON command:', this.commands[commandName]);
            
            // Prepare template data
            const templateData = {
                username: userInfo && userInfo.display_name ? userInfo.display_name : (userInfo && userInfo.username ? userInfo.username : '')
            };
            
            // Use base class method
            await this.executeConfig(this.commands[commandName], templateData);
        } else if (await this.loadModule(commandName)) {
            console.log('Executing module command:', commandName);
            await this.executeModuleCommand(commandName, args, userInfo);
        } else {
            console.log(`Unknown command: ${commandName}`);
        }
    }

    async loadModule(moduleName) {
        if (this.modules[moduleName]) {
            return true;
        }

        try {
            const module = await import(`../modules/${moduleName}.js`);
            this.modules[moduleName] = module;
            return true;
        } catch (error) {
            console.log(`Module ${moduleName} not found`);
            return false;
        }
    }

    async executeModuleCommand(moduleName, args, userInfo) {
        const module = this.modules[moduleName];
        if (module && module.default && typeof module.default.execute === 'function') {
            await module.default.execute(args, userInfo, this.container);
        }
    }


}

export default TwitchCommandHandler;
