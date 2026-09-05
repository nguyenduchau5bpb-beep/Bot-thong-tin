const { 
    Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    EmbedBuilder, REST, Routes, SlashCommandBuilder, AttachmentBuilder 
} = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json({ limit: '15mb' }));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Phân luồng kênh thông báo
const CHANNELS = {
    NORMAL: process.env.CHANNEL_ID || '1542997364875468870',
    VIP: '1544750425880924160',
    CRITICAL: '1545447777541296241'
};

const activeSessions = new Map();
const pendingCommands = new Map();

// Slash Commands có Auto-Complete
const commands = [
    new SlashCommandBuilder().setName('matrix').setDescription('🌐 Xem trạng thái toàn bộ tài khoản trong ma trận'),
    new SlashCommandBuilder().setName('matrix_all').setDescription('⚡ Phát lệnh đồng loạt tới TOÀN BỘ tài khoản')
        .addStringOption(opt => opt.setName('action').setDescription('Hành động (hop, kill)').setRequired(true)),
    new SlashCommandBuilder().setName('status').setDescription('📊 Xem thông số phần cứng & game')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder().setName('screenshot').setDescription('📸 Yêu cầu chụp màn hình Live')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder().setName('hop').setDescription('🔄 Ép tài khoản đổi Server')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder().setName('hop_low').setDescription('📉 Tìm Server ít người nhất')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder().setName('say').setDescription('💬 Bắt tài khoản chat trong game')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('text').setDescription('Nội dung chat').setRequired(true)),
    new SlashCommandBuilder().setName('eval').setDescription('⚠️ Chạy code Lua trực tiếp')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('code').setDescription('Code Lua').setRequired(true)),
    new SlashCommandBuilder().setName('kill').setDescription('⛔ Tắt game khẩn cấp')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản').setRequired(true).setAutocomplete(true))
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
    console.log(`🚀 Overlord Matrix Bot Online: ${client.user.tag}`);
    if (process.env.CLIENT_ID && process.env.BOT_TOKEN) {
        const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
        try {
            await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
            console.log('✅ Đã đồng bộ Slash Commands!');
        } catch (e) { console.error('Lỗi Slash:', e); }
    }
});

// Xử lý Gợi ý Nick Tự Động & Lệnh Slash
client.on('interactionCreate', async (interaction) => {
    if (interaction.isAutocomplete()) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const onlineUsers = Array.from(activeSessions.keys());
        const filtered = onlineUsers.filter(user => user.toLowerCase().includes(focusedValue));
        await interaction.respond(filtered.map(user => ({ name: `🟢 ${user}`, value: user })).slice(0, 25));
        return;
    }

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'matrix') {
            if (activeSessions.size === 0) return interaction.reply({ content: '❌ Không có tài khoản nào đang kết nối!', ephemeral: true });
            let msg = '🌐 **DANH SÁCH TÀI KHOẢN ĐANG ONLINE:**\n';
            activeSessions.forEach((data, user) => {
                msg += `• **${user}** | PlaceID: \`${data.placeId}\` | FPS: ${data.fps} | Ping: ${data.ping}ms\n`;
            });
            return interaction.reply({ content: msg, ephemeral: true });
        }

        if (commandName === 'matrix_all') {
            const action = interaction.options.getString('action');
            if (activeSessions.size === 0) return interaction.reply({ content: '❌ Hệ thống đang trống!', ephemeral: true });
            activeSessions.forEach((_, username) => {
                if (action === 'hop') pendingCommands.set(username, { type: 'FORCE_HOP' });
                else if (action === 'kill') pendingCommands.set(username, { type: 'KILL_GAME' });
            });
            return interaction.reply({ content: `⚡ Đã phát lệnh **${action.toUpperCase()}** tới toàn bộ ${activeSessions.size} tài khoản!` });
        }

        const targetUser = interaction.options.getString('username');
        if (!activeSessions.has(targetUser)) {
            return interaction.reply({ content: `❌ **LỖI:** Tài khoản \`${targetUser}\` hiện **OFFLINE** hoặc nhập sai tên!`, ephemeral: true });
        }

        if (commandName === 'status') {
            const data = activeSessions.get(targetUser);
            const embed = new EmbedBuilder()
                .setTitle(`📊 Trạng Thái Trực Tuyến: ${targetUser}`)
                .setColor(0x00FF00)
                .addFields(
                    { name: '🎮 Place ID', value: `\`${data.placeId}\``, inline: true },
                    { name: '🆔 Job ID', value: `\`${data.jobId}\``, inline: true },
                    { name: '⚡ Hiệu Năng', value: `FPS: ${data.fps} | Ping: ${data.ping}ms | RAM: ${data.ram}MB`, inline: false }
                );
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'screenshot') {
            pendingCommands.set(targetUser, { type: 'TAKE_SCREENSHOT' });
            return interaction.reply({ content: `📸 Đã gửi yêu cầu chụp ảnh tới **${targetUser}**.` });
        }

        if (commandName === 'hop') {
            pendingCommands.set(targetUser, { type: 'FORCE_HOP' });
            return interaction.reply({ content: `🔄 Đã gửi lệnh Hop Server tới **${targetUser}**.` });
        }

        if (commandName === 'hop_low') {
            pendingCommands.set(targetUser, { type: 'HOP_LOW_SERVER' });
            return interaction.reply({ content: `📉 Đã gửi lệnh tìm Server ít người cho **${targetUser}**.` });
        }

        if (commandName === 'say') {
            const txt = interaction.options.getString('text');
            pendingCommands.set(targetUser, { type: 'SAY_CHAT', text: txt });
            return interaction.reply({ content: `💬 Đã ép **${targetUser}** chat: "${txt}"` });
        }

        if (commandName === 'eval') {
            const code = interaction.options.getString('code');
            pendingCommands.set(targetUser, { type: 'EVAL_CODE', code: code });
            return interaction.reply({ content: `⚠️ Đã truyền tải lệnh Lua tới **${targetUser}**.` });
        }

        if (commandName === 'kill') {
            pendingCommands.set(targetUser, { type: 'KILL_GAME' });
            return interaction.reply({ content: `⛔ Đã gửi lệnh Tắt Game tới **${targetUser}**.` });
        }
    }

    if (interaction.isButton()) {
        const [action, username] = interaction.customId.split('_');
        if (!activeSessions.has(username)) return interaction.reply({ content: `❌ **LỖI:** Tài khoản \`${username}\` đã Offline!`, ephemeral: true });
        if (action === 'hop') pendingCommands.set(username, { type: 'FORCE_HOP' });
        else if (action === 'cap') pendingCommands.set(username, { type: 'TAKE_SCREENSHOT' });
        else if (action === 'kill') pendingCommands.set(username, { type: 'KILL_GAME' });
        return interaction.reply({ content: `✅ Đã thực thi thao tác cho **${username}**`, ephemeral: true });
    }
});

