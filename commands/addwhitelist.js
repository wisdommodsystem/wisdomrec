const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'addwhitelist',
    async execute(message, args) {
        // Only bot owner can use this command
        if (message.author.id !== message.client.ownerId) {
            return message.reply('❌ This command is reserved for the bot owner.');
        }

        const guildId = args[0];
        if (!guildId) {
            return message.reply('❌ Please provide a Guild ID. Usage: `!addwhitelist <guildId>`');
        }

        if (message.client.whitelistedGuilds.includes(guildId)) {
            return message.reply('⚠️ This server is already whitelisted.');
        }

        message.client.whitelistedGuilds.push(guildId);
        
        const embed = new EmbedBuilder()
            .setColor('#1A1A1A')
            .setTitle('✨ Whitelist Updated')
            .setDescription(`Server \`${guildId}\` has been granted **Premium Tier** access (10m limit).\n\n[Support or get premium](https://discord.gg/qusXGtgK8j)`)
            .setTimestamp()
            .setFooter({ text: 'Wisdom Circle Archival System', iconURL: message.client.user.displayAvatarURL() });

        return message.channel.send({ embeds: [embed] });
    }
};
