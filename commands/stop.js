const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { createCloudinaryUploadStream } = require('../src/utils/cloudinaryUploader');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = {
    name: 'stop',
    async execute(message, args) {
        // 1. Check if recording is active
        if (!message.client.recordings.has(message.guild.id)) {
            return message.reply('❌ No recording is currently active in this server.');
        }

        const session = message.client.recordings.get(message.guild.id);
        const { connection, path: recordingPath, originalNickname, sessionName, autoStopTimeout } = session;

        // Clear the auto-stop timer if it was manually stopped
        if (autoStopTimeout) clearTimeout(autoStopTimeout);

        // 2. Feedback: Status message
        const statusMsg = await message.channel.send({
             embeds: [new EmbedBuilder()
                 .setColor('#1A1A1A')
                 .setTitle('⏳ Finalizing Circle Archive')
                 .setDescription('Synthesizing audio streams and preparing the high-quality master...\n\n[Support or get premium](https://discord.gg/qusXGtgK8j)')
                 .setFooter({ text: 'Wisdom Circle Archival System' })]
         });

        // 3. Stop recording and disconnect
        await new Promise(resolve => setTimeout(resolve, 1000));
        connection.destroy();
        message.client.recordings.delete(message.guild.id);

        try {
            await message.guild.members.me.setNickname(originalNickname);
        } catch (err) {
            console.error('Failed to reset nickname:', err);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!fs.existsSync(recordingPath)) {
            console.error(`Recording path not found: ${recordingPath}`);
            return await statusMsg.edit(`❌ Error: Recording folder not found on disk at ${recordingPath}`);
        }

        const allFiles = fs.readdirSync(recordingPath).filter(file => file.endsWith('.pcm'));
        const files = allFiles.filter(file => {
            const filePath = path.resolve(recordingPath, file);
            const stats = fs.statSync(filePath);
            if (stats.size < 10240) {
                fs.unlinkSync(filePath);
                return false;
            }
            return true;
        });
        
        if (files.length === 0) {
            await statusMsg.edit('⚠️ No audio data was captured during this session.');
            fs.rmSync(recordingPath, { recursive: true, force: true });
            return;
        }

        const outputFileName = `${sessionName}.mp3`;

        try {
            const complexFilter = getComplexFilter(files, recordingPath);
            await runStreamProcessing(files, outputFileName, complexFilter, sessionName, statusMsg, recordingPath);
        } catch (error) {
            console.error('Advanced Processing Failed, attempting Simple Merge fallback:', error);
            await statusMsg.edit('⚠️ Advanced processing failed. Attempting a simple merge to recover audio...');
            
            try {
                const fallbackFilter = [{ filter: 'amix', options: { inputs: files.length, duration: 'longest' } }];
                await runStreamProcessing(files, outputFileName, fallbackFilter, sessionName, statusMsg, recordingPath);
            } catch (fallbackError) {
                console.error('Final Fallback Failed:', fallbackError);
                await statusMsg.edit('❌ Failed to process the recording even with fallback.');
            }
        }
    }
};

