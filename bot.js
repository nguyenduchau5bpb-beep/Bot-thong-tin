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

const CHANNELS = {
    NORMAL: '1542997364875468870',
    VIP: '1544750425880924160',
    CRITICAL: '1545447777541296241'
};

const activeSessions = new Map();
const pendingCommands = new Map();

// --- TẠO SLASH COMMANDS VỚI AUTO-COMPLETE ---
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
            console.log('✅ Đã đồng bộ Slash Commands Auto-Complete!');
        } catch (e) { console.error('Lỗi Slash:', e); }
    }
});

// --- XỬ LÝ GỢI Ý DANH SÁCH ACC TỰ ĐỘNG (AUTO-COMPLETE) ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isAutocomplete()) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        // Lấy danh sách nick đang Online thực tế
        const onlineUsers = Array.from(activeSessions.keys());
        
        const filtered = onlineUsers.filter(user => user.toLowerCase().includes(focusedValue));
        await interaction.respond(
            filtered.map(user => ({ name: `🟢 ${user}`, value: user })).slice(0, 25)
        );
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
            if (activeSessions.size === 0) return interaction.reply({ content: '❌ Không có tài khoản nào Online để gửi lệnh!', ephemeral: true });

            activeSessions.forEach((_, username) => {
                if (action === 'hop') pendingCommands.set(username, { type: 'FORCE_HOP' });
                else if (action === 'kill') pendingCommands.set(username, { type: 'KILL_GAME' });
            });
            return interaction.reply({ content: `⚡ Đã gửi lệnh **${action.toUpperCase()}** tới TOÀN BỘ ${activeSessions.size} tài khoản đang Online!` });
        }

        // KÍCH HOẠT BỘ KIỂM TRA TÀI KHOẢN ONLINE (CHECK ID)
        const targetUser = interaction.options.getString('username');
        if (!activeSessions.has(targetUser)) {
            return interaction.reply({ 
                content: `❌ **LỖI:** Tài khoản \`${targetUser}\` hiện **OFFLINE** hoặc nhập Sai Username! Vui lòng kiểm tra lại.`, 
                ephemeral: true 
            });
        }

        // NẾU TÀI KHOẢN ĐANG ONLINE -> THỰC THI LỆNH
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
        if (!activeSessions.has(username)) {
            return interaction.reply({ content: `❌ **LỖI:** Tài khoản \`${username}\` đã Offline!`, ephemeral: true });
        }
        if (action === 'hop') pendingCommands.set(username, { type: 'FORCE_HOP' });
        else if (action === 'cap') pendingCommands.set(username, { type: 'TAKE_SCREENSHOT' });
        else if (action === 'kill') pendingCommands.set(username, { type: 'KILL_GAME' });
        return interaction.reply({ content: `✅ Đã thực thi thao tác cho **${username}**`, ephemeral: true });
    }
});

// CO CHẾ TỰ ĐỘNG XÓA ACC OFF (TIMEOUT 15 GIÂY)
setInterval(() => {
    const now = Date.now();
    activeSessions.forEach((data, username) => {
        if (now - data.lastSeen > 15000) { // Quá 15s không gửi nhịp tim -> Coi như Offline
            activeSessions.delete(username);
            console.log(`❌ Account ${username} đã ngắt kết nối.`);
        }
    });
}, 5000);

// RECEIVE TELEMETRY
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

    const nextCmd = pendingCommands.get(data.username) || null;
    if (nextCmd) pendingCommands.delete(data.username);

    res.status(200).json({ status: 'SUCCESS', cmd: nextCmd });
});

app.listen(process.env.PORT || 3000, () => console.log('Matrix Live'));
client.login(process.env.BOT_TOKEN);
 
