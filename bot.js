const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    AttachmentBuilder 
} = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json({ limit: '10mb' }));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ID 3 Kênh Discord Báo Cáo
const CHANNELS = {
    NORMAL: '1542997364875468870', // Kênh báo thường
    VIP: '1544750425880924160',    // Kênh báo VIP
    CRITICAL: '1545447777541296241' // Kênh báo khẩn
};

const activeSessions = new Map();
const pendingCommands = new Map();

// -------------------------------------------------------------
// 1. DANG KY SLASH COMMANDS (/)
// -------------------------------------------------------------
const commands = [
    new SlashCommandBuilder().setName('matrix').setDescription('Xem danh sách tài khoản đang kết nối'),
    new SlashCommandBuilder().setName('hop').setDescription('Yêu cầu tài khoản đổi Server Roblox')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản Roblox').setRequired(true)),
    new SlashCommandBuilder().setName('screenshot').setDescription('Chụp ảnh màn hình Roblox Realtime')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản Roblox').setRequired(true)),
    new SlashCommandBuilder().setName('kill').setDescription('Tắt game Roblox khẩn cấp')
        .addStringOption(opt => opt.setName('username').setDescription('Tên tài khoản Roblox').setRequired(true))
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
    console.log(`🤖 Bot Overlord đã Online: ${client.user.tag}`);

    if (process.env.CLIENT_ID && process.env.BOT_TOKEN) {
        const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
        try {
            console.log('🔄 Đang đồng bộ danh sách Slash Commands (/) với Discord...');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            console.log('✅ Đã đăng ký thành công toàn bộ Slash Commands!');
        } catch (err) {
            console.error('❌ Lỗi đăng ký Slash Commands:', err);
        }
    }
});

// -------------------------------------------------------------
// 2. PHÂN LOẠI VÀ GỬI THÔNG BÁO TỚI 3 KÊNH
// -------------------------------------------------------------
async function sendMatrixNotification(data) {
    // Xác định kênh gửi dựa vào Mức Độ Cảnh Báo (alertLevel)
    let targetChannelId = CHANNELS.NORMAL;
    let embedColor = 0x3498DB; // Xanh dương (Báo thường)

    if (data.alertLevel === 'CRITICAL') {
        targetChannelId = CHANNELS.CRITICAL;
        embedColor = 0xFF0000; // Đỏ (Báo khẩn)
    } else if (data.alertLevel === 'VIP' || data.screenshotBase64) {
        targetChannelId = CHANNELS.VIP;
        embedColor = 0xF1C40F; // Vàng (Báo VIP / Chụp Màn Hình)
    }

    try {
        const channel = await client.channels.fetch(targetChannelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(data.eventTitle || '📡 Báo Cáo Hệ Thống Matrix')
            .setColor(embedColor)
            .addFields(
                { name: '👤 Tài khoản', value: `${data.username} (${data.displayName})`, inline: true },
                { name: '📊 Chỉ số', value: `Level: ${data.level} | FPS: ${data.fps} | Ping: ${data.ping}ms`, inline: true },
                { name: '🍎 Trái ác quỷ', value: `${data.fruit || 'None'}`, inline: true }
            )
            .setTimestamp();

        // Nút bấm tương tác trực tiếp
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`hop_${data.username}`).setLabel('🔄 Hop Server').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`cap_${data.username}`).setLabel('📸 Chụp Ảnh').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`kill_${data.username}`).setLabel('⛔ Kill Game').setStyle(ButtonStyle.Danger)
        );

        let payloadToSend = { embeds: [embed], components: [row] };

        // Nếu có đính kèm ảnh chụp màn hình
        if (data.screenshotBase64) {
            const imageBuffer = Buffer.from(data.screenshotBase64, 'base64');
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'screenshot.png' });
            embed.setImage('attachment://screenshot.png');
            payloadToSend.files = [attachment];
        }

        // Nếu là báo khẩn -> Tag @everyone
        if (data.alertLevel === 'CRITICAL') {
            payloadToSend.content = '🚨 **CẢNH BÁO KHẨN CẤP!** @everyone';
        }

        await channel.send(payloadToSend);
    } catch (err) {
        console.error('❌ Lỗi khi gửi tin nhắn về kênh Discord:', err);
    }
}

