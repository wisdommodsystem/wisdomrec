const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, EndBehaviorType } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const prism = require('prism-media');
const { pipeline } = require('stream');

module.exports = {
    name: 'record',
    async execute(message, args) {
        // 1. Validations: Voice channel and Permissions
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ You need to be in a voice channel to use this command!');
        }

        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has(PermissionsBitField.Flags.Connect) || !permissions.has(PermissionsBitField.Flags.Speak)) {
            return message.reply('❌ I need **CONNECT** and **SPEAK** permissions in your voice channel!');
        }

        // Initialize recordings Map if it doesn't exist
        if (!message.client.recordings) {
            message.client.recordings = new Map();
        }

        if (message.client.recordings.has(message.guild.id)) {
            return message.reply('⚠️ A recording is already active in this server.');
        }

        // 2. Tier & Limit Logic
        const isWhitelisted = message.client.whitelistedGuilds?.includes(message.guild.id) || false;
        const durationLimit = isWhitelisted ? 10 * 60 * 1000 : 2 * 60 * 1000; // 10m or 2m
        const limitLabel = isWhitelisted ? '10 Minutes (Whitelisted)' : '2 Minutes (Default)';

        // 3. Session Name & Path setup
        const rawSessionName = args[0] || `wisdom_${new Date().toISOString().split('T')[0]}`;
        const sanitizedSessionName = rawSessionName.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
        const sessionUniqueId = Date.now();
        const folderName = `${sanitizedSessionName}_${sessionUniqueId}`;
        
        // Use path.resolve for reliable absolute paths on Windows
        const rawBasePath = path.resolve(__dirname, '..', 'recordings', 'raw');
        const recordingPath = path.resolve(rawBasePath, folderName);
        
        if (!fs.existsSync(rawBasePath)) {
            fs.mkdirSync(rawBasePath, { recursive: true });
        }
        
        if (!fs.existsSync(recordingPath)) {
            fs.mkdirSync(recordingPath, { recursive: true });
        }

        // 4. Join Voice Channel
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false,
        });

        // Auto-stop timeout
        const autoStopTimeout = setTimeout(async () => {
            const stopCommand = message.client.commands.get('stop');
            if (stopCommand) {
                await message.channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF4444')
                        .setTitle('⏰ Time Limit Reached')
                        .setDescription(`The recording has reached its **${limitLabel}** limit and is being processed automatically.`)]
                });
                await stopCommand.execute(message, []);
            }
        }, durationLimit);

        const session = {
            connection,
            path: recordingPath, 
            folderName: folderName,
            sessionName: sanitizedSessionName,
            startTime: Date.now(), 
            durationLimit,
            autoStopTimeout,
            channelId: message.channel.id,
            voiceChannelId: voiceChannel.id,
            streams: new Map(), 
            originalNickname: message.guild.members.me.nickname || message.client.user.username
        };

        message.client.recordings.set(message.guild.id, session);

        // 5. Aesthetic UI Update
        const startEmbed = new EmbedBuilder()
            .setColor('#1A1A1A') // Wisdom Circle Dark Premium
            .setTitle('🎙️ Wisdom Circle: Session Started')
            .setThumbnail(message.guild.iconURL({ dynamic: true, size: 512 }))
            .addFields(
                { name: 'Owner', value: `<@${process.env.BOT_OWNER_ID}>`, inline: true},
                { name: 'Stop Session', value: `\`${process.env.PREFIX}stop\``, inline: true },
                { name: '📜 Session', value: `\`${sanitizedSessionName}\``, inline: true },
                { name: '⏳ Limit', value: `\`${limitLabel}\``, inline: true },
                { name: '📍 Channel', value: `<#${voiceChannel.id}>`, inline: true }
            )
            .setDescription('*Capturing the essence of the conversation...*\n\n[Support or get premium](https://discord.gg/qusXGtgK8j)')
            .setFooter({ text: 'Wisdom Circle Archival System', iconURL: message.client.user.displayAvatarURL() })
            .setTimestamp();

        await message.channel.send({ embeds: [startEmbed] });

        // Update nickname for cinematic feel
        try {
            await message.guild.members.me.setNickname(`🔴 REC | ${session.sessionName}`);
        } catch (err) {}

        // 5. Listen for speaking events and capture streams
        connection.receiver.speaking.on('start', (userId) => {
            const user = message.guild.members.cache.get(userId)?.user || { tag: userId };
            
            try {
                // Keep the same file handle open for longer (3 seconds of silence before closing)
                // This drastically reduces the number of small PCM fragments
                if (session.streams.has(userId)) {
                    return; // Already recording this user in a stable session
                }

                // Create a PCM stream from the user's Opus stream
                const opusStream = connection.receiver.subscribe(userId, {
                    end: {
                        behavior: EndBehaviorType.AfterSilence,
                        duration: 3000, // 3s silence ends the burst - keeps file open longer
                    },
                });

                opusStream.readableHighWaterMark = 1024 * 512;

                const pcmStream = new prism.opus.Decoder({ 
                    rate: 48000, 
                    channels: 2, 
                    frameSize: 960 
                });

                // Error listener for Opus Decoder to handle corruption during long sessions
                pcmStream.on('error', (error) => {
                    console.error(`Opus Decoder Error for ${user.tag}:`, error);
                });

                // Calculate offset from global start time for file naming/timing
                const offset = Date.now() - session.startTime;
                const fileName = `${userId}-${offset}.pcm`;
                const filePath = path.join(recordingPath, fileName);
                const writeStream = fs.createWriteStream(filePath, { highWaterMark: 1024 * 1024 });

                const streamBundle = { opusStream, writeStream };
                session.streams.set(userId, streamBundle);

                // Small delay to ensure stream is stable before piping
                setTimeout(() => {
                    if (opusStream.destroyed || opusStream.readableEnded) return;

                    console.log(`Recording stable session for ${user.tag} starting at ${offset}ms`);
                    
                    pipeline(
                        opusStream,
                        pcmStream,
                        writeStream,
                        (err) => {
                            if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
                                console.error(`Pipeline error for ${user.tag}:`, err);
                            }
                            // Cleanup session map when stream truly ends after silence
                            if (session.streams.get(userId) === streamBundle) {
                                session.streams.delete(userId);
                            }
                        }
                    );
                }, 100);

            } catch (error) {
                console.error(`Failed to subscribe to ${user.tag}:`, error);
            }
        });

        // Handle connection lifecycle
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5000),
                ]);
            } catch (error) {
                // If it doesn't reconnect, clean up
                console.log('Bot disconnected from voice.');
                // Trigger stop logic if not already stopped
                const stopCmd = message.client.commands.get('stop');
                if (stopCmd) {
                    await stopCmd.execute(message, ['auto-stop']);
                }
            }
        });
    }
};

// Helper for entersState if needed (though usually imported)
const { entersState } = require('@discordjs/voice');
