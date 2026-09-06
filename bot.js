const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

// =========================================================
// 1. CẤU HÌNH EXPRESS SERVER (CHỐNG NGỦ RENDER + UPTIMEROBOT)
// =========================================================
const app = express();
app.use(express.json({ limit: '10mb' }));

// Route gốc / giúp UptimeRobot nhận mã 200 OK (Khắc phục lỗi 404/Yêu cầu gói Pro)
app.get('/', (req, res) => {
    res.status(200).send("Server Bot Matrix đang hoạt động 24/7!");
});

// Lưu trữ danh sách client Roblox kết nối
let activeClients = new Map();

// Endpoint nhận Heartbeat từ Script Roblox
app.post('/api/matrix', (req, res) => {
    const data = req.body;
    if (!data || !data.userId) {
        return res.status(400).json({ error: "Thành phần dữ liệu thiếu thông tin!" });
    }

    // Cập nhật thông tin client mới nhất
    activeClients.set(data.userId.toString(), {
        ...data,
        lastSeen: Date.now(),
        pendingCmd: null // Nơi chứa lệnh chờ gửi xuống Roblox
    });

    const clientData = activeClients.get(data.userId.toString());
    
    // Kiểm tra xem có lệnh chờ từ Discord gửi xuống Roblox không
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
// 2. CẤU HÌNH DISCORD BOT
// =========================================================
const BOT_TOKEN = process.env.DISCORD_TOKEN; // Cấu hình trong Environment Variables của Render
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Đăng ký Slash Command /matrix_all
const commands = [
    new SlashCommandBuilder()
        .setName('matrix_all')
        .setDescription('Quản lý tất cả tài khoản Roblox Matrix đang chạy')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
    try {
        console.log('Đang đăng ký Slash Commands...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Đã đăng ký lệnh /matrix_all thành công!');
    } catch (error) {
        console.error('Lỗi khi đăng ký lệnh:', error);
    }
})();

// Xử lý sự kiện khi Bot sẵn sàng
client.once('ready', () => {
    console.log(`🤖 Bot Discord đã đăng nhập dưới tên: ${client.user.tag}`);
});

// Xử lý tương tác Slash Command & Nút bấm
client.on('interactionCreate', async (interaction) => {
    
    // --- 1. Xử lý lệnh /matrix_all ---
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'matrix_all') {
            // FIX LỖI "ỨNG DỤNG KHÔNG PHẢN HỒI": Hoãn phản hồi ngay lập tức để tránh Timeout 3s
            await interaction.deferReply();

            // Lọc bỏ các client quá 30 giây không gửi Heartbeat
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
                responseText += `🎮 Place ID: \`${clientInfo.placeId}\` | Job ID: \`${clientInfo.jobId.substring(0, 8)}...\`\n`;
                responseText += `📊 FPS: \`${clientInfo.fps}\` | Ping: \`${clientInfo.ping}ms\` | RAM: \`${clientInfo.ram}MB\`\n-----------------------------------\n`;
            }

            // Tạo các nút bấm điều khiển
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cmd_hop_all').setLabel('🔄 Hop Server').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('cmd_snap_all').setLabel('📸 Chụp Live').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('cmd_kill_all').setLabel('⛔ Kill Game').setStyle(ButtonStyle.Danger)
            );

            await interaction.editReply({ content: responseText, components: [row] });
        }
    }

    // --- 2. Xử lý khi bấm nút (Button Interactions) ---
    if (interaction.isButton()) {
        // Hoãn phản hồi nút bấm để tránh lỗi timeout
        await interaction.deferReply({ ephemeral: true });

        const customId = interaction.customId;

        if (activeClients.size === 0) {
            return interaction.editReply({ content: '❌ Không có client nào khả dụng để thực hiện lệnh!' });
        }

        if (customId === 'cmd_hop_all') {
            for (let clientInfo of activeClients.values()) {
                clientInfo.pendingCmd = { type: 'HOP_LOW_SERVER' };
            }
            await interaction.editReply({ content: '✅ Đã gửi lệnh **Hop Server** đến tất cả tài khoản!' });

        } else if (customId === 'cmd_snap_all') {
            for (let clientInfo of activeClients.values()) {
                clientInfo.pendingCmd = { type: 'TAKE_SCREENSHOT' };
            }
            await interaction.editReply({ content: '✅ Đã gửi yêu cầu **Chụp Ảnh Màn Hình** đến tất cả tài khoản!' });

        } else if (customId === 'cmd_kill_all') {
            for (let clientInfo of activeClients.values()) {
                clientInfo.pendingCmd = { type: 'KILL_GAME' };
            }
            await interaction.editReply({ content: '⚠️ Đã gửi lệnh **Kill Game (Shutdown)** đến tất cả tài khoản!' });
        }
    }
});

client.login(BOT_TOKEN);
 