// -------------------------------------------------------------
// 3. XỬ LÝ INTERACTION (SLASH COMMANDS & BUTTONS)
// -------------------------------------------------------------
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'matrix') {
            if (activeSessions.size === 0) {
                return interaction.reply({ content: '❌ Hiện không có tài khoản Roblox nào đang kết nối!', ephemeral: true });
            }
            let msg = '🟢 **DANH SÁCH TÀI KHOẢN ĐANG HOẠT ĐỘNG:**\n';
            activeSessions.forEach((data, username) => {
                msg += `• **${username}** | Level: ${data.level} | Ping: ${data.ping}ms | FPS: ${data.fps}\n`;
            });
            return interaction.reply({ content: msg, ephemeral: true });
        }

        const targetUser = interaction.options.getString('username');
        if (commandName === 'hop') {
            pendingCommands.set(targetUser, { type: 'FORCE_HOP' });
            return interaction.reply({ content: `🔄 Đã gửi lệnh **Hop Server** tới **${targetUser}**.` });
        }
        if (commandName === 'screenshot') {
            pendingCommands.set(targetUser, { type: 'TAKE_SCREENSHOT' });
            return interaction.reply({ content: `📸 Đã gửi yêu cầu **Chụp Ảnh** tới **${targetUser}**.` });
        }
        if (commandName === 'kill') {
            pendingCommands.set(targetUser, { type: 'KILL_GAME' });
            return interaction.reply({ content: `⛔ Đã gửi lệnh **Tắt Game** tới **${targetUser}**.` });
        }
    }

    if (interaction.isButton()) {
        const [action, username] = interaction.customId.split('_');
        if (action === 'hop') {
            pendingCommands.set(username, { type: 'FORCE_HOP' });
            return interaction.reply({ content: `🔄 Đã gửi lệnh **Hop Server** tới **${username}**.`, ephemeral: true });
        }
        if (action === 'cap') {
            pendingCommands.set(username, { type: 'TAKE_SCREENSHOT' });
            return interaction.reply({ content: `📸 Đã yêu cầu chụp màn hình **${username}**.`, ephemeral: true });
        }
        if (action === 'kill') {
            pendingCommands.set(username, { type: 'KILL_GAME' });
            return interaction.reply({ content: `⛔ Đã gửi lệnh **Kill Game** tới **${username}**.`, ephemeral: true });
        }
    }
});

// -------------------------------------------------------------
// 4. RECEIVE DATA FROM ROBLOX SCRIPT
// -------------------------------------------------------------
app.post('/api/matrix', async (res, req) => {
    // Sửa đúng vị trí req, res
});

app.post('/api/matrix', async (req, res) => {
    const data = req.body;
    if (!data || !data.username) {
        return res.status(400).json({ error: 'Dữ liệu không hợp lệ!' });
    }

    // Cập nhật bộ nhớ phiên làm việc
    activeSessions.set(data.username, {
        level: data.level,
        ping: data.ping,
        fps: data.fps,
        lastSeen: Date.now()
    });

    // Chỉ gửi Embed lên Discord khi có Sự kiện, Chụp ảnh, hoặc Báo Khẩn (Tránh spam tin nhắn báo status 3s/lần)
    if (data.screenshotBase64 || data.alertLevel !== 'NORMAL' || data.eventTitle !== 'Cập Nhật Trạng Thái') {
        await sendMatrixNotification(data);
    }

    // Lấy lệnh đang chờ để gửi về cho Roblox
    const nextCmd = pendingCommands.get(data.username) || null;
    if (nextCmd) {
        pendingCommands.delete(data.username);
    }

    res.status(200).json({
        status: 'SUCCESS',
        cmd: nextCmd
    });
});

// -------------------------------------------------------------
// 5. BOOT SERVER
// -------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Matrix Server đang chạy tại Port: ${PORT}`);
});

client.login(process.env.BOT_TOKEN);
 
