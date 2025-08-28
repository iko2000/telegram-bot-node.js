const express = require("express");
const axios = require("axios"); 
require('dotenv').config();

const { Bot, InlineKeyboard } = require("grammy");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

let screaming = false;

const bot = new Bot(process.env.TELEGRAM_TOKEN);

const urlRegex = /(https?:\/\/[^\s]+)/g;

function extractUrls(text) {
    return text.match(urlRegex) || [];
}


async function checkUrlSafety(url) {
    try {
     
        const response = await axios.post(process.env.EXTERNAL_API_URL, {
            url: url,
       
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.API_KEY}`,
              
            },
            timeout: 10000 // 10 second timeout
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


bot.command("scream", () => {
    screaming = true;
});

bot.command("whisper", () => {
    screaming = false;
});


bot.command("help", async (ctx) => {
    const helpText = `
🤖 <b>URL Scanner Bot</b>

<b>Commands:</b>
/start - Start the bot
/help - Show this help message
/check [url] - Check a specific URL for safety
/menu - Show navigation menu

<b>Auto-checking:</b>
Just send me any message containing URLs and I'll automatically scan them for you!

<b>Features:</b>
🔍 Automatic URL detection
🛡️ Scam/phishing detection  
⚡ Real-time scanning
📊 Detailed safety reports

<b>Example:</b>
Send: "Check this link: https://example.com"
Or use: /check https://example.com
    `;
    
    await ctx.reply(helpText, { parse_mode: "HTML" });
});


bot.command("check", async (ctx) => {
    const text = ctx.message.text;
    const urls = extractUrls(text.replace("/check", "").trim());
    
    if (urls.length === 0) {
        await ctx.reply("❌ Please provide a valid URL to check.\n\nExample: /check https://example.com");
        return;
    }
    
    
    const processingMsg = await ctx.reply("🔄 Scanning URL for threats...");
    
    for (const url of urls) {
        try {
            const result = await checkUrlSafety(url);
            const report = formatSafetyReport(url, result);
            
            await ctx.reply(report, { parse_mode: "HTML" });
        } catch (error) {
            await ctx.reply(`❌ Failed to check ${url}: ${error.message}`);
        }
    }
    
    
    await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
});


const firstMenu = "<b>Menu 1</b>\n\nA beautiful menu with a shiny inline button.";
const secondMenu = "<b>Menu 2</b>\n\nA better menu with even more shiny inline buttons.";

const nextButton = "Next";
const backButton = "Back";
const tutorialButton = "Tutorial";

const firstMenuMarkup = new InlineKeyboard().text(nextButton, nextButton);
const secondMenuMarkup = new InlineKeyboard()
    .text(backButton, backButton)
    .text(tutorialButton, "https://core.telegram.org/bots/tutorial");

bot.command("menu", async (ctx) => {
    await ctx.reply(firstMenu, {
        parse_mode: "HTML",
        reply_markup: firstMenuMarkup,
    });
});

bot.callbackQuery(backButton, async (ctx) => {
    await ctx.editMessageText(firstMenu, {
        reply_markup: firstMenuMarkup,
        parse_mode: "HTML",
    });
});

bot.callbackQuery(nextButton, async (ctx) => {
    await ctx.editMessageText(secondMenu, {
        reply_markup: secondMenuMarkup,
        parse_mode: "HTML",
    });
});


bot.on("message", async (ctx) => {
    console.log(
        `${ctx.from.first_name} wrote ${
            "text" in ctx.message ? ctx.message.text : ""
        }`,
    );


    if (ctx.message.text && ctx.message.text.startsWith('/')) {
        return;
    }

   
    if (ctx.message.text) {
        const urls = extractUrls(ctx.message.text);
        
        if (urls.length > 0) {
            
            const scanningMsg = await ctx.reply(
                `🔍 Found ${urls.length} URL${urls.length > 1 ? 's' : ''} to scan. Checking for threats...`
            );
            
          
            for (const url of urls) {
                try {
                    const result = await checkUrlSafety(url);
                    const report = formatSafetyReport(url, result);
                    
                    await ctx.reply(report, { parse_mode: "HTML" });
                } catch (error) {
                    await ctx.reply(`❌ Failed to check ${url}: ${error.message}`);
                }
            }
            
           
            await ctx.api.deleteMessage(ctx.chat.id, scanningMsg.message_id).catch(() => {});
            
            return; 
        }
    }

    
    if (screaming && ctx.message.text) {
        await ctx.reply(ctx.message.text.toUpperCase(), {
            entities: ctx.message.entities,
        });
    } else {
        await ctx.copyMessage(ctx.message.chat.id);
    }
});

bot.command("start", async (ctx) => {
    const welcomeMsg = `
🛡️ <b>Welcome to URL Scanner Bot!</b>

I help you check if URLs are safe or potentially dangerous/scam links.

<b>How to use:</b>
• Just send me any message with URLs and I'll scan them automatically
• Use /check [url] for manual checking
• Use /help for more information

Stay safe online! 🔒
    `;
    
    await ctx.reply(welcomeMsg, { parse_mode: "HTML" });
});


bot.catch((err) => {
    console.error("Bot error:", err);
});

bot.start();


app.get("/", (req, res) => {
    res.json({ 
        status: "URL Scanner Bot is running!",
        timestamp: new Date().toISOString()
    });
});


app.get("/health", (req, res) => {
    res.json({ 
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`🚀 URL Scanner Bot is running on port: ${PORT}`);
    console.log(`📡 Bot started successfully!`);
});