function getComplexFilter(files, recordingPath) {
    const userIds = [...new Set(files.map(f => f.split('-')[0]))];
    const complexFilter = [];
    
    files.forEach((file, index) => {
        const parts = file.split('-');
        const userId = parts[0];
        const offset = parts.length > 1 ? parts[1].split('.')[0] : '0';
        
        const userIdx = userIds.indexOf(userId);
        const panValue = userIds.length > 1 ? (userIdx / (userIds.length - 1)) * 0.2 - 0.1 : 0;
        const leftVol = (0.5 - panValue).toFixed(2);
        const rightVol = (0.5 + panValue).toFixed(2);

        complexFilter.push({ filter: 'aresample', options: '48000', inputs: `${index}:a`, outputs: `resampled${index}` });
        complexFilter.push({ filter: 'pan', options: `stereo|c0=${leftVol}*c0|c1=${rightVol}*c1`, inputs: `resampled${index}`, outputs: `panned${index}` });
        complexFilter.push({ filter: 'volume', options: '0.7', inputs: `panned${index}`, outputs: `headroom${index}` });
        complexFilter.push({ filter: 'adelay', options: `${offset}|${offset}`, inputs: `headroom${index}`, outputs: `delayed${index}` });
    });

    complexFilter.push({ filter: 'amix', options: { inputs: files.length, duration: 'longest', dropout_transition: 1000, normalize: 0 }, inputs: files.map((_, index) => `delayed${index}`), outputs: 'mixed' });
    complexFilter.push({ filter: 'agate', options: { threshold: 0.01 }, inputs: 'mixed', outputs: 'gated' });
    complexFilter.push({ filter: 'highpass', options: { f: 80 }, inputs: 'gated', outputs: 'hpf' });
    complexFilter.push({ filter: 'bass', options: { g: 3, f: 150 }, inputs: 'hpf', outputs: 'warm' });
    complexFilter.push({ filter: 'equalizer', options: { f: 4000, t: 'h', w: 1000, g: 1 }, inputs: 'warm', outputs: 'clear' });
    complexFilter.push({ filter: 'equalizer', options: { f: 6500, width_type: 'q', w: 1, g: -3 }, inputs: 'clear', outputs: 'deessed' });
    complexFilter.push({ filter: 'equalizer', options: { f: 8000, t: 'h', w: 1200, g: 3 }, inputs: 'deessed', outputs: 'air' });
    complexFilter.push({ filter: 'loudnorm', options: { I: -16, TP: -1.5, LRA: 11 }, inputs: 'air', outputs: 'normalized' });
    complexFilter.push({ filter: 'alimiter', options: { limit: 0.95, level: 1, attack: 5, release: 50 }, inputs: 'normalized' });

    return complexFilter;
}

async function runStreamProcessing(files, outputFileName, complexFilter, sessionName, statusMsg, recordingPath) {
    return new Promise((resolve, reject) => {
        const uploadStream = createCloudinaryUploadStream(outputFileName, async (error, result) => {
            if (error) {
                console.error('Cloudinary Stream Upload Error:', error);
                await statusMsg.channel.send(`⚠️ Processing complete, but Cloudinary upload failed.`);
                return reject(error);
            }
            
            const readyEmbed = new EmbedBuilder()
                .setColor('#1A1A1A') // Dark Premium
                .setTitle('✨ Wisdom Circle Episode Ready!')
                .setThumbnail(statusMsg.guild.iconURL({ dynamic: true, size: 512 }))
                .setDescription(`The session has been mastered and preserved in the archives.\n\n🔗 **Archive Link:** [Listen to the Wisdom](${result.secure_url})\n\n[Support or get premium](https://discord.gg/qusXGtgK8j)`)
                .addFields(
                    { name: '📜 Session ID', value: `\`${sessionName}\``, inline: true },
                    { name: '🏛️ Storage', value: 'Cloudinary Premium', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Wisdom Circle Archival System', iconURL: statusMsg.client.user.displayAvatarURL() });

            await statusMsg.channel.send({ embeds: [readyEmbed] });
            
            console.log(`Cleaning up session: ${sessionName}`);
            try {
                if (fs.existsSync(recordingPath)) fs.rmSync(recordingPath, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error('Cleanup Error:', cleanupError);
            }
            resolve();
        });

        const command = ffmpeg();
        files.forEach(file => {
            const inputPath = path.resolve(recordingPath, file);
            if (fs.existsSync(inputPath)) {
                command.input(inputPath).inputOptions(['-f s16le', '-ar 48000', '-ac 2']);
            }
        });

        command
            .complexFilter(complexFilter)
            .audioCodec('libmp3lame')
            .audioBitrate(128)
            .audioFrequency(44100)
            .outputOptions([
                '-threads 0'
            ])
            .format('mp3')
            .on('start', (cmd) => console.log('FFmpeg command:', cmd))
            .on('error', (err) => {
                console.error('FFmpeg Stream Error:', err);
                if (!uploadStream.destroyed) uploadStream.destroy();
                reject(err);
            })
            .pipe(uploadStream);
    });
}
