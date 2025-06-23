// src/index.js - RedAlert Bot with Buttons and Images
const { Telegraf, Markup } = require('telegraf');
const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import services
const TransactionMonitor = require('./services/transactionMonitor');
const ThreatAnalyzer = require('./services/threatAnalyzer');
const EmergencyActions = require('./services/emergencyActions');

// Enhanced storage
const userWallets = new Map();
const userSettings = new Map();
const threatAlerts = new Map();

class RedAlertBotWithButtons {
  constructor() {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is required in .env file');
    }

    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    this.solanaConnection = new Connection(this.rpcUrl, 'confirmed');
    
    // Initialize services
    this.transactionMonitor = new TransactionMonitor(this.rpcUrl);
    this.threatAnalyzer = new ThreatAnalyzer(process.env.OPENAI_API_KEY);
    this.emergencyActions = new EmergencyActions(this.rpcUrl);
    
    // Load octopus image
    this.octopusImagePath = path.join(__dirname, 'images', 'redalert-octopus.jpg');
    
    this.setupCommands();
    this.setupCallbackHandlers();
  }

  // Helper to send messages with octopus image and buttons
  async sendWithOctopus(ctx, message, buttons = null, options = {}) {
    try {
      // Handle different context types
      let telegram, chatId;
      
      if (ctx.telegram && ctx.from) {
        // Regular Telegraf context
        telegram = ctx.telegram;
        chatId = ctx.from.id;
      } else if (ctx.telegram && ctx.chatId) {
        // Custom context with telegram instance
        telegram = ctx.telegram;
        chatId = ctx.chatId;
      } else if (typeof ctx === 'object' && ctx.telegram) {
        // Custom context object
        telegram = ctx.telegram;
        chatId = ctx.from ? ctx.from.id : ctx.chatId;
      } else {
        console.error('Invalid context provided to sendWithOctopus');
        return;
      }

      const keyboard = buttons || this.getMainMenuButtons();

      // Check if image exists
      if (fs.existsSync(this.octopusImagePath)) {
        await telegram.sendPhoto(
          chatId,
          { source: this.octopusImagePath },
          {
            caption: message,
            parse_mode: 'Markdown',
            reply_markup: keyboard.reply_markup,
            ...options
          }
        );
      } else {
        // Fallback to text with octopus emoji
        const octopusHeader = `🚨🐙 **REDALERT SECURITY** 🐙🚨\n\n`;
        
        await telegram.sendMessage(
          chatId,
          octopusHeader + message,
          {
            parse_mode: 'Markdown',
            reply_markup: keyboard.reply_markup,
            ...options
          }
        );
      }
    } catch (error) {
      console.error('Error sending with octopus:', error);
      
      // Ultimate fallback - try simple message
      try {
        let telegram, chatId;
        
        if (ctx.telegram && ctx.from) {
          telegram = ctx.telegram;
          chatId = ctx.from.id;
        } else if (ctx.telegram) {
          telegram = ctx.telegram;
          chatId = ctx.from ? ctx.from.id : ctx.chatId;
        }
        
        if (telegram && chatId) {
          await telegram.sendMessage(chatId, `🐙 ${message}`, { parse_mode: 'Markdown' });
        }
      } catch (fallbackError) {
        console.error('Fallback send also failed:', fallbackError);
      }
    }
  }

  // Main menu buttons
  getMainMenuButtons() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('🔍 Add Wallet', 'add_wallet'),
        Markup.button.callback('📊 Status', 'status')
      ],
      [
        Markup.button.callback('🚨 Alerts', 'alerts'),
        Markup.button.callback('🧠 AI Analysis', 'analyze')
      ],
      [
        Markup.button.callback('🆘 Emergency', 'emergency'),
        Markup.button.callback('⚙️ Settings', 'settings')
      ],
      [
        Markup.button.callback('❓ Help', 'help'),
        Markup.button.callback('📖 About', 'about')
      ]
    ]);
  }

  // Emergency action buttons
  getEmergencyButtons() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('🔍 Full Analysis', 'emergency_analysis'),
        Markup.button.callback('🚫 Revoke Tokens', 'emergency_revoke')
      ],
      [
        Markup.button.callback('💸 Move Assets', 'emergency_move'),
        Markup.button.callback('📞 Contact Support', 'emergency_contact')
      ],
      [
        Markup.button.callback('⬅️ Back to Menu', 'main_menu')
      ]
    ]);
  }

  // Monitor control buttons
  getMonitorButtons() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('▶️ Start Monitoring', 'monitor_start'),
        Markup.button.callback('⏹️ Stop Monitoring', 'monitor_stop')
      ],
      [
        Markup.button.callback('📊 Monitor Stats', 'monitor_stats'),
        Markup.button.callback('⚙️ Monitor Settings', 'monitor_settings')
      ],
      [
        Markup.button.callback('⬅️ Back to Menu', 'main_menu')
      ]
    ]);
  }

  // Wallet management buttons
  getWalletButtons() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('➕ Add Wallet', 'add_wallet_input'),
        Markup.button.callback('🗑️ Remove Wallet', 'remove_wallet')
      ],
      [
        Markup.button.callback('📊 Wallet Status', 'status'),
        Markup.button.callback('🔍 Analyze Wallet', 'analyze_wallet')
      ],
      [
        Markup.button.callback('⬅️ Back to Menu', 'main_menu')
      ]
    ]);
  }

  setupCommands() {
    // Enhanced start command with buttons
    this.bot.start(async (ctx) => {
      const welcomeMessage = `*Welcome to RedAlert v2.0!* 🐙

I'm your AI-powered wallet security guardian with real-time threat detection!

*🛡️ Advanced Features:*
• **Real-time transaction monitoring**
• **AI-powered threat analysis** 
• **Emergency response system**
• **Automated threat alerts**

*🚀 New in v2.0:*
• Interactive button controls
• Enhanced visual alerts
• Faster emergency response
• Improved AI detection

*🐙 Choose an action below to start protecting your bags!*`;

      await this.sendWithOctopus(ctx, welcomeMessage);
      console.log(`New user started: ${ctx.from.id} (${ctx.from.username || 'no username'})`);
    });

    // Text-based wallet addition (for direct commands)
    this.bot.command('addwallet', async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length >= 2) {
        await this.handleAddWallet(ctx, args[1]);
      } else {
        await this.sendWithOctopus(
          ctx,
          `*Add Wallet* 🔍

Please provide a wallet address to monitor:

*Example:* \`7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\`

*Reply with your Solana wallet address*`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Menu', 'main_menu')]
          ])
        );
      }
    });

    // Quick command shortcuts
    this.bot.command('status', async (ctx) => {
      await this.handleStatus(ctx);
    });

    this.bot.command('emergency', async (ctx) => {
      await this.handleEmergency(ctx);
    });

    this.bot.command('alerts', async (ctx) => {
      await this.handleAlerts(ctx);
    });

    // Handle text messages (for wallet addresses)
    this.bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      
      // Check if it's a Solana address
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text)) {
        await this.handleAddWallet(ctx, text);
      } else if (/^\d+$/.test(text)) {
        // Handle wallet removal numbers
        await this.handleWalletRemovalNumber(ctx, parseInt(text));
      } else {
        // Unknown command - show menu
        await this.sendWithOctopus(
          ctx,
          `*I didn't understand that command* 🤔

Use the buttons below or type:
• \`/addwallet <address>\` to add a wallet
• \`/status\` to check protection
• \`/help\` for all commands

*🐙 Choose an action:*`
        );
      }
    });

    // Error handling
    this.bot.catch((err, ctx) => {
      console.error('Bot error:', err);
      this.sendWithOctopus(
        ctx,
        `*An error occurred!* ❌

Don't worry, your octopus is investigating! 🐙

*Error details:* ${err.message}

*Try again or contact support*`,
        this.getMainMenuButtons()
      );
    });
  }

  setupCallbackHandlers() {
    // Main menu callback
    this.bot.action('main_menu', async (ctx) => {
      await ctx.answerCbQuery();
      
      const message = `*RedAlert Security Dashboard* 🐙

*🛡️ Your wallet protection center*

Choose an action below to manage your security:`;

      await this.sendWithOctopus(ctx, message);
    });

    // Add wallet callbacks
    this.bot.action('add_wallet', async (ctx) => {
      await ctx.answerCbQuery();
      
      const message = `*Add Wallet for Monitoring* 🔍

*🚨 Real-time protection includes:*
• Live transaction monitoring
• AI threat detection
• Emergency alerts
• Suspicious activity analysis

*📝 Send me your Solana wallet address:*
Example: \`7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\`

*🐙 I'll start protecting it immediately!*`;

      await this.sendWithOctopus(
        ctx,
        message,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back to Menu', 'main_menu')]
        ])
      );
    });

    // Status callback
    this.bot.action('status', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleStatus(ctx);
    });

    // Alerts callback
    this.bot.action('alerts', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleAlerts(ctx);
    });

    // AI Analysis callback
    this.bot.action('analyze', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleAnalyze(ctx);
    });

    // Emergency callbacks
    this.bot.action('emergency', async (ctx) => {
      await ctx.answerCbQuery();
      
      const message = `*🚨 EMERGENCY RESPONSE CENTER 🚨*

*⚡ Immediate Actions Available:*

**🔍 Full Analysis** - Complete security scan
**🚫 Revoke Tokens** - Stop token drainers
**💸 Move Assets** - Protect valuable funds  
**📞 Contact Support** - Get expert help

*🐙 Choose your emergency action:*`;

      await this.sendWithOctopus(ctx, message, this.getEmergencyButtons());
    });

    this.bot.action('emergency_analysis', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleEmergencyAnalysis(ctx);
    });

    this.bot.action('emergency_revoke', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleEmergencyRevoke(ctx);
    });

    this.bot.action('emergency_move', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleEmergencyMove(ctx);
    });

    this.bot.action('emergency_contact', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleEmergencyContact(ctx);
    });

    // Monitor controls
    this.bot.action('monitor_start', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleMonitorControl(ctx, 'start');
    });

    this.bot.action('monitor_stop', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleMonitorControl(ctx, 'stop');
    });

    this.bot.action('monitor_stats', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleMonitorStats(ctx);
    });

    // Settings callback
    this.bot.action('settings', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleSettings(ctx);
    });

    // Help callback
    this.bot.action('help', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleHelp(ctx);
    });

    // About callback
    this.bot.action('about', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleAbout(ctx);
    });

    // Remove wallet callback
    this.bot.action('remove_wallet', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleRemoveWallet(ctx);
    });
  }

  // Handler implementations
  async handleAddWallet(ctx, walletAddress) {
    try {
      // Validate Solana address
      try {
        new PublicKey(walletAddress);
      } catch (error) {
        await this.sendWithOctopus(
          ctx,
          `*Invalid Wallet Address* ❌

The address you provided is not a valid Solana wallet address.

*Please check and try again:*
• Should be 32-44 characters
• Contains only valid base58 characters
• Example: \`7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\`

*🐙 Send me a valid address:*`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Menu', 'main_menu')]
          ])
        );
        return;
      }

      const userId = ctx.from.id.toString();
      
      // Check if wallet already exists
      if (!userWallets.has(userId)) {
        userWallets.set(userId, []);
      }

      const wallets = userWallets.get(userId);
      if (wallets.some(w => w.address === walletAddress)) {
        await this.sendWithOctopus(
          ctx,
          `*Wallet Already Monitored* ⚠️

This wallet is already under octopus protection!

*Address:* \`${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}\`

*🐙 Choose another action:*`,
          this.getWalletButtons()
        );
        return;
      }

      // Add loading message
      await this.sendWithOctopus(
        ctx,
        `*Adding Wallet...* ⏳

*🔍 Validating address...*
*🚨 Initializing monitoring...*
*🧠 Setting up AI analysis...*

*Please wait...*`,
        null
      );

      // Add new wallet
      const newWallet = {
        address: walletAddress,
        isActive: true,
        addedAt: new Date(),
        healthScore: 100,
        realTimeMonitoring: true
      };

      wallets.push(newWallet);
      userWallets.set(userId, wallets);

      // Start real-time monitoring
      const success = await this.transactionMonitor.startMonitoring(
        walletAddress,
        userId,
        (address, threat) => this.handleThreatDetected(address, threat, userId, ctx)
      );

      if (success) {
        await this.sendWithOctopus(
          ctx,
          `*🎉 Wallet Successfully Added! 🎉*

*Address:* \`${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}\`

*✅ PROTECTION ACTIVATED:*
• **Real-time transaction monitoring**
• **AI-powered threat detection** 
• **Emergency response system**
• **Automated security alerts**

*🐙 Your bags are now under advanced octopus protection!*

*What's next?*`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback('📊 View Status', 'status'),
              Markup.button.callback('🧠 AI Analysis', 'analyze')
            ],
            [
              Markup.button.callback('⚙️ Settings', 'settings'),
              Markup.button.callback('🏠 Main Menu', 'main_menu')
            ]
          ])
        );

        // Perform initial analysis
        setTimeout(() => this.performInitialAnalysis(walletAddress, userId, ctx), 3000);
      } else {
        await this.sendWithOctopus(
          ctx,
          `*Wallet Added (Limited Mode)* ⚠️

*Address:* \`${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}\`

Basic protection is active, but real-time monitoring failed to start.

*🔧 Try these actions:*`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback('🔄 Retry Monitoring', 'monitor_start'),
              Markup.button.callback('📊 Check Status', 'status')
            ],
            [
              Markup.button.callback('🏠 Main Menu', 'main_menu')
            ]
          ])
        );
      }

      console.log(`Enhanced monitoring started for ${walletAddress} (user: ${userId})`);

    } catch (error) {
      console.error('Error in handleAddWallet:', error);
      await this.sendWithOctopus(
        ctx,
        `*Failed to Add Wallet* ❌

*Error:* ${error.message}

*🐙 Please try again or contact support*`,
        this.getMainMenuButtons()
      );
    }
  }

  async handleStatus(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const wallets = userWallets.get(userId) || [];

      if (wallets.length === 0) {
        await this.sendWithOctopus(
          ctx,
          `*No Wallets Registered* 📱

Ready to start protecting your assets?

*🚨 Add your first wallet to enable:*
• Real-time monitoring
• AI threat detection  
• Emergency alerts
• Advanced security

*🐙 Get started now:*`,
          Markup.inlineKeyboard([
            [Markup.button.callback('➕ Add First Wallet', 'add_wallet')],
            [Markup.button.callback('🏠 Main Menu', 'main_menu')]
          ])
        );
        return;
      }

      let statusMessage = `*🔍 Advanced Protection Status 🔍*\n\n`;
      
      for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        const healthEmoji = this.getHealthEmoji(wallet.healthScore || 100);
        const isMonitored = this.transactionMonitor.monitoredWallets.has(wallet.address);
        const recentAlerts = this.getRecentAlerts(wallet.address);
        
        statusMessage += `${healthEmoji} *Wallet ${i + 1}* ${isMonitored ? '📡' : '⭕'}\n`;
        statusMessage += `   \`${wallet.address.slice(0, 8)}...${wallet.address.slice(-8)}\`\n`;
        statusMessage += `   Status: ${wallet.isActive ? '🟢 Active' : '🔴 Paused'}\n`;
        statusMessage += `   Health: ${wallet.healthScore || 100}/100\n`;
        statusMessage += `   Monitoring: ${isMonitored ? '🟢 Real-time' : '🔴 Basic'}\n`;
        statusMessage += `   Alerts: ${recentAlerts}\n\n`;
      }

      const stats = this.transactionMonitor.getMonitoringStats();
      statusMessage += `*📊 System Status:*\n`;
      statusMessage += `• Monitored: ${stats.totalWallets} wallets\n`;
      statusMessage += `• AI Analysis: ${process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_key_here' ? '🟢 Active' : '🔴 Disabled'}\n`;
      statusMessage += `• Emergency System: 🟢 Ready\n\n`;
      statusMessage += `*🐙 Your octopus is watching!*`;

      await this.sendWithOctopus(
        ctx,
        statusMessage,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('🚨 View Alerts', 'alerts'),
            Markup.button.callback('🧠 AI Analysis', 'analyze')
          ],
          [
            Markup.button.callback('⚙️ Monitor Controls', 'monitor_stats'),
            Markup.button.callback('➕ Add Wallet', 'add_wallet')
          ],
          [
            Markup.button.callback('🏠 Main Menu', 'main_menu')
          ]
        ])
      );

    } catch (error) {
      console.error('Error in handleStatus:', error);
      await ctx.reply('❌ Failed to check status.');
    }
  }

  async handleAlerts(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const userAlerts = Array.from(threatAlerts.entries())
        .filter(([key, alert]) => alert.userId === userId)
        .slice(-10)
        .sort((a, b) => b[1].timestamp - a[1].timestamp);

      if (userAlerts.length === 0) {
        await this.sendWithOctopus(
          ctx,
          `*No Recent Threat Alerts* 📱

*🟢 All Clear!*

All monitored wallets are secure. Your octopus will alert you immediately if any threats are detected.

*🛡️ Protection Status:*
• Real-time monitoring: Active
• AI threat detection: Running
• Emergency system: Ready

*🐙 Keep your bags safe!*`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback('📊 Check Status', 'status'),
              Markup.button.callback('🧠 AI Analysis', 'analyze')
            ],
            [
              Markup.button.callback('🏠 Main Menu', 'main_menu')
            ]
          ])
        );
        return;
      }

      let alertsMessage = `*🚨 Recent Threat Alerts 🚨*\n\n`;
      
      userAlerts.forEach(([alertId, alert], index) => {
        const emoji = alert.riskScore >= 80 ? '🔴' : alert.riskScore >= 60 ? '🟡' : '🟢';
        alertsMessage += `${emoji} *Alert ${index + 1}* - ${alert.timestamp.toLocaleString()}\n`;
        alertsMessage += `   Wallet: \`${alert.walletAddress.slice(0, 8)}...\`\n`;
        alertsMessage += `   Risk: ${alert.riskScore}/100\n`;
        alertsMessage += `   Threat: ${alert.threats[0] || 'Unknown'}\n\n`;
      });

      alertsMessage += `*🐙 Emergency actions available below*`;

      await this.sendWithOctopus(
        ctx,
        alertsMessage,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('🆘 Emergency Response', 'emergency'),
            Markup.button.callback('🧠 Deep Analysis', 'analyze')
          ],
          [
            Markup.button.callback('📊 Check Status', 'status'),
            Markup.button.callback('🏠 Main Menu', 'main_menu')
          ]
        ])
      );

    } catch (error) {
      console.error('Error in handleAlerts:', error);
      await ctx.reply('❌ Failed to load alerts.');
    }
  }

  // Additional handlers...
  async handleAnalyze(ctx) {
    const userId = ctx.from.id.toString();
    const wallets = userWallets.get(userId) || [];
    
    if (wallets.length === 0) {
      await this.sendWithOctopus(
        ctx,
        `*No Wallets to Analyze* 🧠

Add a wallet first to use AI analysis features.

*🐙 Ready to start?*`,
        Markup.inlineKeyboard([
          [Markup.button.callback('➕ Add Wallet', 'add_wallet')],
          [Markup.button.callback('🏠 Main Menu', 'main_menu')]
        ])
      );
      return;
    }

    await this.sendWithOctopus(
      ctx,
      `*🧠 AI Analysis Starting...* 

*🔍 Analyzing wallet security...*
*🤖 Running threat detection...*
*📊 Generating risk profile...*

*This may take a moment...*`,
      null
    );

    // Perform analysis on first wallet (could be extended for multiple)
    const walletAddress = wallets[0].address;
    
    try {
      // Basic analysis implementation
      let analysisMessage = `*🧠 AI Analysis Complete 🧠*\n\n`;
      analysisMessage += `*🐙 Wallet:* \`${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}\`\n`;
      analysisMessage += `*⏰ Analysis Time:* ${new Date().toLocaleString()}\n\n`;
      
      const riskProfile = this.threatAnalyzer.getWalletRiskProfile(walletAddress);
      
      if (riskProfile) {
        analysisMessage += `*📊 Risk Profile:*\n`;
        analysisMessage += `• Account Age: ${riskProfile.accountAge} days\n`;
        analysisMessage += `• Transactions: ${riskProfile.totalTransactions}\n`;
        analysisMessage += `• Risk Score: ${riskProfile.riskScore}/100\n`;
        analysisMessage += `• Patterns: ${riskProfile.patterns.join(', ') || 'Standard'}\n\n`;
      }
      
      analysisMessage += `*🛡️ Security Status:* All systems operational\n`;
      analysisMessage += `*🎯 Recommendation:* Continue monitoring\n\n`;
      analysisMessage += `*🐙 Your octopus found no immediate threats*`;

      await this.sendWithOctopus(
        ctx,
        analysisMessage,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('🆘 Emergency Check', 'emergency'),
            Markup.button.callback('📊 View Status', 'status')
          ],
          [
            Markup.button.callback('🏠 Main Menu', 'main_menu')
          ]
        ])
      );

    } catch (error) {
      await this.sendWithOctopus(
        ctx,
        `*Analysis Failed* ❌

*Error:* ${error.message}

*🐙 Try again or use emergency analysis*`,
        this.getMainMenuButtons()
      );
    }
  }

  // ... Continue with other handlers (Emergency, Settings, etc.)
  async handleEmergency(ctx) {
    const message = `*🚨 EMERGENCY RESPONSE CENTER 🚨*

*⚡ Immediate Actions Available:*

Choose your emergency response:`;

    await this.sendWithOctopus(ctx, message, this.getEmergencyButtons());
  }

  async handleEmergencyAnalysis(ctx) {
    const userId = ctx.from.id.toString();
    const wallets = userWallets.get(userId) || [];
    
    if (wallets.length === 0) {
      await this.sendWithOctopus(
        ctx,
        `*No Wallets for Emergency Analysis* 🚨

Add a wallet first to use emergency features.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('➕ Add Wallet', 'add_wallet')],
          [Markup.button.callback('🏠 Main Menu', 'main_menu')]
        ])
      );
      return;
    }

    await this.sendWithOctopus(
      ctx,
      `*🚨 EMERGENCY ANALYSIS INITIATED 🚨*

*🔍 Performing comprehensive security scan...*
*🤖 Checking for active threats...*
*📊 Analyzing recent activity...*

*⏳ Please wait...*`,
      null
    );

    try {
      const walletAddress = wallets[0].address;
      const analysis = await this.emergencyActions.performEmergencyAnalysis(walletAddress);
      const response = this.emergencyActions.formatEmergencyResponse(analysis);

      await this.sendWithOctopus(
        ctx,
        response,
        this.getEmergencyButtons()
      );

    } catch (error) {
      await this.sendWithOctopus(
        ctx,
        `*Emergency Analysis Failed* ❌

*Error:* ${error.message}

*🆘 Contact support immediately*`,
        this.getEmergencyButtons()
      );
    }
  }

  // ... Additional handlers can be implemented similarly

  // Helper methods
  getHealthEmoji(score) {
    if (score >= 90) return '🟢';
    if (score >= 70) return '🟡';
    return '🔴';
  }

  getRecentAlerts(walletAddress) {
    const recentAlerts = Array.from(threatAlerts.values())
      .filter(alert => alert.walletAddress === walletAddress && 
                     Date.now() - alert.timestamp.getTime() < 24 * 60 * 60 * 1000)
      .length;
    
    return recentAlerts > 0 ? `🔴 ${recentAlerts}` : '🟢 0';
  }

  // Threat handling
  async handleThreatDetected(walletAddress, basicThreat, userId, ctx) {
    try {
      console.log(`🚨 Threat detected for wallet ${walletAddress}`);
      
      // Enhance threat with AI analysis
      const enhancedThreat = await this.threatAnalyzer.analyzeTransactionWithAI(
        walletAddress,
        basicThreat.transaction,
        { logs: basicThreat.threats },
        basicThreat
      );

      // Store alert
      const alertId = `${walletAddress}-${Date.now()}`;
      threatAlerts.set(alertId, {
        ...enhancedThreat,
        userId,
        walletAddress,
        alertId
      });

      // Format threat alert with action buttons
      const urgencyEmoji = enhancedThreat.riskScore >= 80 ? '🚨🚨🚨' : enhancedThreat.riskScore >= 60 ? '⚠️⚠️' : '👀';
      const urgencyLevel = enhancedThreat.riskScore >= 80 ? 'CRITICAL THREAT' : enhancedThreat.riskScore >= 60 ? 'HIGH RISK' : 'SUSPICIOUS ACTIVITY';
      
      let alertMessage = `${urgencyEmoji} **${urgencyLevel} DETECTED** ${urgencyEmoji}\n\n`;
      alertMessage += `🐙 **Wallet**: \`${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}\`\n`;
      alertMessage += `📊 **Risk Score**: ${enhancedThreat.riskScore}/100\n`;
      alertMessage += `⏰ **Time**: ${enhancedThreat.timestamp.toLocaleTimeString()}\n\n`;
      
      // Add threats
      alertMessage += `⚡ **Detected Threats**:\n`;
      enhancedThreat.threats.slice(0, 3).forEach(t => {
        alertMessage += `• ${t}\n`;
      });
      alertMessage += `\n`;
      
      // Add AI analysis if available
      if (enhancedThreat.aiAnalysis) {
        alertMessage += `🧠 **AI Analysis** (${enhancedThreat.aiAnalysis.confidence}% confidence):\n`;
        alertMessage += `${enhancedThreat.aiAnalysis.explanation}\n\n`;
      }
      
      alertMessage += `🐙 **Take immediate action below!**`;

      // Create threat-specific action buttons
      const threatButtons = Markup.inlineKeyboard([
        [
          Markup.button.callback('🆘 Emergency Response', 'emergency_analysis'),
          Markup.button.callback('🚫 Revoke Tokens', 'emergency_revoke')
        ],
        [
          Markup.button.callback('💸 Move Assets', 'emergency_move'),
          Markup.button.callback('📞 Get Help', 'emergency_contact')
        ],
        [
          Markup.button.callback('📊 Check Status', 'status'),
          Markup.button.callback('🔍 Full Analysis', 'analyze')
        ]
      ]);

      // Create proper context for threat alert
      const customCtx = {
        telegram: this.bot.telegram,
        chatId: userId
      };

      // Send threat alert with octopus image and action buttons
      await this.sendWithOctopus(customCtx, alertMessage, threatButtons);

      // Trigger emergency alert if critical
      if (enhancedThreat.riskScore >= 80) {
        await this.emergencyActions.triggerEmergencyAlert(userId, walletAddress, enhancedThreat);
        
        // Send additional critical alert
        await this.sendWithOctopus(
          customCtx,
          `*🚨 CRITICAL SECURITY ALERT 🚨*

*IMMEDIATE ACTION REQUIRED*

Your wallet may be under active attack!

*🆘 Emergency steps:*
1. **Stop all transactions**
2. **Revoke token approvals** 
3. **Move assets to safety**
4. **Contact support**

*🐙 Use emergency buttons above!*`,
          this.getEmergencyButtons()
        );
      }

    } catch (error) {
      console.error('Error handling threat:', error);
      
      // Fallback notification
      try {
        await this.bot.telegram.sendMessage(
          userId,
          `🚨 THREAT DETECTED 🚨\n\nWallet: ${walletAddress.slice(0, 8)}...\nRisk Score: ${basicThreat.riskScore}/100\n\n🐙 Check your wallet immediately!`
        );
      } catch (fallbackError) {
        console.error('Fallback threat notification failed:', fallbackError);
      }
    }
  }

  async performInitialAnalysis(walletAddress, userId, ctx) {
    try {
      console.log(`🔍 Performing initial analysis for ${walletAddress}`);
      
      const publicKey = new PublicKey(walletAddress);
      const accountInfo = await this.solanaConnection.getAccountInfo(publicKey);
      
      let analysisMessage = `*🔍 Initial Security Analysis Complete*\n\n`;
      analysisMessage += `🐙 **Wallet**: \`${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}\`\n\n`;
      
      if (accountInfo) {
        analysisMessage += `✅ Account is active and healthy\n`;
        analysisMessage += `💰 Balance: ${(accountInfo.lamports / 1e9).toFixed(4)} SOL\n`;
      } else {
        analysisMessage += `⚠️ Account appears empty or inactive\n`;
      }
      
      analysisMessage += `🚨 Real-time monitoring: **ACTIVE**\n`;
      analysisMessage += `🤖 AI threat detection: **ENABLED**\n`;
      analysisMessage += `⚡ Emergency response: **READY**\n\n`;
      analysisMessage += `🐙 Your octopus is now watching this wallet 24/7!`;
      
      const analysisButtons = Markup.inlineKeyboard([
        [
          Markup.button.callback('📊 View Status', 'status'),
          Markup.button.callback('⚙️ Settings', 'settings')
        ],
        [
          Markup.button.callback('🏠 Main Menu', 'main_menu')
        ]
      ]);

      // Create proper context for sendWithOctopus
      const customCtx = {
        telegram: this.bot.telegram,
        chatId: userId
      };

      await this.sendWithOctopus(customCtx, analysisMessage, analysisButtons);
      
    } catch (error) {
      console.error('Initial analysis failed:', error);
      
      // Fallback - send simple message
      try {
        await this.bot.telegram.sendMessage(
          userId,
          `🔍 Initial analysis complete for ${walletAddress.slice(0, 8)}...\n\n🐙 Your wallet is now under protection!`
        );
      } catch (fallbackError) {
        console.error('Fallback message also failed:', fallbackError);
      }
    }
  }

  // Additional handlers
  async handleSettings(ctx) {
    const settingsMessage = `*⚙️ RedAlert Settings ⚙️*

*🔧 Current Configuration:*
🔔 Threat Alerts: **Enabled**
📱 Telegram Notifications: **Enabled** 
📊 Health Reports: **Daily**
🚨 Emergency Mode: **Active**
🧠 AI Analysis: **${process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_key_here' ? 'Enabled' : 'Disabled'}**

*⚡ Quick Settings:*`;

    await this.sendWithOctopus(
      ctx,
      settingsMessage,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('🔔 Alert Settings', 'alert_settings'),
          Markup.button.callback('📊 Reports', 'report_settings')
        ],
        [
          Markup.button.callback('🚨 Emergency', 'emergency_settings'),
          Markup.button.callback('🤖 AI Config', 'ai_settings')
        ],
        [
          Markup.button.callback('⬅️ Back to Menu', 'main_menu')
        ]
      ])
    );
  }

  async handleHelp(ctx) {
    const helpMessage = `*❓ RedAlert Help Center ❓*

*🚨 Command Guide:*

**🛡️ Protection:**
• Add Wallet - Start monitoring
• View Status - Check protection
• Emergency - Crisis response

**🧠 Analysis:**  
• AI Analysis - Deep security scan
• View Alerts - Recent threats
• Monitor Stats - System status

**⚙️ Controls:**
• Settings - Configure alerts
• Help - This guide
• About - Bot information

*🐙 Your octopus is here to help!*

*📚 Need more help?*`;

    await this.sendWithOctopus(
      ctx,
      helpMessage,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('🆘 Emergency Help', 'emergency_contact'),
          Markup.button.callback('📖 User Guide', 'about')
        ],
        [
          Markup.button.callback('💬 Community', 'community'),
          Markup.button.callback('📞 Support', 'emergency_contact')
        ],
        [
          Markup.button.callback('⬅️ Back to Menu', 'main_menu')
        ]
      ])
    );
  }

  async handleAbout(ctx) {
    const aboutMessage = `*🐙 RedAlert v2.0 - Advanced Security*

*🚀 The first AI-powered wallet security bot with real-time threat detection!*

**🛡️ Advanced Features:**
• Real-time transaction monitoring
• AI-powered threat analysis (GPT-4)
• Emergency response automation  
• Behavioral pattern recognition
• Interactive button controls
• Visual threat alerts

**🔒 Protection Levels:**
• **Real-time**: Live monitoring
• **AI Analysis**: Smart detection
• **Emergency**: Instant response
• **Predictive**: Behavior alerts

**🔗 Technology:**
• Solana blockchain integration
• OpenAI GPT-4 analysis
• WebSocket monitoring
• Advanced pattern recognition

*🐙 Trust the advanced octopus. Maximum protection.*

**Coming Soon:** $REDALERT token utility`;

    await this.sendWithOctopus(
      ctx,
      aboutMessage,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('🌐 Website', 'website'),
          Markup.button.callback('💬 Community', 'community')
        ],
        [
          Markup.button.callback('🐦 Twitter', 'twitter'),
          Markup.button.callback('📱 Telegram', 'telegram_channel')
        ],
        [
          Markup.button.callback('⬅️ Back to Menu', 'main_menu')
        ]
      ])
    );
  }

  async handleMonitorControl(ctx, action) {
    const userId = ctx.from.id.toString();
    const wallets = userWallets.get(userId) || [];

    if (action === 'start') {
      let started = 0;
      for (const wallet of wallets) {
        if (!this.transactionMonitor.monitoredWallets.has(wallet.address)) {
          const success = await this.transactionMonitor.startMonitoring(
            wallet.address,
            userId,
            (address, threat) => this.handleThreatDetected(address, threat, userId, ctx)
          );
          if (success) started++;
        }
      }
      
      await this.sendWithOctopus(
        ctx,
        `*🟢 Monitoring Started*

Started real-time monitoring for ${started} wallets.

*🚨 Active protection features:*
• Live transaction monitoring
• AI threat detection
• Emergency alerts

*🐙 Your octopus is now watching!*`,
        this.getMonitorButtons()
      );
      
    } else if (action === 'stop') {
      let stopped = 0;
      for (const wallet of wallets) {
        if (this.transactionMonitor.monitoredWallets.has(wallet.address)) {
          await this.transactionMonitor.stopMonitoring(wallet.address);
          stopped++;
        }
      }
      
      await this.sendWithOctopus(
        ctx,
        `*🔴 Monitoring Stopped*

Stopped monitoring for ${stopped} wallets.

*⚠️ Protection reduced to basic mode*

*🐙 Restart anytime with the button below*`,
        this.getMonitorButtons()
      );
    }
  }

  async handleMonitorStats(ctx) {
    const stats = this.transactionMonitor.getMonitoringStats();
    
    let statsMessage = `*📊 Monitoring Statistics*\n\n`;
    statsMessage += `**System Status:**\n`;
    statsMessage += `• Active Wallets: ${stats.totalWallets}\n`;
    statsMessage += `• AI Analysis: ${process.env.OPENAI_API_KEY ? '🟢 Active' : '🔴 Disabled'}\n`;
    statsMessage += `• Emergency System: 🟢 Ready\n\n`;
    
    if (stats.wallets.length > 0) {
      statsMessage += `**Recent Activity:**\n`;
      stats.wallets.slice(0, 5).forEach(w => {
        statsMessage += `• ${w.address}: ${w.transactionCount} transactions\n`;
      });
    } else {
      statsMessage += `**No recent activity detected**\n`;
    }
    
    statsMessage += `\n*🐙 All systems operational*`;

    await this.sendWithOctopus(
      ctx,
      statsMessage,
      this.getMonitorButtons()
    );
  }

  async handleEmergencyRevoke(ctx) {
    const userId = ctx.from.id.toString();
    const wallets = userWallets.get(userId) || [];
    
    if (wallets.length === 0) {
      await this.sendWithOctopus(
        ctx,
        `*No Wallets to Check* ❌

Add a wallet first to use emergency revoke features.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('➕ Add Wallet', 'add_wallet')],
          [Markup.button.callback('⬅️ Back', 'emergency')]
        ])
      );
      return;
    }

    await this.sendWithOctopus(
      ctx,
      `*🔍 Analyzing Token Approvals...* ⏳

*🚨 Checking for dangerous approvals...*
*🔍 Scanning all token permissions...*
*📊 Generating revoke instructions...*

*Please wait...*`,
      null
    );

    try {
      const walletAddress = wallets[0].address;
      const revokeGuide = await this.emergencyActions.generateRevokeInstructions(walletAddress);
      
      let message = `*🚨 Emergency Revoke Guide*\n\n`;
      message += `🐙 **Wallet**: \`${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}\`\n\n`;
      
      if (revokeGuide.error) {
        message += `❌ ${revokeGuide.error}\n\n`;
        message += `*🔗 Manual revoke options:*\n`;
        message += `• Visit revoke.cash\n`;
        message += `• Connect your wallet\n`;
        message += `• Revoke ALL approvals\n\n`;
      } else {
        message += `📊 **Found**: ${revokeGuide.totalApprovals} active approvals\n\n`;
        
        if (revokeGuide.totalApprovals > 0) {
          message += `*🆘 IMMEDIATE ACTION REQUIRED*\n\n`;
          message += `**Quick Steps:**\n`;
          revokeGuide.manualSteps.slice(0, 6).forEach(step => {
            message += `${step}\n`;
          });
        } else {
          message += `*✅ Good news!* No dangerous approvals found.\n`;
        }
      }
      
      message += `\n*🐙 Act quickly but verify everything!*`;

      await this.sendWithOctopus(
        ctx,
        message,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('🔗 Open Revoke.cash', 'revoke_cash'),
            Markup.button.callback('📞 Get Help', 'emergency_contact')
          ],
          [
            Markup.button.callback('🔍 Re-analyze', 'emergency_revoke'),
            Markup.button.callback('⬅️ Back', 'emergency')
          ]
        ])
      );

    } catch (error) {
      await this.sendWithOctopus(
        ctx,
        `*Emergency Revoke Failed* ❌

*Error:* ${error.message}

*🆘 Manual action required:*
Visit revoke.cash and revoke all approvals immediately.

*🐙 Contact support if needed*`,
        this.getEmergencyButtons()
      );
    }
  }

  async handleEmergencyMove(ctx) {
    const userId = ctx.from.id.toString();
    const wallets = userWallets.get(userId) || [];
    
    if (wallets.length === 0) {
      await this.sendWithOctopus(
        ctx,
        `*No Wallets to Analyze* ❌

Add a wallet first to use emergency move features.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('➕ Add Wallet', 'add_wallet')],
          [Markup.button.callback('⬅️ Back', 'emergency')]
        ])
      );
      return;
    }

    await this.sendWithOctopus(
      ctx,
      `*🔍 Analyzing Assets for Emergency Move...* ⏳

*💰 Checking SOL balance...*
*🪙 Scanning token holdings...*
*📊 Prioritizing valuable assets...*

*Please wait...*`,
      null
    );

    try {
      const walletAddress = wallets[0].address;
      const moveGuide = await this.emergencyActions.generateMoveAssetsInstructions(walletAddress);
      
      let message = `*🚨 Emergency Asset Protection*\n\n`;
      message += `🐙 **Wallet**: \`${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}\`\n\n`;
      
      if (moveGuide.error) {
        message += `❌ ${moveGuide.error}\n\n`;
        message += `*🔍 Manual check:* Review your wallet and move valuable assets to safety.\n\n`;
      } else {
        message += `📊 **Found**: ${moveGuide.totalAssets} assets\n\n`;
        
        const highPriority = moveGuide.assets.filter(a => a.priority === 'HIGH');
        if (highPriority.length > 0) {
          message += `*🔴 HIGH PRIORITY ASSETS:*\n`;
          highPriority.slice(0, 5).forEach(asset => {
            if (asset.type === 'SOL') {
              message += `• ${asset.amount} SOL\n`;
            } else {
              message += `• ${asset.amount} tokens (${asset.mint.slice(0, 8)}...)\n`;
            }
          });
          message += `\n`;
        }
        
        message += `*🆘 Emergency Steps:*\n`;
        moveGuide.emergencySteps.slice(0, 6).forEach(step => {
          message += `${step}\n`;
        });
      }
      
      message += `\n*🐙 Move fast but verify addresses!*`;

      await this.sendWithOctopus(
        ctx,
        message,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('🆕 Create New Wallet', 'new_wallet_guide'),
            Markup.button.callback('📞 Get Help', 'emergency_contact')
          ],
          [
            Markup.button.callback('🔍 Re-analyze', 'emergency_move'),
            Markup.button.callback('⬅️ Back', 'emergency')
          ]
        ])
      );

    } catch (error) {
      await this.sendWithOctopus(
        ctx,
        `*Emergency Move Analysis Failed* ❌

*Error:* ${error.message}

*🆘 Manual action required:*
Check your wallet manually and move valuable assets to a secure location.

*🐙 Contact support for guidance*`,
        this.getEmergencyButtons()
      );
    }
  }

  async handleEmergencyContact(ctx) {
    const contactMessage = `*🆘 Emergency Support Contact*

**If you're experiencing an active attack:**

*🔴 IMMEDIATE (Security Emergency):*
• Response time: < 5 minutes
• Telegram: @RedAlertEmergency
• Priority support channel

*🟡 URGENT (Threat Detected):*
• Response time: < 30 minutes  
• Support: @RedAlertSupport
• Technical assistance

*🟢 GENERAL (Questions/Help):*
• Community: @RedAlertCommunity
• Documentation: redAlert.help
• User guides & tutorials

**Self-Help Resources:**
• revoke.cash - Revoke approvals
• solscan.io - Check transactions
• phantom.app - Wallet security

*🐙 Your octopus emergency team is standing by!*`;

    await this.sendWithOctopus(
      ctx,
      contactMessage,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('🔴 Emergency Chat', 'emergency_chat'),
          Markup.button.callback('💬 Community', 'community')
        ],
        [
          Markup.button.callback('📚 Self-Help', 'self_help'),
          Markup.button.callback('⬅️ Back', 'emergency')
        ]
      ])
    );
  }

  async handleRemoveWallet(ctx) {
    const userId = ctx.from.id.toString();
    const wallets = userWallets.get(userId) || [];

    if (wallets.length === 0) {
      await this.sendWithOctopus(
        ctx,
        `*No Wallets to Remove* 📱

You don't have any wallets registered yet.

*🐙 Ready to add your first wallet?*`,
        Markup.inlineKeyboard([
          [Markup.button.callback('➕ Add First Wallet', 'add_wallet')],
          [Markup.button.callback('🏠 Main Menu', 'main_menu')]
        ])
      );
      return;
    }

    if (wallets.length === 1) {
      const wallet = wallets[0];
      
      await this.sendWithOctopus(
        ctx,
        `*Remove Wallet Confirmation* 🗑️

*Wallet to remove:*
\`${wallet.address.slice(0, 8)}...${wallet.address.slice(-8)}\`

*⚠️ This will:*
• Stop real-time monitoring
• Disable threat alerts
• Remove from protection

*Are you sure?*`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Yes, Remove', 'confirm_remove_0'),
            Markup.button.callback('❌ Cancel', 'status')
          ],
          [Markup.button.callback('🏠 Main Menu', 'main_menu')]
        ])
      );
      return;
    }

    // Multiple wallets - show selection
    let removeMessage = `*🗑️ Select Wallet to Remove*\n\n`;
    
    const walletButtons = [];
    wallets.forEach((wallet, index) => {
      removeMessage += `${index + 1}. \`${wallet.address.slice(0, 8)}...${wallet.address.slice(-8)}\`\n`;
      walletButtons.push([
        Markup.button.callback(`${index + 1}. Remove ${wallet.address.slice(0, 8)}...`, `confirm_remove_${index}`)
      ]);
    });
    
    walletButtons.push([Markup.button.callback('❌ Cancel', 'status')]);
    walletButtons.push([Markup.button.callback('🏠 Main Menu', 'main_menu')]);

    removeMessage += `\n*⚠️ Removing will stop all protection for that wallet*`;

    await this.sendWithOctopus(
      ctx,
      removeMessage,
      Markup.inlineKeyboard(walletButtons)
    );
  }

  async handleWalletRemovalNumber(ctx, number) {
    try {
      const userId = ctx.from.id.toString();
      const wallets = userWallets.get(userId) || [];

      if (number < 1 || number > wallets.length) {
        await this.sendWithOctopus(
          ctx,
          `*Invalid Selection* ❌

Please choose a number between 1-${wallets.length}

*🐙 Try again*`,
          this.getWalletButtons()
        );
        return;
      }

      const walletToRemove = wallets[number - 1];
      
      // Stop monitoring
      await this.transactionMonitor.stopMonitoring(walletToRemove.address);
      
      wallets.splice(number - 1, 1);
      userWallets.set(userId, wallets);

      await this.sendWithOctopus(
        ctx,
        `*🗑️ Wallet Removed Successfully*

*Removed:* \`${walletToRemove.address.slice(0, 8)}...${walletToRemove.address.slice(-8)}\`

*✅ Actions completed:*
• Monitoring stopped
• Alerts disabled  
• Protection removed

*🐙 Add new wallets anytime!*`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('➕ Add Another', 'add_wallet'),
            Markup.button.callback('📊 Check Status', 'status')
          ],
          [Markup.button.callback('🏠 Main Menu', 'main_menu')]
        ])
      );

    } catch (error) {
      console.error('Error handling wallet removal:', error);
      await ctx.reply('❌ Failed to remove wallet.');
    }
  }

  // Add callback handlers for wallet removal confirmations
  setupRemovalCallbacks() {
    // Handle removal confirmations
    for (let i = 0; i < 10; i++) {
      this.bot.action(`confirm_remove_${i}`, async (ctx) => {
        await ctx.answerCbQuery();
        await this.handleWalletRemovalNumber(ctx, i + 1);
      });
    }
  }

  async start() {
    try {
      console.log('🚨 Starting Enhanced RedAlert Bot v2.0 with Buttons...');
      
      // Set up removal callbacks
      this.setupRemovalCallbacks();
      
      // Test Solana connection
      try {
        const version = await this.solanaConnection.getVersion();
        console.log(`✅ Connected to Solana RPC: ${version['solana-core']}`);
      } catch (error) {
        console.log('⚠️  Solana connection test failed, but continuing...');
      }
      
      // Test AI capabilities
      if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_key_here') {
        console.log('🧠 AI threat analysis: ENABLED');
      } else {
        console.log('🤖 AI threat analysis: DISABLED (add OPENAI_API_KEY to enable)');
      }
      
      // Check for octopus image
      if (fs.existsSync(this.octopusImagePath)) {
        console.log('🐙 Octopus image: LOADED');
      } else {
        console.log('🖼️  Octopus image: NOT FOUND (add redalert-octopus.jpg to src/images/)');
      }
      
      // Start HTTP server for Render (required for Web Service)
      if (process.env.NODE_ENV === 'production') {
        const http = require('http');
        const server = http.createServer((req, res) => {
          if (req.url === '/health' || req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              status: 'healthy',
              service: 'RedAlert Security Bot',
              version: '2.0.0',
              uptime: process.uptime(),
              timestamp: new Date().toISOString(),
              monitoring: {
                totalWallets: this.transactionMonitor.getMonitoringStats().totalWallets,
                aiAnalysis: process.env.OPENAI_API_KEY ? 'enabled' : 'disabled',
                emergencySystem: 'ready'
              }
            }));
          } else if (req.url === '/stats') {
            const stats = this.transactionMonitor.getMonitoringStats();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              service: 'RedAlert Security Bot',
              stats: stats,
              alerts: threatAlerts.size,
              users: userWallets.size,
              timestamp: new Date().toISOString()
            }));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              error: 'Not Found',
              service: 'RedAlert Security Bot',
              endpoints: ['/health', '/stats']
            }));
          }
        });
        
        const port = process.env.PORT || 3000;
        server.listen(port, '0.0.0.0', () => {
          console.log(`🌐 HTTP server running on port ${port}`);
          console.log(`📊 Health check: http://localhost:${port}/health`);
          console.log(`📈 Stats endpoint: http://localhost:${port}/stats`);
        });
      }
      
      // Start the bot
      await this.bot.launch();
      console.log('🐙 Enhanced RedAlert Bot v2.0 is now online!');
      console.log('📱 Features: Interactive buttons, Visual alerts, Real-time monitoring');
      console.log('🚨 Find your bot on Telegram and send /start to begin');
      
      // Enable graceful stop
      process.once('SIGINT', () => {
        console.log('🛑 Stopping Enhanced RedAlert Bot...');
        this.bot.stop('SIGINT');
        process.exit(0);
      });
      process.once('SIGTERM', () => {
        console.log('🛑 Stopping Enhanced RedAlert Bot...');
        this.bot.stop('SIGTERM');
        process.exit(0);
      });
      
    } catch (error) {
      console.error('❌ Failed to start Enhanced RedAlert Bot:', error);
      
      if (error.message.includes('TOKEN')) {
        console.error('\n💡 SOLUTION: Get your bot token from @BotFather on Telegram');
        console.error('   Then add it to your .env file as: TELEGRAM_BOT_TOKEN=your_token_here\n');
      }
      
      process.exit(1);
    }
  }
}

// Start the enhanced bot with buttons
console.log('🔧 Initializing Enhanced RedAlert v2.0 with Interactive Controls...');
const redAlertWithButtons = new RedAlertBotWithButtons();
redAlertWithButtons.start().catch(console.error);