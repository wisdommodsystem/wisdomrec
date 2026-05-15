module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        const guildId = oldState.guild.id;
        if (!client.recordings || !client.recordings.has(guildId)) return;

        const session = client.recordings.get(guildId);
        
        // Check if the bot was moved or kicked
        if (oldState.member.id === client.user.id) {
            // If bot is disconnected from voice
            if (oldState.channelId && !newState.channelId) {
                console.log(`Bot was disconnected from voice in ${oldState.guild.name}. Stopping recording...`);
                
                // Find a text channel to send the notification
                const channel = client.channels.cache.get(session.channelId);
                if (channel) {
                    const stopCmd = client.commands.get('stop');
                    if (stopCmd) {
                        // Create a mock message object for the command
                        const mockMessage = {
                            guild: oldState.guild,
                            client: client,
                            channel: channel,
                            member: oldState.member,
                            reply: (msg) => channel.send(msg),
                            author: client.user
                        };
                        await stopCmd.execute(mockMessage, ['auto-stop']);
                    }
                }
            }
        }
        
        // Check if everyone left the channel except the bot
        const voiceChannel = oldState.guild.channels.cache.get(session.voiceChannelId);
        if (voiceChannel && voiceChannel.members.size === 1 && voiceChannel.members.has(client.user.id)) {
            console.log(`Channel ${voiceChannel.name} is empty. Stopping recording...`);
            const channel = client.channels.cache.get(session.channelId);
            if (channel) {
                const stopCmd = client.commands.get('stop');
                if (stopCmd) {
                    const mockMessage = {
                        guild: oldState.guild,
                        client: client,
                        channel: channel,
                        member: oldState.member,
                        reply: (msg) => channel.send(msg),
                        author: client.user
                    };
                    await stopCmd.execute(mockMessage, ['auto-stop']);
                }
            }
        }
    }
};
