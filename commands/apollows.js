const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'apollows',
    async execute(message, args) {
        // Only bot owner can use this command
        if (message.author.id !== message.client.ownerId) {
            return message.reply('❌ This command is reserved for the bot owner.');
        }

        const guilds = message.client.guilds.cache;
        const guildList = [];

        for (const [id, guild] of guilds) {
            try {
                // Fetch the owner to get the accurate username
                const owner = await guild.fetchOwner();
                guildList.push(`**${guild.name}**\n• Members: \`${guild.memberCount}\`\n• Owner: \`${owner.user.tag}\` (\`${guild.ownerId}\`)`);
            } catch (err) {
                guildList.push(`**${guild.name}**\n• Members: \`${guild.memberCount}\`\n• Owner: \`Unknown\``);
            }
        }

        const embed = new EmbedBuilder()
            .setColor('#1A1A1A')
            .setTitle('📡 Apollo\'s Network Status')
            .setThumbnail(message.client.user.displayAvatarURL())
            .setDescription(`Currently active in **${guilds.size}** circles of wisdom.\n\n${guildList.join('\n\n')}\n\n[Support or get premium](https://discord.gg/qusXGtgK8j)`)
            .setFooter({ text: 'Wisdom Circle Archival System • Master View', iconURL: message.guild.iconURL({ dynamic: true }) })
            .setTimestamp();

        return message.channel.send({ embeds: [embed] });
    }
};
