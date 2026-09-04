const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const lastRequestTime = {};
const gameCache = {};

// Link Discord Webhook mặc định
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "https://discord.com/api/webhooks/1545447944009023650/L8Ihhw3Nyfh7c51Pg3Oiw7cH_GyoEL2FwM61mJSNjcbITPUxSZTHY1xJ0mBjkKqo5za7";

// Bộ từ khóa tự động nhận biết Đồ Xịn / Sự Cố Khẩn
const VALUABLE_KEYWORDS = [
    "fist of darkness", "chén thánh", "god's chalice", "sweet chalice", "kẹo râu đen",
    "mirage island", "đảo bí ẩn", "kitsune island", "đảo kitsune", "leviathan",
    "fist of cold", "haki rainbow", "haki 7 màu", "haki tuyết", "dough king",
    "rip indra", "tyrant fruit", "fruit spawned", "trái ác quỷ xuất hiện"
];

// Hàm ẩn tên tài khoản (VD: mrghost -> mr*****)
function maskUsername(username, shouldHide = false) {
    if (!username) return "N/A";
    if (!shouldHide) return username;
    if (username.length <= 2) return username[0] + "*";
    return username.substring(0, 2) + "*".repeat(username.length - 2);
}

// Hàm kiểm tra đồ xịn hoặc sự cố khẩn
function checkValuable(data) {
    if (data.isValuable || data.isCritical || data.pingAlert) return true;
    const contentString = JSON.stringify(data).toLowerCase();
    return VALUABLE_KEYWORDS.some(keyword => contentString.includes(keyword));
}

// Hàm lấy tên Game và Logo tự động từ Roblox PlaceId
async function getGameInfo(placeId) {
    if (!placeId) return { name: "Roblox Game", icon: null };
    if (gameCache[placeId]) return gameCache[placeId];

    try {
        const universeRes = await axios.get(`https://apis.roblox.com/universes/v1/places/${placeId}/universe-id`);
        const universeId = universeRes.data.universeId;

        const gameRes = await axios.get(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        const gameName = gameRes.data.data[0].name;

        const thumbRes = await axios.get(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`);
        const gameIcon = thumbRes.data.data[0].imageUrl;

        const result = { name: gameName, icon: gameIcon };
        gameCache[placeId] = result;
        return result;
    } catch (e) {
        return { name: `Place ID: ${placeId}`, icon: null };
    }
}

// Tự động chuyển key sang Tiếng Việt + Emoji
function formatKey(key) {
    const customNames = {
        username: "👤 Tài Khoản",
        displayName: "📛 Biệt Danh",
        jobId: "🌐 JobID Server",
        ping: "📊 Ping",
        ram: "💾 RAM",
        status: "📌 Trạng Thái",
        uptime: "⏱️ TG Hoạt Động",
        sea: "🗺️ Map / Sea",
        level: "⭐ Level",
        currentBeli: "💵 Beli",
        chestsCollected: "📦 Số Rương",
        itemFound: "🔥 Đồ Xịn Lụm Được"
    };
    return customNames[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

app.post('/api/report', async (req, res) => {
    const data = req.body;

    // Chống Spam 3s
    const userId = data.userId || data.username || "default";
    const now = Date.now();
    if (lastRequestTime[userId] && (now - lastRequestTime[userId]) < 3000) {
        return res.status(429).json({ message: "Request quá nhanh!" });
    }
    lastRequestTime[userId] = now;

    const isValuable = checkValuable(data);
    const isHideName = data.hideName || data.hideUsername || false;
    const displayUsername = maskUsername(data.username, isHideName);

    const avatarUrl = (data.userId && !isHideName)
        ? `https://www.roblox.com/headshot-thumbnail/image?userId=${data.userId}&width=420&height=420&format=png`
        : "https://i.imgur.com/rN9kQoY.png";

    const gameInfo = await getGameInfo(data.placeId);

    const fields = [];
    for (const [key, value] of Object.entries(data)) {
        if (
            ['scriptType', 'eventTitle', 'description', 'customDescription', 'pingAlert', 'isCritical', 'isValuable', 'userId', 'placeId', 'hideName', 'hideUsername'].includes(key) ||
            value === null || value === undefined || value === ""
        ) continue;

        let formattedValue = value;
        if (key === 'username') {
            formattedValue = `\`${displayUsername}\``;
        } else if (typeof value === 'number') {
            formattedValue = `\`${value.toLocaleString()}\``;
        } else if (key === 'jobId') {
            formattedValue = `\`\`\`${value}\`\`\``;
        } else {
            formattedValue = `\`${value}\``;
        }

        fields.push({ name: formatKey(key), value: String(formattedValue), inline: key !== 'jobId' });
    }

    const embed = {
        author: {
            name: gameInfo.name,
            icon_url: gameInfo.icon || "https://i.imgur.com/rN9kQoY.png"
        },
        title: isValuable 
            ? `🚨 [ĐỒ XỊN KHẨN CẤP] ${data.eventTitle || "PHÁT HIỆN MỤC TIÊU GIÁ TRỊ"}` 
            : `🌐 ${data.eventTitle || "MrGhost System • BÁO CÁO TRẠNG THÁI"}`,
        description: data.customDescription || data.description || (isValuable 
            ? "🎉 **ĐÃ PHÁT HIỆN / LỤM ĐƯỢC ĐỒ XỊN!**" 
            : `Tài khoản **${displayUsername}** vừa gửi báo cáo hệ thống. Bấm các nút bên dưới để lấy dữ liệu.`),
        color: isValuable ? 0xFF0055 : 0x2B2D31,
        thumbnail: { url: avatarUrl },
        fields: fields,
        footer: { 
            text: "MrGhost Control System",
            icon_url: "https://i.imgur.com/rN9kQoY.png"
        },
        timestamp: new Date().toISOString()
    };

    // Dàn Nút Bấm Tương Tác
    const payload = {
        username: isValuable ? "🚨 MrGhost Alert Bot" : "MrGhost System Notifier",
        avatar_url: "https://i.imgur.com/rN9kQoY.png",
        embeds: [embed],
        components: [
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        label: "🔑 Copy Job ID",
                        style: 5,
                        url: data.jobId ? `https://www.roblox.com/games/${data.placeId || 2753915549}?jobId=${data.jobId}` : "https://www.roblox.com"
                    },
                    {
                        type: 2,
                        label: "👤 Copy Username",
                        style: 5,
                        url: data.userId ? `https://www.roblox.com/users/${data.userId}/profile` : "https://www.roblox.com"
                    }
                ]
            },
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        label: "📊 Xem Stats",
                        style: 5,
                        url: data.userId ? `https://www.roblox.com/users/${data.userId}/profile` : "https://www.roblox.com"
                    }
                ]
            }
        ]
    };

    if (isValuable) {
        payload.content = "@everyone 🚨 **ĐÃ PHÁT HIỆN / LỤM ĐƯỢC ĐỒ XỊN!**";
    }

    try {
        await axios.post(DISCORD_WEBHOOK_URL, payload);
        res.status(200).json({ success: true, message: "Report Sent Successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server online on port ${PORT}`));
 
