const express = require("express");
const axios = require("axios"); 
require('dotenv').config();

const { Bot, InlineKeyboard } = require("grammy");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

let screaming = false;

if (!process.env.TELEGRAM_TOKEN) {
    console.error("❌ TELEGRAM_TOKEN is required!");
    process.exit(1);
}

const bot = new Bot(process.env.TELEGRAM_TOKEN);

const urlRegex = /(https?:\/\/[^\s]+)/g;

function extractUrls(text) {
    return text.match(urlRegex) || [];
}

async function checkUrlSafety(url) {
    try {
        if (!process.env.EXTERNAL_API_URL || !process.env.API_KEY) {
            console.warn("⚠️ External API not configured, returning mock response");
            return {
                success: true,
                data: {
                    is_safe: true,
                    threat_level: 'low',
                    categories: ['unknown'],
                    reason: 'API not configured - mock response'
                }
            };
        }

        const response = await axios.post(process.env.EXTERNAL_API_URL, {
            url: url,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.API_KEY}`,
            },
            timeout: 10000 
        });

        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('API Error:', error.message);
        return {
            success: false,
            error: error.message,
            status: error.response?.status || 'Unknown'
        };
    }
}

function formatSafetyReport(url, result) {
    if (!result.success) {
        return `❌ <b>Error checking URL:</b> ${url}\n\n🔍 <b>Error:</b> ${result.error}`;
    }

    const data = result.data;
    
    let report = `🔍 <b>URL Safety Report</b>\n\n`;
    report += `🌐 <b>URL:</b> ${url}\n\n`;
    
    if (data.is_safe === false || data.threat_level === 'high') {
        report += `🚨 <b>Status:</b> SUSPICIOUS/DANGEROUS\n`;
        report += `⚠️ <b>Risk Level:</b> ${data.threat_level || 'Unknown'}\n`;
        report += `🏷️ <b>Categories:</b> ${data.categories?.join(', ') || 'Unknown'}\n`;
        if (data.reason) report += `📝 <b>Reason:</b> ${data.reason}\n`;
    } else if (data.is_safe === true) {
        report += `✅ <b>Status:</b> SAFE\n`;
        report += `🛡️ <b>Risk Level:</b> ${data.threat_level || 'Low'}\n`;
    } else {
        report += `❓ <b>Status:</b> UNKNOWN\n`;
        report += `📊 <b>Confidence:</b> ${data.confidence || 'N/A'}\n`;
    }
    
    if (data.domain_info) {
        report += `\n🌍 <b>Domain Info:</b>\n`;
        report += `📅 Created: ${data.domain_info.created || 'Unknown'}\n`;
        report += `🏢 Registrar: ${data.domain_info.registrar || 'Unknown'}\n`;
    }
    
    if (data.additional_info) {
        report += `\n📋 <b>Additional Info:</b> ${data.additional_info}\n`;
    }
    
    return report;
}

// Commands
bot.command("scream", async (ctx) => {
    screaming = true;
    await ctx.reply("🔊 SCREAMING MODE ACTIVATED! I'LL SHOUT EVERYTHING NOW!");
});

bot.command("whisper", async (ctx) => {
    screaming = false;
    await ctx.reply("🤫 Whisper mode activated. Speaking normally now.");
});

bot.command("start", async (ctx) => {
    console.log(`📱 User ${ctx.from.first_name} (${ctx.from.id}) started the bot`);
    
    const welcomeMsg = `🛡️ <b>Welcome to URL Scanner Bot!</b>

Hi ${ctx.from.first_name}! 👋

I help you check if URLs are safe or potentially dangerous/scam links.

<b>How to use:</b>
• Just send me any message with URLs and I'll scan them automatically
• Use /check [url] for manual checking  
• Use /help for more information
• Use /menu to see navigation options

Stay safe online! 🔒`;
    
    try {
        await ctx.reply(welcomeMsg, { parse_mode: "HTML" });
        console.log(`✅ Welcome message sent to ${ctx.from.first_name}`);
    } catch (error) {
        console.error("❌ Error sending welcome message:", error);
        await ctx.reply("🛡️ Welcome to URL Scanner Bot! Use /help for more information.");
    }
});

bot.command("help", async (ctx) => {
    console.log(`📚 User ${ctx.from.first_name} requested help`);
    
    const helpText = `🤖 <b>URL Scanner Bot Help</b>

<b>Available Commands:</b>
/start - Start the bot and see welcome message
/help - Show this help message  
/check [url] - Check a specific URL for safety
/menu - Show interactive navigation menu
/scream - Enable SCREAMING MODE
/whisper - Return to normal mode

<b>Auto-checking:</b>
Just send me any message containing URLs and I'll automatically scan them for you!

<b>Features:</b>
🔍 Automatic URL detection
🛡️ Scam/phishing detection  
⚡ Real-time scanning
📊 Detailed safety reports

<b>Examples:</b>
• Send: "Check this link: https://example.com"
• Or use: /check https://example.com
• Multiple URLs in one message are supported!

Need help? Just ask! 💬`;
    
    try {
        await ctx.reply(helpText, { parse_mode: "HTML" });
        console.log(`✅ Help message sent to ${ctx.from.first_name}`);
    } catch (error) {
        console.error("❌ Error sending help message:", error);
        await ctx.reply("🤖 URL Scanner Bot - Use /check [url] to scan URLs for safety!");
    }
});

bot.command("check", async (ctx) => {
    console.log(`🔍 User ${ctx.from.first_name} used check command`);
    
    const text = ctx.message.text;
    const urls = extractUrls(text.replace("/check", "").trim());
    
    if (urls.length === 0) {
        await ctx.reply("❌ Please provide a valid URL to check.\n\nExample: /check https://example.com");
        return;
    }
    
    const processingMsg = await ctx.reply("🔄 Scanning URL(s) for threats...");
    
    for (const url of urls) {
        try {
            console.log(`🌐 Checking URL: ${url}`);
            const result = await checkUrlSafety(url);
            const report = formatSafetyReport(url, result);
            
            await ctx.reply(report, { parse_mode: "HTML" });
            console.log(`✅ Report sent for: ${url}`);
        } catch (error) {
            console.error(`❌ Error checking URL ${url}:`, error);
            await ctx.reply(`❌ Failed to check ${url}: ${error.message}`);
        }
    }
    
    try {
        await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id);
    } catch (error) {
        console.log("ℹ️ Could not delete processing message (might be too old)");
    }
});

// Menu system
const firstMenu = "<b>📋 Main Menu</b>\n\nChoose an option below:";
const secondMenu = "<b>📖 Information Menu</b>\n\nLearn more about the bot:";

const nextButton = "Next ▶️";
const backButton = "◀️ Back";
const tutorialButton = "📚 Tutorial";
const aboutButton = "ℹ️ About";

const firstMenuMarkup = new InlineKeyboard()
    .text(nextButton, "next")
    .row()
    .text(aboutButton, "about");

const secondMenuMarkup = new InlineKeyboard()
    .text(backButton, "back")
    .text(tutorialButton, "https://core.telegram.org/bots/tutorial");

bot.command("menu", async (ctx) => {
    console.log(`📋 User ${ctx.from.first_name} opened menu`);
    
    try {
        await ctx.reply(firstMenu, {
            parse_mode: "HTML",
            reply_markup: firstMenuMarkup,
        });
    } catch (error) {
        console.error("❌ Error sending menu:", error);
        await ctx.reply("📋 Menu system temporarily unavailable. Use /help for commands.");
    }
});

bot.callbackQuery("back", async (ctx) => {
    await ctx.editMessageText(firstMenu, {
        reply_markup: firstMenuMarkup,
        parse_mode: "HTML",
    });
    await ctx.answerCallbackQuery("◀️ Back to main menu");
});

bot.callbackQuery("next", async (ctx) => {
    await ctx.editMessageText(secondMenu, {
        reply_markup: secondMenuMarkup,
        parse_mode: "HTML",
    });
    await ctx.answerCallbackQuery("▶️ Information menu");
});

bot.callbackQuery("about", async (ctx) => {
    const aboutText = `ℹ️ <b>About URL Scanner Bot</b>

🤖 <b>Version:</b> 1.0.0
🛡️ <b>Purpose:</b> Protect users from malicious URLs
⚡ <b>Features:</b> Real-time scanning, threat detection
👨‍💻 <b>Developer:</b> Security Team

This bot helps keep you safe online by scanning URLs for potential threats, scams, and phishing attempts.

Stay secure! 🔒`;

    await ctx.editMessageText(aboutText, {
        reply_markup: new InlineKeyboard().text("◀️ Back to Menu", "back"),
        parse_mode: "HTML",
    });
    await ctx.answerCallbackQuery("ℹ️ About information");
});

bot.on("message", async (ctx) => {
    const userName = ctx.from.first_name || "User";
    const messageText = "text" in ctx.message ? ctx.message.text : "";
    
    console.log(`💬 ${userName} (${ctx.from.id}) wrote: ${messageText}`);

    if (messageText && messageText.startsWith('/')) {
        return;
    }

    if (messageText) {
        const urls = extractUrls(messageText);
        
        if (urls.length > 0) {
            console.log(`🔗 Found ${urls.length} URL(s) to scan`);
            
            const scanningMsg = await ctx.reply(
                `🔍 Found ${urls.length} URL${urls.length > 1 ? 's' : ''} to scan. Checking for threats...`
            );
            
            for (const url of urls) {
                try {
                    console.log(`🌐 Scanning: ${url}`);
                    const result = await checkUrlSafety(url);
                    const report = formatSafetyReport(url, result);
                    
                    await ctx.reply(report, { parse_mode: "HTML" });
                    console.log(`✅ Safety report sent for: ${url}`);
                } catch (error) {
                    console.error(`❌ Failed to check ${url}:`, error);
                    await ctx.reply(`❌ Failed to check ${url}: ${error.message}`);
                }
            }
            
            try {
                await ctx.api.deleteMessage(ctx.chat.id, scanningMsg.message_id);
            } catch (error) {
                console.log("ℹ️ Could not delete scanning message");
            }
            
            return;
        }
    }

    if (screaming && messageText) {
        await ctx.reply(messageText.toUpperCase(), {
            entities: ctx.message.entities,
        });
    } else {
        try {
            await ctx.copyMessage(ctx.chat.id);
        } catch (error) {
            console.error("❌ Error copying message:", error);
            if (messageText) {
                await ctx.reply(`Echo: ${messageText}`);
            } else {
                await ctx.reply("👍 Message received!");
            }
        }
    }
});

bot.catch((err) => {
    const ctx = err.ctx;
    const error = err.error;
    
    console.error(`❌ Bot error for ${ctx.from?.first_name || 'unknown user'}:`, error);
    
    if (ctx && ctx.reply) {
        ctx.reply("⚠️ Something went wrong. Please try again or use /help for assistance.")
            .catch(console.error);
    }
});


bot.start().then(() => {
   
}).catch((error) => {
    console.error("❌ Failed to start bot:", error);
    process.exit(1);
});


app.get("/", (req, res) => {
    res.json({ 
        status: "URL Scanner Bot is running!",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get("/health", (req, res) => {
    res.json({ 
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        bot: "active"
    });
});


app.listen(PORT, () => {
    console.log(`🌐 Express server running on port: ${PORT}`);
    console.log(`📊 Health check available at: http://localhost:${PORT}/health`);
});


process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    bot.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully...');
    bot.stop();
    process.exit(0);
});