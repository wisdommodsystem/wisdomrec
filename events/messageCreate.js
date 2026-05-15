module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot) return;

        // Trigger help command if the bot is mentioned
        if (message.mentions.has(client.user) && !message.mentions.everyone) {
            const helpCommand = client.commands.get('help');
            if (helpCommand) {
                return helpCommand.execute(message, []);
            }
        }

        if (!message.content.startsWith(client.prefix)) return;

        const args = message.content.slice(client.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName);

        if (!command) return;

        try {
            await command.execute(message, args);
        } catch (error) {
            console.error(error);
            message.reply('There was an error trying to execute that command!');
        }
    }
};
