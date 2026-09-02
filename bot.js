const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const express = require('express');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const app = express();
app.use(express.json());

// ⚙️ CẤU HÌNH ĐÃ ĐƯỢC TỰ ĐỘNG ĐIỀN
const BOT_TOKEN = process.env.BOT_TOKEN;
const VIP_CHANNEL_ID = "1544750425880924160"; 
const PUBLIC_CHANNEL_ID = "1542997364875468870";

const cacheData = {};

app.post('/api/report', (req, res) => {
    const { userId, username, displayName, jobId, placeId, ping, ram, afkTime, isCritical, eventTitle } = req.body;
    cacheData[userId] = { username, displayName, jobId, placeId, ping, ram, afkTime };

    // 1️⃣ GỬI KÊNH VIP CÓ NÚT BẤM
    const vipChannel = client.channels.cache.get(VIP_CHANNEL_ID);
    if (vipChannel) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`job_${userId}`).setLabel('🔑 Copy Job ID').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`user_${userId}`).setLabel('👤 Copy Username').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`stats_${userId}`).setLabel('📊 Xem Stats').setStyle(ButtonStyle.Secondary)
        );

        const vipEmbed = new EmbedBuilder()
            .setTitle(`👑 MrGhost VIP • ${eventTitle || "Báo Cáo"}`)
            .setDescription(`Tài khoản **${displayName}** vừa gửi báo cáo hệ thống. Bấm các nút bên dưới để lấy dữ liệu.`)
            .setColor(isCritical ? 0xff0000 : 0x9b59b6)
            .setTimestamp();

        vipChannel.send({ content: isCritical ? "🚨 @everyone **CẢNH BÁO KHẨN CẤP!**" : null, embeds: [vipEmbed], components: [row] });
    }

    // 2️⃣ GỬI KÊNH PUBLIC (CHỈ HIỆN THÔNG TIN CHUNG)
    const publicChannel = client.channels.cache.get(PUBLIC_CHANNEL_ID);
    if (publicChannel) {
        const maskedUser = username.substring(0, 2) + "*****" + username.slice(-1);
        const publicEmbed = new EmbedBuilder()
            .setTitle(`🌐 MrGhost System • ${eventTitle || "Báo Cáo"}`)
            .addFields(
                { name: '👤 Tài Khoản', value: `\`${maskedUser}\``, inline: true },
                { name: '📶 Ping', value: `\`${ping} ms\``, inline: true },
                { name: '💾 RAM', value: `\`${ram} MB\``, inline: true }
            )
            .setColor(0x3498db)
            .setTimestamp();

        publicChannel.send({ embeds: [publicEmbed] });
    }

    res.json({ status: 'ok' });
});

// XỬ LÝ SỰ KIỆN KHI BẤM NÚT TRÊN DISCORD
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const [type, userId] = interaction.customId.split('_');
    const data = cacheData[userId];

    if (!data) return interaction.reply({ content: '❌ Dữ liệu hết hạn!', ephemeral: true });

    if (type === 'job') {
        await interaction.reply({ content: `🔑 **Job ID (Bấm giữ/Chạm để copy):**\n\`\`\`\n${data.jobId}\n\`\`\``, ephemeral: true });
    } else if (type === 'user') {
        await interaction.reply({ content: `👤 **Username (Bấm giữ/Chạm để copy):**\n\`\`\`\n${data.username}\n\`\`\``, ephemeral: true });
    } else if (type === 'stats') {
        await interaction.reply({ content: `📊 **Thông Số Chi Tiết:**\n• **Display Name:** \`${data.displayName}\`\n• **Place ID:** \`${data.placeId}\`\n• **Ping:** \`${data.ping} ms\`\n• **RAM:** \`${data.ram} MB\`\n• **Thời gian treo:** \`${data.afkTime} phút\``, ephemeral: true });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API Server đang chạy ở Port ${PORT}`));
client.login(BOT_TOKEN);
 
