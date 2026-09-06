const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

// =========================================================
// 1. CẤU HÌNH TOKEN & CLIENT ID (SỬA LẠI TOKEN MỚI TẠI ĐÂY NẾU CẦN)
// =========================================================
const CLIENT_ID = '1544756521387294830';

// Hệ thống sẽ ưu tiên lấy DISCORD_TOKEN trên Render, 
// nếu không có sẽ dùng Token dán trực tiếp dưới đây:
const BOT_TOKEN = process.env.DISCORD_TOKEN || 'DÁN_TOKEN_MỚI_VÀO_ĐÂY_NẾU_KHÔNG_DÙNG_ENV';

// =========================================================
// 2. CẤU HÌNH EXPRESS SERVER (CHỐNG NGỦ RENDER + UPTIMEROBOT 200 OK)
// =========================================================
const app = express();
app.use(express.json({ limit: '10mb' }));

// Route gốc / giúp UptimeRobot báo trạng thái XANH (200 OK) 100% miễn phí
app.get('/', (req, res) => {
    res.status(200).send("Server Bot Matrix đang hoạt động 24/7!");
});

// Danh sách lưu trữ các client Roblox kết nối
let activeClients = new Map();

// Endpoint nhận Heartbeat và trao đổi lệnh với Roblox Script
app.post('/api/matrix', (req, res) => {
    const data = req.body;
    if (!data || !data.userId) {
        return res.status(400).json({ error: "Thành phần dữ liệu thiếu thông tin!" });
    }

    activeClients.set(data.userId.toString(), {
        ...data,
        lastSeen: Date.now(),
        pendingCmd: activeClients.get(data.userId.toString())?.pendingCmd || null
    });

    const clientData = activeClients.get(data.userId.toString());
    
    if (clientData && clientData.pendingCmd) {
        const cmdToSend = clientData.pendingCmd;
        clientData.pendingCmd = null; // Đã nhận lệnh, xóa lệnh chờ
        return res.status(200).json({ cmd: { executed: false, ...cmdToSend } });
    }

    return res.status(200).json({ status: "OK", cmd: { executed: true } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server Matrix đang lắng nghe tại Cổng ${PORT}`));

// =========================================================
// 3. CẤU HÌNH DISCORD BOT & ĐĂNG KÝ SLASH COMMANDS
// =========================================================
if (!BOT_TOKEN || BOT_TOKEN.includes('DÁN_TOKEN_MỚI')) {
    console.error('❌ LỖI NGHIÊM TRỌNG: Bạn chưa điền Token Bot Discord vào mã nguồn hoặc Render Environment!');
    process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
    new SlashCommandBuilder()
        .setName('matrix_all')
        .setDescription('Quản lý tất cả tài khoản Roblox Matrix đang chạy')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
    try {
        console.log('🔄 Đang đăng ký Slash Commands với Discord...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Đã đăng ký thành công lệnh /matrix_all!');
    } catch (error) {
        console.error('❌ Lỗi khi đăng ký Slash Command:', error);
    }
})();

client.once('ready', () => {
    console.log(`🤖 Bot Discord đã đăng nhập thành công dưới tên: ${client.user.tag}`);
});

// =========================================================
// 4. XỬ LÝ LỆNH DISCORD & NÚT BẤM (CÓ DEFERREPLY CHỐNG TIMEOUT)
// =========================================================
client.on('interactionCreate', async (interaction) => {
    
    // --- Xử lý lệnh /matrix_all ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'matrix_all') {
        // Hoãn phản hồi ngay lập tức để tránh lỗi "Ứng dụng không phản hồi" (Timeout 3s)
        await interaction.deferReply();

        // Lọc các client mất kết nối quá 30s
        const now = Date.now();
        for (let [id, clientInfo] of activeClients.entries()) {
            if (now - clientInfo.lastSeen > 30000) {
                activeClients.delete(id);
            }
        }

        if (activeClients.size === 0) {
            return interaction.editReply({ content: '❌ Hiện tại không có tài khoản Roblox nào đang chạy Script Matrix!' });
        }

        let responseText = "🚨 **DANH SÁCH TÀI KHOẢN MATRIX ONLINE** 🚨\n\n";
        for (let [id, clientInfo] of activeClients.entries()) {
            responseText += `👤 **${clientInfo.displayName}** (@${clientInfo.username})\n`;
            responseText += `🎮 Place ID: \`${clientInfo.placeId}\` | Job ID: \`${clientInfo.jobId ? clientInfo.jobId.substring(0, 8) : 'N/A'}...\`\n`;
            responseText += `📊 FPS: \`${clientInfo.fps}\` | Ping: \`${clientInfo.ping}ms\` | RAM: \`${clientInfo.ram}MB\`\n-----------------------------------\n`;
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cmd_hop_all').setLabel('🔄 Hop Server').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('cmd_snap_all').setLabel('📸 Chụp Live').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cmd_kill_all').setLabel('⛔ Kill Game').setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({ content: responseText, components: [row] });
    }

    // --- Xử lý tương tác Nút Bấm ---
    if (interaction.isButton()) {
        await interaction.deferReply({ ephemeral: true });

        if (activeClients.size === 0) {
            return interaction.editReply({ content: '❌ Không có client Roblox nào đang hoạt động!' });
        }

        const customId = interaction.customId;

        if (customId === 'cmd_hop_all') {
            for (let clientInfo of activeClients.values()) {
                clientInfo.pendingCmd = { type: 'HOP_LOW_SERVER' };
            }
            await interaction.editReply({ content: '✅ Đã gửi lệnh **Hop Server** đến toàn bộ tài khoản!' });

        } else if (customId === 'cmd_snap_all') {
            for (let clientInfo of activeClients.values()) {
                clientInfo.pendingCmd = { type: 'TAKE_SCREENSHOT' };
            }
            await interaction.editReply({ content: '✅ Đã gửi lệnh **Chụp Ảnh Màn Hình** đến toàn bộ tài khoản!' });

        } else if (customId === 'cmd_kill_all') {
            for (let clientInfo of activeClients.values()) {
                clientInfo.pendingCmd = { type: 'KILL_GAME' };
            }
            await interaction.editReply({ content: '⚠️ Đã gửi lệnh **Kill Game (Tắt Roblox)** đến toàn bộ tài khoản!' });
        }
    }
});

client.login(BOT_TOKEN);
 
