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

// Phân định 3 kênh chiến lược
const CHANNELS = {
    NORMAL: '1542997364875468870', // Kênh Telemetry thường
    VIP: '1544750425880924160',    // Kênh Ảnh chụp / Tương tác VIP
    CRITICAL: '1545447777541296241' // Kênh Báo động khẩn / Admin / Disconnect
};

const activeSessions = new Map();
const pendingCommands = new Map();

// Định nghĩa toàn bộ hệ thống lệnh Slash Commands (/)
const commands = [
    new SlashCommandBuilder().setName('matrix').setDescription('🌐 Xem trạng thái toàn bộ tài khoản trong ma trận'),
    new SlashCommandBuilder().setName('matrix_all').setDescription('⚡ Phát lệnh đồng loạt tới TOÀN BỘ tài khoản')
        .addStringOption(opt => opt.setName('action').setDescription('Hành động (hop, kill, say)').setRequired(true))
        .addStringOption(opt => opt.setName('value').setDescription('Nội dung tin nhắn (nếu chọn say)').setRequired(false)),
    new SlashCommandBuilder().setName('status').setDescription('📊 Xem thông số phần cứng & game chi tiết của 1 nick')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản Roblox').setRequired(true)),
    new SlashCommandBuilder().setName('screenshot').setDescription('📸 Yêu cầu chụp màn hình Live thực tế')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản Roblox').setRequired(true)),
    new SlashCommandBuilder().setName('hop').setDescription('🔄 Ép tài khoản đổi Server ngẫu nhiên')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản Roblox').setRequired(true)),
    new SlashCommandBuilder().setName('hop_low').setDescription('📉 Tìm và đổi sang Server ít người chơi nhất')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản Roblox').setRequired(true)),
    new SlashCommandBuilder().setName('say').setDescription('💬 Điều khiển tài khoản chat trong game')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản Roblox').setRequired(true))
        .addStringOption(opt => opt.setName('text').setDescription('Nội dung chat').setRequired(true)),
    new SlashCommandBuilder().setName('eval').setDescription('⚠️ Thực thi mã lệnh Lua trực tiếp từ Discord')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản Roblox').setRequired(true))
        .addStringOption(opt => opt.setName('code').setDescription('Đoạn code Lua').setRequired(true)),
    new SlashCommandBuilder().setName('kill').setDescription('⛔ Buộc đóng ứng dụng game khẩn cấp')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản Roblox').setRequired(true))
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
    console.log(`🚀 Universal Matrix Bot Online: ${client.user.tag}`);
    if (process.env.CLIENT_ID && process.env.BOT_TOKEN) {
        const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
        try {
            await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
            console.log('✅ Đã đồng bộ thành công toàn bộ Slash Commands!');
        } catch (e) { console.error('❌ Lỗi đồng bộ lệnh:', e); }
    }
});

