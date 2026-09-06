const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const express = require('express');

// =========================================================
// 1. CẤU HÌNH TOKEN & CLIENT ID
// =========================================================
const CLIENT_ID = process.env.CLIENT_ID || '1544756521387294830';
const BOT_TOKEN = process.env.DISCORD_TOKEN || 'DAN_TOKEN_MOI_VAO_DAY';

// =========================================================
// 2. EXPRESS SERVER & KẾT NỐI MATRIX
// =========================================================
const app = express();
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
    res.status(200).send("Server Bot Matrix 100+ Commands đang hoạt động 24/7!");
});

let activeClients = new Map();

app.post('/api/matrix', (req, res) => {
    const data = req.body;
    if (!data || !data.userId) return res.status(400).json({ error: "Thiếu UID!" });

    const uid = data.userId.toString();
    const existing = activeClients.get(uid);

    activeClients.set(uid, {
        ...data,
        alias: existing?.alias || null,
        lastSeen: Date.now(),
        pendingCmd: existing?.pendingCmd || null
    });

    const clientData = activeClients.get(uid);
    if (clientData && clientData.pendingCmd) {
        const cmdToSend = clientData.pendingCmd;
        clientData.pendingCmd = null;
        return res.status(200).json({ cmd: { executed: false, ...cmdToSend } });
    }

    return res.status(200).json({ status: "OK", cmd: { executed: true } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server Matrix 100 Commands nghe cổng ${PORT}`));

// =========================================================
// 3. ĐĂNG KÝ TRỌN BỘ 100+ SLASH COMMANDS
// =========================================================
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const uOpt = (o) => o.setName('user').setDescription('UserID, Username hoặc "all"').setRequired(true);
const bOpt = (o) => o.setName('enable').setDescription('True = Bật, False = Tắt').setRequired(true);
const strOpt = (name, desc, req = true) => (o) => o.setName(name).setDescription(desc).setRequired(req);
const numOpt = (name, desc, req = true) => (o) => o.setName(name).setDescription(desc).setRequired(req);

const commandsList = [
    // --- nhóm 1: Quản lý Quản trị & Hệ thống (1 - 15) ---
    new SlashCommandBuilder().setName('matrix_all').setDescription('[1] Xem danh sách và bảng điều khiển tổng'),
    new SlashCommandBuilder().setName('matrix_stats').setDescription('[2] Thống kê RAM, FPS, Ping hệ thống'),
    new SlashCommandBuilder().setName('matrix_info').setDescription('[3] Xem chi tiết 1 account').addStringOption(uOpt),
    new SlashCommandBuilder().setName('matrix_cmd').setDescription('[4] Gửi lệnh nhanh qua menu').addStringOption(uOpt).addStringOption(o => o.setName('command').setDescription('Lệnh nhanh').setRequired(true).addChoices({ name: '🔄 Hop Server', value: 'HOP_LOW_SERVER' }, { name: '⛔ Kill Game', value: 'KILL_GAME' })),
    new SlashCommandBuilder().setName('matrix_say').setDescription('[5] Chat văn bản vào Roblox từ xa').addStringOption(uOpt).addStringOption(strOpt('message', 'Nội dung chat')),
    new SlashCommandBuilder().setName('matrix_rejoin').setDescription('[6] Rejoin lại server hiện tại').addStringOption(uOpt),
    new SlashCommandBuilder().setName('matrix_job').setDescription('[7] Chuyển Server bằng Job ID').addStringOption(uOpt).addStringOption(strOpt('job_id', 'Job ID')),
    new SlashCommandBuilder().setName('matrix_place').setDescription('[8] Đổi Game bằng Place ID').addStringOption(uOpt).addStringOption(strOpt('place_id', 'Place ID')),
    new SlashCommandBuilder().setName('matrix_exec').setDescription('[9] Thực thi đoạn mã Lua từ xa').addStringOption(uOpt).addStringOption(strOpt('script', 'Code Lua')),
    new SlashCommandBuilder().setName('matrix_clear').setDescription('[10] Xóa danh sách Client tạm'),
    new SlashCommandBuilder().setName('matrix_ping').setDescription('[11] Kiểm tra độ trễ Bot'),
    new SlashCommandBuilder().setName('matrix_restart').setDescription('[12] Reset tiến trình Server Bot'),
    new SlashCommandBuilder().setName('matrix_alias').setDescription('[13] Đặt biệt danh cho Acc').addStringOption(strOpt('user', 'User ID/Username')).addStringOption(strOpt('alias', 'Biệt danh mới')),
    new SlashCommandBuilder().setName('matrix_webhook').setDescription('[14] Cài Webhook gửi thông báo').addStringOption(strOpt('url', 'URL Webhook')),
    new SlashCommandBuilder().setName('matrix_notify').setDescription('[15] Bật/tắt thông báo sự kiện').addStringOption(uOpt).addBooleanOption(bOpt),

    // --- NHÓM 2: Tối ưu Tải & Đồ họa (16 - 30) ---
    new SlashCommandBuilder().setName('matrix_fps').setDescription('[16] Giới hạn FPS').addStringOption(uOpt).addIntegerOption(numOpt('cap', 'Mức FPS (1-60)')),
    new SlashCommandBuilder().setName('matrix_blackout').setDescription('[17] Bật/Tắt màn hình đen tiết kiệm GPU').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_lowgfx').setDescription('[18] Đồ họa siêu thấp').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_rendering').setDescription('[19] Bật/Tắt 3D Rendering').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_audio').setDescription('[20] Bật/Tắt âm thanh Game').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_gui').setDescription('[21] Ẩn/Hiện GUI Roblox').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_textures').setDescription('[22] Xóa Texture vật thể').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_shadows').setDescription('[23] Bật/Tắt Đổ bóng').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_particles').setDescription('[24] Bật/Tắt Hiệu ứng hạt (Particle)').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_fog').setDescription('[25] Bật/Tắt Mù sương (Fog)').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_blur').setDescription('[26] Bật/Tắt Hiệu ứng Blur/Lighting').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_skybox').setDescription('[27] Xóa bầu trời (Skybox)').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_decals').setDescription('[28] Xóa decal hình ảnh mặt đất').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_terrain').setDescription('[29] Giảm chi tiết Địa hình (Terrain)').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_water').setDescription('[30] Làm phẳng / Ẩn hiệu ứng Nước').addStringOption(uOpt).addBooleanOption(bOpt),

    // --- NHÓM 3: Điều khiển & Chuyển động (31 - 45) ---
    new SlashCommandBuilder().setName('matrix_walk').setDescription('[31] Di chuyển đến tọa độ X,Y,Z').addStringOption(uOpt).addStringOption(strOpt('pos', 'Tọa độ X,Y,Z')),
    new SlashCommandBuilder().setName('matrix_jump').setDescription('[32] Nhảy lên 1 lần').addStringOption(uOpt),
    new SlashCommandBuilder().setName('matrix_reset').setDescription('[33] Reset nhân vật (Die)').addStringOption(uOpt),
    new SlashCommandBuilder().setName('matrix_freeze').setDescription('[34] Đóng băng vị trí').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_speed').setDescription('[35] Đặt tốc độ WalkSpeed').addStringOption(uOpt).addIntegerOption(numOpt('val', 'Giá trị tốc độ')),
    new SlashCommandBuilder().setName('matrix_jumppower').setDescription('[36] Đặt lực nhảy JumpPower').addStringOption(uOpt).addIntegerOption(numOpt('val', 'Lực nhảy')),
    new SlashCommandBuilder().setName('matrix_noclip').setDescription('[37] Bật/Tắt Đi xuyên tường').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_fly').setDescription('[38] Bật/Tắt Chế độ Bay').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_tp_player').setDescription('[39] Teleport tới vị trí Player khác').addStringOption(uOpt).addStringOption(strOpt('target', 'Tên người chơi')),
    new SlashCommandBuilder().setName('matrix_spin').setDescription('[40] Xoay nhân vật liên tục').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_sit').setDescription('[41] Cho nhân vật Ngồi xuống').addStringOption(uOpt),
    new SlashCommandBuilder().setName('matrix_invis').setDescription('[42] Bật tàng hình tạm thời').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_god').setDescription('[43] Bật Godmode (Nó tùy thuộc Game)').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_grav').setDescription('[44] Chỉnh Trọng lực Game (Gravity)').addStringOption(uOpt).addIntegerOption(numOpt('val', 'Giá trị Gravity')),
    new SlashCommandBuilder().setName('matrix_bring').setDescription('[45] Bring nhân vật khác tới gần').addStringOption(uOpt).addStringOption(strOpt('target', 'Tên mục tiêu')),

    // --- NHÓM 4: Tính năng Farm & Tự động hóa (46 - 65) ---
    new SlashCommandBuilder().setName('matrix_autofarm').setDescription('[46] Bật/Tắt Auto Farm tổng hợp').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_autoboss').setDescription('[47] Bật/Tắt Auto Boss').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_autoquest').setDescription('[48] Bật/Tắt Auto Nhận Nhiệm Vụ').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_autostat').setDescription('[49] Auto Tăng điểm Stat').addStringOption(uOpt).addStringOption(strOpt('stat', 'Chỉ số (Melee/Defense...)')),
    new SlashCommandBuilder().setName('matrix_autobuy').setDescription('[50] Auto Mua đồ trong shop').addStringOption(uOpt).addStringOption(strOpt('item', 'Tên món đồ')),
    new SlashCommandBuilder().setName('matrix_autostore').setDescription('[51] Auto cất Item vào Balo/Kho').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_autoroll').setDescription('[52] Auto Quay gacha / Roll Fruit').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_equip').setDescription('[53] Cầm trang bị/vũ khí').addStringOption(uOpt).addStringOption(strOpt('weapon', 'Tên vũ khí')),
    new SlashCommandBuilder().setName('matrix_useitem').setDescription('[54] Sử dụng vật phẩm').addStringOption(uOpt).addStringOption(strOpt('item', 'Tên item')),
    new SlashCommandBuilder().setName('matrix_autoattack').setDescription('[55] Bật/Tắt Tự động Đánh (Auto Click/Attack)').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_autoskill').setDescription('[56] Bật/Tắt Auto dùng chiêu Z,X,C,V').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_autocollect').setDescription('[57] Auto nhặt Rương / Item trên đất').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_autoraid').setDescription('[58] Bật/Tắt Auto đi Raid').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_autochest').setDescription('[59] Auto nhặt Chest').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_autocraft').setDescription('[60] Auto Chế tạo vật phẩm').addStringOption(uOpt).addStringOption(strOpt('recipe', 'Tên công thức')),
    new SlashCommandBuilder().setName('matrix_autoeat').setDescription('[61] Auto Ăn thức ăn hồi máu').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_autotrade').setDescription('[62] Auto Chấp nhận Giao dịch').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_autoddungeon').setDescription('[63] Auto Dungeon').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_autofish').setDescription('[64] Auto Câu cá').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_automine').setDescription('[65] Auto Khai thác').addStringOption(uOpt).addBooleanOption(bOpt),

    // --- NHÓM 5: Quản lý Server & Kết nối (66 - 80) ---
    new SlashCommandBuilder().setName('matrix_autohop').setDescription('[66] Tự động Hop khi Lag / Ping cao').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_hoplow').setDescription('[67] Hop sang Server ít người').addStringOption(uOpt),
    new SlashCommandBuilder().setName('matrix_hopplus').setDescription('[68] Hop sang Server Bạn bè').addStringOption(uOpt),
    new SlashCommandBuilder().setName('matrix_joinlink').setDescription('[69] Lấy Link tham gia server trực tiếp').addStringOption(strOpt('user', 'User ID/Username')),
    new SlashCommandBuilder().setName('matrix_serverinfo').setDescription('[70] Lấy thông tin danh sách Server').addStringOption(strOpt('user', 'User ID/Username')),
    new SlashCommandBuilder().setName('matrix_blockuser').setDescription('[71] Chặn người chơi chỉ định').addStringOption(uOpt).addStringOption(strOpt('target', 'Tên đối tượng')),
    new SlashCommandBuilder().setName('matrix_serverlock').setDescription('[72] Khóa server không cho Hop').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_antiadmin').setDescription('[73] Né Admin / Mod phát hiện').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_antiafk').setDescription('[74] Bật Chống Disconnect AFK').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_kick').setDescription('[75] Kick Acc thoát khỏi Roblox').addStringOption(uOpt),
    new SlashCommandBuilder().setName('matrix_hopserver_full').setDescription('[76] Hop Server đông người').addStringOption(uOpt),
    new SlashCommandBuilder().setName('matrix_reconnect').setDescription('[77] Thử kết nối lại Server').addStringOption(uOpt),
    new SlashCommandBuilder().setName('matrix_leaveonadmin').setDescription('[78] Thoát ngay khi gặp Admin').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_autoreset_time').setDescription('[79] Auto Reset sau X phút').addStringOption(uOpt).addIntegerOption(numOpt('minutes', 'Số phút')),
    new SlashCommandBuilder().setName('matrix_whitelist').setDescription('[80] Thêm người chơi vào Whitelist').addStringOption(uOpt).addStringOption(strOpt('target', 'Username')),

    // --- NHÓM 6: Tiện ích & Giám sát nâng cao (81 - 100) ---
    new SlashCommandBuilder().setName('matrix_backpack').setDescription('[81] Kiểm tra Balo của Account').addStringOption(strOpt('user', 'User ID/Username')),
    new SlashCommandBuilder().setName('matrix_level').setDescription('[82] Kiểm tra Level hiện tại').addStringOption(strOpt('user', 'User ID/Username')),
    new SlashCommandBuilder().setName('matrix_currency').setDescription('[83] Xem số tiền / Beli / Gem hiện có').addStringOption(strOpt('user', 'User ID/Username')),
    new SlashCommandBuilder().setName('matrix_dropitem').setDescription('[84] Thả vật phẩm đang cầm').addStringOption(uOpt),
    new SlashCommandBuilder().setName('matrix_trade_request').setDescription('[85] Gửi lời mời Trade').addStringOption(uOpt).addStringOption(strOpt('target', 'Username')),
    new SlashCommandBuilder().setName('matrix_click_button').setDescription('[86] Click Nút bấm GUI từ xa').addStringOption(uOpt).addStringOption(strOpt('button_name', 'Tên Button')),
    new SlashCommandBuilder().setName('matrix_tp_place').setDescription('[87] Dịch chuyển tới vị trí Spawn').addStringOption(uOpt),
    new SlashCommandBuilder().setName('matrix_set_team').setDescription('[88] Đổi phe / Đổi Team').addStringOption(uOpt).addStringOption(strOpt('team', 'Tên Team')),
    new SlashCommandBuilder().setName('matrix_redeem_code').setDescription('[89] Nhập Code nhận thưởng').addStringOption(uOpt).addStringOption(strOpt('code', 'Mã Giftcode')),
    new SlashCommandBuilder().setName('matrix_server_chat_log').setDescription('[90] Lấy Log Chat mới nhất từ Game').addStringOption(strOpt('user', 'User ID/Username')),
    new SlashCommandBuilder().setName('matrix_fps_unfocussed').setDescription('[91] Tự giảm FPS xuống 5 khi ẩn Game').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_virtual_input').setDescription('[92] Giả lập nhấn phím (E, Q, R...)').addStringOption(uOpt).addStringOption(strOpt('key', 'Tên phím')),
    new SlashCommandBuilder().setName('matrix_clip_map').setDescription('[93] Bật/tắt Clip xuyên vật thể').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_anti_mod_call').setDescription('[94] Cảnh báo nếu có Staff join').addStringOption(uOpt).addBooleanOption(bOpt),
    new SlashCommandBuilder().setName('matrix_look_at').setDescription('[95] Nhìn về phía tọa độ X,Y,Z').addStringOption(uOpt).addStringOption(strOpt('pos', 'Tọa độ X,Y,Z')),
    new SlashCommandBuilder().setName('matrix_equip_best').setDescription('[96] Trang bị vũ khí mạnh nhất').addStringOption(uOpt),
    new SlashCommandBuilder().setName('matrix_buy_gamepass').setDescription('[97] Mua Gamepass chỉ định').addStringOption(uOpt).addIntegerOption(numOpt('id', 'Gamepass ID')),
    new SlashCommandBuilder().setName('matrix_fps_boost').setDescription('[98] Bật toàn bộ chế độ siêu tối ưu FPS').addStringOption(uOpt),
    new SlashCommandBuilder().setName('matrix_destroy_gui').setDescription('[99] Xóa toàn bộ GUI tùy chỉnh').addStringOption(uOpt),
    new SlashCommandBuilder().setName('matrix_panic').setDescription('[100] DỪNG KHẨN CẤP TOÀN BỘ TÁC VỤ FARM').addStringOption(uOpt)
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
    try {
        console.log('🔄 Đang đăng ký TRỌN BỘ 100+ SLASH COMMANDS MATRIX...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandsList });
        console.log('✅ ĐÃ ĐĂNG KÝ THÀNH CÔNG FULL 100+ LỆNH HỆ THỐNG MATRIX!');
    } catch (error) {
        console.error('❌ Lỗi đăng ký lệnh:', error);
    }
})();

client.once('ready', () => {
    console.log(`🤖 Bot Discord Matrix Online: ${client.user.tag}`);
});

// =========================================================
// 4. XỬ LÝ LỆNH INTERACTION TỪ DISCORD
// =========================================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    if (interaction.isChatInputCommand()) {
        await interaction.deferReply();

        const now = Date.now();
        for (let [id, clientInfo] of activeClients.entries()) {
            if (now - clientInfo.lastSeen > 30000) activeClients.delete(id);
        }

        const cmd = interaction.commandName;

        const findClients = (input) => {
            if (!input) return [];
            const query = input.toLowerCase();
            if (query === 'all') return [...activeClients.values()];
            return [...activeClients.values()].filter(c => 
                c.userId.toString() === query || 
                c.username.toLowerCase() === query || 
                (c.alias && c.alias.toLowerCase() === query)
            );
        };

        if (cmd === 'matrix_all') {
            if (activeClients.size === 0) return interaction.editReply('❌ Không có account nào online!');
            let text = "🚨 **DANH SÁCH MATRIX CONTROL SYSTEM (100+ COMMANDS)** 🚨\n\n";
            for (let [id, c] of activeClients.entries()) {
                const nameDisplay = c.alias ? `**${c.alias}** (${c.displayName})` : `**${c.displayName}**`;
                text += `👤 ${nameDisplay} (@${c.username}) | ID: \`${id}\`\n`;
                text += `📊 FPS: \`${c.fps}\` | Ping: \`${c.ping}ms\` | RAM: \`${c.ram}MB\`\n-----------------------------------\n`;
            }
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cmd_hop_all').setLabel('🔄 Hop All').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('cmd_fps_boost_all').setLabel('⚡ Boost FPS All').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('cmd_kill_all').setLabel('⛔ Kill All').setStyle(ButtonStyle.Danger)
            );
            return interaction.editReply({ content: text, components: [row] });
        }

        if (cmd === 'matrix_stats') {
            if (activeClients.size === 0) return interaction.editReply('❌ Không có account online!');
            let totalRam = 0, totalFps = 0, totalPing = 0, count = activeClients.size;
            for (let c of activeClients.values()) {
                totalRam += Number(c.ram) || 0; totalFps += Number(c.fps) || 0; totalPing += Number(c.ping) || 0;
            }
            const embed = new EmbedBuilder()
                .setTitle('📊 BẢNG TỔNG QUAN HỆ THỐNG MATRIX (100+ COMMANDS)')
                .setColor('#00ffcc')
                .addFields(
                    { name: '🤖 Account Online', value: `\`${count}\``, inline: true },
                    { name: '💾 Tổng RAM', value: `\`${totalRam} MB\``, inline: true },
                    { name: '⚡ FPS Trung Bình', value: `\`${(totalFps / count).toFixed(1)}\``, inline: true },
                    { name: '📶 Ping Trung Bình', value: `\`${(totalPing / count).toFixed(1)} ms\``, inline: true }
                ).setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        if (cmd === 'matrix_ping') {
            return interaction.editReply(`🏓 **Pong!** Độ trễ của Bot: \`${Date.now() - interaction.createdTimestamp}ms\``);
        }

        // Bảng Map Xử Lý Lệnh Tự Động Cho 100+ Commands
        const cmdMap = {
            'matrix_cmd': (opt) => ({ type: opt.getString('command') }),
            'matrix_say': (opt) => ({ type: 'CHAT_MESSAGE', message: opt.getString('message') }),
            'matrix_rejoin': () => ({ type: 'REJOIN_SERVER' }),
            'matrix_job': (opt) => ({ type: 'TELEPORT_JOB', jobId: opt.getString('job_id') }),
            'matrix_place': (opt) => ({ type: 'TELEPORT_PLACE', placeId: opt.getString('place_id') }),
            'matrix_exec': (opt) => ({ type: 'EXECUTE_LUA', code: opt.getString('script') }),
            'matrix_fps': (opt) => ({ type: 'SET_FPS', cap: opt.getInteger('cap') }),
            'matrix_blackout': (opt) => ({ type: 'BLACKSCREEN', enable: opt.getBoolean('enable') }),
            'matrix_lowgfx': (opt) => ({ type: 'LOW_GFX', enable: opt.getBoolean('enable') }),
            'matrix_rendering': (opt) => ({ type: 'SET_RENDERING', enable: opt.getBoolean('enable') }),
            'matrix_audio': (opt) => ({ type: 'SET_AUDIO', enable: opt.getBoolean('enable') }),
            'matrix_gui': (opt) => ({ type: 'TOGGLE_GUI', enable: opt.getBoolean('enable') }),
            'matrix_textures': (opt) => ({ type: 'REMOVE_TEXTURES', enable: opt.getBoolean('enable') }),
            'matrix_shadows': (opt) => ({ type: 'TOGGLE_SHADOWS', enable: opt.getBoolean('enable') }),
            'matrix_particles': (opt) => ({ type: 'TOGGLE_PARTICLES', enable: opt.getBoolean('enable') }),
            'matrix_fog': (opt) => ({ type: 'TOGGLE_FOG', enable: opt.getBoolean('enable') }),
            'matrix_blur': (opt) => ({ type: 'TOGGLE_BLUR', enable: opt.getBoolean('enable') }),
            'matrix_skybox': (opt) => ({ type: 'REMOVE_SKYBOX', enable: opt.getBoolean('enable') }),
            'matrix_decals': (opt) => ({ type: 'REMOVE_DECALS', enable: opt.getBoolean('enable') }),
            'matrix_terrain': (opt) => ({ type: 'LOW_TERRAIN', enable: opt.getBoolean('enable') }),
            'matrix_water': (opt) => ({ type: 'LOW_WATER', enable: opt.getBoolean('enable') }),
            'matrix_walk': (opt) => ({ type: 'WALK_TO', pos: opt.getString('pos') }),
            'matrix_jump': () => ({ type: 'JUMP' }),
            'matrix_reset': () => ({ type: 'RESET_CHARACTER' }),
            'matrix_freeze': (opt) => ({ type: 'FREEZE_CHAR', enable: opt.getBoolean('enable') }),
            'matrix_speed': (opt) => ({ type: 'SET_SPEED', val: opt.getInteger('val') }),
            'matrix_jumppower': (opt) => ({ type: 'SET_JUMP_POWER', val: opt.getInteger('val') }),
            'matrix_noclip': (opt) => ({ type: 'NOCLIP', enable: opt.getBoolean('enable') }),
            'matrix_fly': (opt) => ({ type: 'FLY', enable: opt.getBoolean('enable') }),
            'matrix_tp_player': (opt) => ({ type: 'TP_PLAYER', target: opt.getString('target') }),
            'matrix_spin': (opt) => ({ type: 'SPIN_CHAR', enable: opt.getBoolean('enable') }),
            'matrix_sit': () => ({ type: 'SIT' }),
            'matrix_invis': (opt) => ({ type: 'INVISIBILITY', enable: opt.getBoolean('enable') }),
            'matrix_god': (opt) => ({ type: 'GODMODE', enable: opt.getBoolean('enable') }),
            'matrix_grav': (opt) => ({ type: 'SET_GRAVITY', val: opt.getInteger('val') }),
            'matrix_bring': (opt) => ({ type: 'BRING_PLAYER', target: opt.getString('target') }),
            'matrix_autofarm': (opt) => ({ type: 'AUTO_FARM', enable: opt.getBoolean('enable') }),
            'matrix_autoboss': (opt) => ({ type: 'AUTO_BOSS', enable: opt.getBoolean('enable') }),
            'matrix_autoquest': (opt) => ({ type: 'AUTO_QUEST', enable: opt.getBoolean('enable') }),
            'matrix_autostat': (opt) => ({ type: 'AUTO_STAT', stat: opt.getString('stat') }),
            'matrix_autobuy': (opt) => ({ type: 'AUTO_BUY', item: opt.getString('item') }),
            'matrix_autostore': (opt) => ({ type: 'AUTO_STORE', enable: opt.getBoolean('enable') }),
            'matrix_autoroll': (opt) => ({ type: 'AUTO_ROLL', enable: opt.getBoolean('enable') }),
            'matrix_equip': (opt) => ({ type: 'EQUIP_WEAPON', weapon: opt.getString('weapon') }),
            'matrix_useitem': (opt) => ({ type: 'USE_ITEM', item: opt.getString('item') }),
            'matrix_autoattack': (opt) => ({ type: 'AUTO_ATTACK', enable: opt.getBoolean('enable') }),
            'matrix_autoskill': (opt) => ({ type: 'AUTO_SKILL', enable: opt.getBoolean('enable') }),
            'matrix_autocollect': (opt) => ({ type: 'AUTO_COLLECT', enable: opt.getBoolean('enable') }),
            'matrix_autoraid': (opt) => ({ type: 'AUTO_RAID', enable: opt.getBoolean('enable') }),
            'matrix_autochest': (opt) => ({ type: 'AUTO_CHEST', enable: opt.getBoolean('enable') }),
            'matrix_autocraft': (opt) => ({ type: 'AUTO_CRAFT', recipe: opt.getString('recipe') }),
            'matrix_autoeat': (opt) => ({ type: 'AUTO_EAT', enable: opt.getBoolean('enable') }),
            'matrix_autotrade': (opt) => ({ type: 'AUTO_TRADE', enable: opt.getBoolean('enable') }),
            'matrix_autoddungeon': (opt) => ({ type: 'AUTO_DUNGEON', enable: opt.getBoolean('enable') }),
            'matrix_autofish': (opt) => ({ type: 'AUTO_FISH', enable: opt.getBoolean('enable') }),
            'matrix_automine': (opt) => ({ type: 'AUTO_MINE', enable: opt.getBoolean('enable') }),
            'matrix_autohop': (opt) => ({ type: 'AUTO_HOP', enable: opt.getBoolean('enable') }),
            'matrix_hoplow': () => ({ type: 'HOP_LOW_SERVER' }),
            'matrix_hopplus': () => ({ type: 'HOP_FRIENDS' }),
            'matrix_blockuser': (opt) => ({ type: 'BLOCK_USER', target: opt.getString('target') }),
            'matrix_serverlock': (opt) => ({ type: 'LOCK_SERVER', enable: opt.getBoolean('enable') }),
            'matrix_antiadmin': (opt) => ({ type: 'ANTI_ADMIN', enable: opt.getBoolean('enable') }),
            'matrix_antiafk': (opt) => ({ type: 'ANTI_AFK', enable: opt.getBoolean('enable') }),
            'matrix_kick': () => ({ type: 'KICK_PLAYER' }),
            'matrix_hopserver_full': () => ({ type: 'HOP_FULL_SERVER' }),
            'matrix_reconnect': () => ({ type: 'RECONNECT' }),
            'matrix_leaveonadmin': (opt) => ({ type: 'LEAVE_ON_ADMIN', enable: opt.getBoolean('enable') }),
            'matrix_autoreset_time': (opt) => ({ type: 'AUTO_RESET_TIME', minutes: opt.getInteger('minutes') }),
            'matrix_whitelist': (opt) => ({ type: 'ADD_WHITELIST', target: opt.getString('target') }),
            'matrix_dropitem': () => ({ type: 'DROP_ITEM' }),
            'matrix_trade_request': (opt) => ({ type: 'REQUEST_TRADE', target: opt.getString('target') }),
            'matrix_click_button': (opt) => ({ type: 'CLICK_BUTTON', button: opt.getString('button_name') }),
            'matrix_tp_place': () => ({ type: 'TP_SPAWN' }),
            'matrix_set_team': (opt) => ({ type: 'SET_TEAM', team: opt.getString('team') }),
            'matrix_redeem_code': (opt) => ({ type: 'REDEEM_CODE', code: opt.getString('code') }),
            'matrix_virtual_input': (opt) => ({ type: 'VIRTUAL_KEY', key: opt.getString('key') }),
            'matrix_clip_map': (opt) => ({ type: 'CLIP_MAP', enable: opt.getBoolean('enable') }),
            'matrix_look_at': (opt) => ({ type: 'LOOK_AT', pos: opt.getString('pos') }),
            'matrix_equip_best': () => ({ type: 'EQUIP_BEST' }),
            'matrix_buy_gamepass': (opt) => ({ type: 'BUY_GAMEPASS', id: opt.getInteger('id') }),
            'matrix_fps_boost': () => ({ type: 'FPS_BOOST_FULL' }),
            'matrix_destroy_gui': () => ({ type: 'DESTROY_GUI' }),
            'matrix_panic': () => ({ type: 'PANIC_STOP' })
        };

        if (cmdMap[cmd]) {
            const targets = findClients(interaction.options.getString('user'));
            if (targets.length === 0) return interaction.editReply('❌ Không tìm thấy account!');
            const payload = cmdMap[cmd](interaction.options);
            targets.forEach(c => c.pendingCmd = payload);
            return interaction.editReply(`✅ Đã gửi lệnh **${cmd}** tới \`${targets.length}\` account!`);
        }

        if (cmd === 'matrix_alias') {
            const userInput = interaction.options.getString('user').toLowerCase();
            const aliasName = interaction.options.getString('alias');
            const target = [...activeClients.values()].find(c => c.userId.toString() === userInput || c.username.toLowerCase() === userInput);
            if (!target) return interaction.editReply(`❌ Không tìm thấy account: \`${userInput}\``);
            target.alias = aliasName;
            return interaction.editReply(`✅ Đã đặt biệt danh cho **${target.username}** là: **${aliasName}**!`);
        }

        if (cmd === 'matrix_webhook') {
            return interaction.editReply(`✅ Cập nhật Webhook thành công: \`${interaction.options.getString('url')}\``);
        }

        if (cmd === 'matrix_clear') {
            activeClients.clear();
            return interaction.editReply('🧹 Đã xóa toàn bộ bộ nhớ tạm!');
        }

        if (cmd === 'matrix_restart') {
            interaction.editReply('🔄 Đang khởi động lại hệ thống...');
            process.exit(0);
        }
    }

    if (interaction.isButton()) {
        await interaction.deferReply({ ephemeral: true });
        if (activeClients.size === 0) return interaction.editReply('❌ Không có client Roblox nào online!');

        const customId = interaction.customId;
        if (customId === 'cmd_hop_all') for (let c of activeClients.values()) c.pendingCmd = { type: 'HOP_LOW_SERVER' };
        else if (customId === 'cmd_fps_boost_all') for (let c of activeClients.values()) c.pendingCmd = { type: 'FPS_BOOST_FULL' };
        else if (customId === 'cmd_kill_all') for (let c of activeClients.values()) c.pendingCmd = { type: 'KILL_GAME' };
        
        await interaction.editReply('✅ Đã thực thi lệnh siêu tốc!');
    }
});

client.login(BOT_TOKEN);
 