// Giám sát tự động - Báo động khẩn khi Nick bị Crash/Freeze
setInterval(async () => {
    const now = Date.now();
    activeSessions.forEach(async (data, username) => {
        if (now - data.lastSeen > 15000) {
            activeSessions.delete(username);
            try {
                const channel = await client.channels.fetch(CHANNELS.CRITICAL);
                if (channel) {
                    channel.send(`🚨 **CẢNH BÁO KHẨN:** Tài khoản **${username}** bị ngắt kết nối hoặc crash game!`);
                }
            } catch (e) { console.error(e); }
        }
    });
}, 5000);

// API Receiver
async function sendNotification(data) {
    let targetChannel = CHANNELS.NORMAL;
    let color = 0x3498DB;

    if (data.alertLevel === 'CRITICAL') { targetChannel = CHANNELS.CRITICAL; color = 0xFF0000; }
    else if (data.alertLevel === 'VIP' || data.screenshotBase64) { targetChannel = CHANNELS.VIP; color = 0xF1C40F; }

    try {
        const channel = await client.channels.fetch(targetChannel);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(data.eventTitle || '📡 Báo Cáo Ma Trận')
            .setColor(color)
            .addFields(
                { name: '👤 Nick', value: `${data.username}`, inline: true },
                { name: '🎮 Place ID', value: `\`${data.placeId}\``, inline: true },
                { name: '📊 FPS / Ping', value: `${data.fps} FPS / ${data.ping}ms`, inline: true }
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`hop_${data.username}`).setLabel('🔄 Hop Server').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`cap_${data.username}`).setLabel('📸 Chụp Live').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`kill_${data.username}`).setLabel('⛔ Kill Game').setStyle(ButtonStyle.Danger)
        );

        let options = { embeds: [embed], components: [row] };

        if (data.screenshotBase64) {
            const buf = Buffer.from(data.screenshotBase64, 'base64');
            const file = new AttachmentBuilder(buf, { name: 'screen.png' });
            embed.setImage('attachment://screen.png');
            options.files = [file];
        }

        await channel.send(options);
    } catch (e) { console.error('Lỗi Send Discord:', e); }
}

app.post('/api/matrix', async (req, res) => {
    const data = req.body;
    if (!data || !data.username) return res.status(400).json({ error: 'Bad Data' });

    activeSessions.set(data.username, {
        fps: data.fps,
        ping: data.ping,
        ram: data.ram,
        jobId: data.jobId,
        placeId: data.placeId,
        lastSeen: Date.now()
    });

    if (data.screenshotBase64 || data.alertLevel !== 'NORMAL' || data.eventTitle !== 'Cập Nhật Trạng Thái') {
        await sendNotification(data);
    }

    const nextCmd = pendingCommands.get(data.username) || null;
    if (nextCmd) pendingCommands.delete(data.username);

    res.status(200).json({ status: 'SUCCESS', cmd: nextCmd });
});

app.listen(process.env.PORT || 3000, () => console.log('Matrix System Online'));
client.login(process.env.BOT_TOKEN);
 