// Xử lý sự kiện Tương tác (Slash Commands & Button Clicks)
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'matrix') {
            if (activeSessions.size === 0) return interaction.reply({ content: '❌ Không có tài khoản nào đang kết nối!', ephemeral: true });
            let msg = '🌐 **DANH SÁCH TÀI KHOẢN TRONG MA TRẬN:**\n';
            activeSessions.forEach((data, user) => {
                msg += `• **${user}** | PlaceID: \`${data.placeId}\` | FPS: ${data.fps} | Ping: ${data.ping}ms | RAM: ${data.ram}MB\n`;
            });
            return interaction.reply({ content: msg, ephemeral: true });
        }

        if (commandName === 'matrix_all') {
            const action = interaction.options.getString('action');
            const value = interaction.options.getString('value') || '';
            if (activeSessions.size === 0) return interaction.reply({ content: '❌ Hệ thống đang trống!', ephemeral: true });

            activeSessions.forEach((_, username) => {
                if (action === 'hop') pendingCommands.set(username, { type: 'FORCE_HOP' });
                else if (action === 'kill') pendingCommands.set(username, { type: 'KILL_GAME' });
                else if (action === 'say') pendingCommands.set(username, { type: 'SAY_CHAT', text: value });
            });
            return interaction.reply({ content: `⚡ Đã phát lệnh tập thể **${action.toUpperCase()}** tới toàn bộ ${activeSessions.size} tài khoản!` });
        }

        const targetUser = interaction.options.getString('username');

        if (commandName === 'status') {
            const data = activeSessions.get(targetUser);
            if (!data) return interaction.reply({ content: `❌ Tài khoản **${targetUser}** đang Offline!`, ephemeral: true });
            const embed = new EmbedBuilder()
                .setTitle(`📊 Trợ Lý Thông Số: ${targetUser}`)
                .setColor(0x00FF00)
                .addFields(
                    { name: '🎮 Place ID (Game)', value: `\`${data.placeId}\``, inline: true },
                    { name: '🆔 Job ID (Server)', value: `\`${data.jobId}\``, inline: true },
                    { name: '⚡ Hiệu Năng', value: `FPS: ${data.fps} | Ping: ${data.ping}ms | RAM: ${data.ram}MB`, inline: false }
                );
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'screenshot') {
            pendingCommands.set(targetUser, { type: 'TAKE_SCREENSHOT' });
            return interaction.reply({ content: `📸 Đã gửi yêu cầu chụp màn hình thực tế đến **${targetUser}**.` });
        }

        if (commandName === 'hop') {
            pendingCommands.set(targetUser, { type: 'FORCE_HOP' });
            return interaction.reply({ content: `🔄 Đã yêu cầu **${targetUser}** đổi Server.` });
        }

        if (commandName === 'hop_low') {
            pendingCommands.set(targetUser, { type: 'HOP_LOW_SERVER' });
            return interaction.reply({ content: `📉 Đang tìm Server ít người nhất cho **${targetUser}**.` });
        }

        if (commandName === 'say') {
            const txt = interaction.options.getString('text');
            pendingCommands.set(targetUser, { type: 'SAY_CHAT', text: txt });
            return interaction.reply({ content: `💬 Đã ép **${targetUser}** chat: "${txt}"` });
        }

        if (commandName === 'eval') {
            const code = interaction.options.getString('code');
            pendingCommands.set(targetUser, { type: 'EVAL_CODE', code: code });
            return interaction.reply({ content: `⚠️ Đã truyền tải mã lệnh Lua thực thi xuống **${targetUser}**.` });
        }

        if (commandName === 'kill') {
            pendingCommands.set(targetUser, { type: 'KILL_GAME' });
            return interaction.reply({ content: `⛔ Đã ra lệnh đóng game khẩn cấp cho **${targetUser}**.` });
        }
    }

    if (interaction.isButton()) {
        const [action, username] = interaction.customId.split('_');
        if (action === 'hop') pendingCommands.set(username, { type: 'FORCE_HOP' });
        else if (action === 'cap') pendingCommands.set(username, { type: 'TAKE_SCREENSHOT' });
        else if (action === 'kill') pendingCommands.set(username, { type: 'KILL_GAME' });
        return interaction.reply({ content: `✅ Đã thực thi thao tác nút cho **${username}**`, ephemeral: true });
    }
});

// Điều phối gửi thông báo tự động tới 3 kênh cấu hình riêng biệt
async function sendNotification(data) {
    let targetChannel = CHANNELS.NORMAL;
    let color = 0x3498DB;

    if (data.alertLevel === 'CRITICAL') { 
        targetChannel = CHANNELS.CRITICAL; 
        color = 0xFF0000; 
    } else if (data.alertLevel === 'VIP' || data.screenshotBase64) { 
        targetChannel = CHANNELS.VIP; 
        color = 0xF1C40F; 
    }

    try {
        const channel = await client.channels.fetch(targetChannel);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(data.eventTitle || '📡 Báo Cáo Ma Trận Hệ Thống')
            .setColor(color)
            .addFields(
                { name: '👤 Tài khoản', value: `${data.username}`, inline: true },
                { name: '🎮 Place ID', value: `\`${data.placeId}\``, inline: true },
                { name: '📊 Hiệu Năng', value: `${data.fps} FPS | ${data.ping}ms | ${data.ram}MB RAM`, inline: false }
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`hop_${data.username}`).setLabel('🔄 Hop Server').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`cap_${data.username}`).setLabel('📸 Chụp Live').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`kill_${data.username}`).setLabel('⛔ Kill Game').setStyle(ButtonStyle.Danger)
        );

        let payload = { embeds: [embed], components: [row] };

        if (data.screenshotBase64) {
            const buf = Buffer.from(data.screenshotBase64, 'base64');
            const file = new AttachmentBuilder(buf, { name: 'screenshot.png' });
            embed.setImage('attachment://screenshot.png');
            payload.files = [file];
        }

        if (data.alertLevel === 'CRITICAL') {
            payload.content = '🚨 **CẢNH BÁO SỰ CỐ KHẨN CẤP!** @everyone';
        }

        await channel.send(payload);
    } catch (e) { console.error('❌ Lỗi gửi thông báo Discord:', e); }
}

// Endpoint nhận Telemetry từ Roblox Client
app.post('/api/matrix', async (req, res) => {
    const data = req.body;
    if (!data || !data.username) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });

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

app.listen(process.env.PORT || 3000, () => console.log('🌐 Universal Matrix Command Server Online'));
client.login(process.env.BOT_TOKEN);
 
