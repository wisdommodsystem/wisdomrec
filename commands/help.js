const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    async execute(message, args) {
        const prefix = message.client.prefix;
        
        const helpEmbed = new EmbedBuilder()
            .setColor('#1A1A1A') // Wisdom Circle Dark Premium
            .setTitle('🎙️ Wisdom Circle: Guide & Support')
            .setThumbnail(message.guild.iconURL({ dynamic: true, size: 512 }))
            .setDescription('Welcome to the **Wisdom Circle Archival System**. This bot is designed to capture and preserve the essence of high-quality conversations within our community.\n\n[Support or get premium](https://discord.gg/qusXGtgK8j)')
            .addFields(
                { name: '🚀 Commands', value: 
                    `\`${prefix}record [name]\` - Starts a high-quality recording session.\n` +
                    `\`${prefix}stop\` - Stops, masters, and archives the session.\n` +
                    `\`${prefix}help\` - Displays this guide.`
                },
                { name: '💎 Tier System', value: 
                    `• **Default:** 2-minute recording limit.\n` +
                    `• **Whitelisted:** 10-minute recording limit.`
                },
                { name: '🏛️ About the Project', value: 
                    `**Architect:** Apollo (Owner of Wisdom Circle)\n` +
                    `**Contact:** Join the server and open a **Ticket**.\n` +
                    `**Community:** [Wisdom Circle Official](https://discord.gg/qusXGtgK8j)`
                }
            )
            .setFooter({ text: 'Wisdom Circle Archival System • Crafted for Excellence', iconURL: message.client.user.displayAvatarURL() })
            .setTimestamp();

        return message.channel.send({ embeds: [helpEmbed] });
    }
};
