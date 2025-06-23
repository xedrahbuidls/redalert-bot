// src/services/threatAnalyzer.js
const axios = require('axios');

class ThreatAnalyzer {
  constructor(openaiApiKey) {
    this.openaiApiKey = openaiApiKey;
    this.threatDatabase = new Map(); // Store known threats
    this.walletProfiles = new Map(); // Store wallet behavior profiles
    this.initializeThreatDatabase();
  }

  initializeThreatDatabase() {
    // Initialize with known threat patterns
    this.threatDatabase.set('token_drainer', {
      patterns: ['approve', 'transfer_all', 'authority_change'],
      riskLevel: 'CRITICAL',
      description: 'Token drainer contract detected'
    });
    
    this.threatDatabase.set('phishing_site', {
      patterns: ['multiple_approvals', 'unknown_program', 'urgent_transfer'],
      riskLevel: 'HIGH',
      description: 'Phishing attack pattern'
    });
    
    this.threatDatabase.set('rug_pull', {
      patterns: ['liquidity_removal', 'massive_sell', 'dev_dump'],
      riskLevel: 'CRITICAL',
      description: 'Rug pull activity detected'
    });
    
    console.log('🧠 AI Threat Database initialized');
  }

  async analyzeTransactionWithAI(walletAddress, transaction, logs, basicThreat) {
    try {
      // Build wallet behavior profile
      this.updateWalletProfile(walletAddress, transaction, logs);
      
      // Get AI analysis if we have OpenAI key
      let aiAnalysis = null;
      if (this.openaiApiKey && this.openaiApiKey !== 'your_openai_key_here') {
        aiAnalysis = await this.getAIAnalysis(transaction, logs, basicThreat);
      }
      
      // Combine basic analysis with AI insights
      const enhancedThreat = this.combineAnalysis(basicThreat, aiAnalysis, walletAddress);
      
      return enhancedThreat;
      
    } catch (error) {
      console.error('AI analysis error:', error);
      return basicThreat; // Return basic analysis if AI fails
    }
  }

  updateWalletProfile(walletAddress, transaction, logs) {
    const profile = this.walletProfiles.get(walletAddress) || {
      firstSeen: Date.now(),
      totalTransactions: 0,
      patterns: new Set(),
      riskScore: 0,
      lastActivity: Date.now()
    };

    profile.totalTransactions++;
    profile.lastActivity = Date.now();

    // Extract patterns from transaction
    if (logs && logs.logs) {
      logs.logs.forEach(log => {
        const lowerLog = log.toLowerCase();
        
        if (lowerLog.includes('transfer')) profile.patterns.add('transfer');
        if (lowerLog.includes('approve')) profile.patterns.add('approve');
        if (lowerLog.includes('authority')) profile.patterns.add('authority_change');
        if (lowerLog.includes('invoke')) profile.patterns.add('program_invoke');
      });
    }

    this.walletProfiles.set(walletAddress, profile);
  }

  async getAIAnalysis(transaction, logs, basicThreat) {
    try {
      // Prepare data for AI analysis
      const analysisPrompt = this.buildAnalysisPrompt(transaction, logs, basicThreat);
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are an expert Solana blockchain security analyst. Analyze transactions for threats like:
              - Token drainers and phishing attacks
              - Rug pulls and exit scams  
              - Malicious contract interactions
              - Unusual transfer patterns
              
              Respond with JSON containing:
              {
                "threatLevel": "CRITICAL|HIGH|MEDIUM|LOW",
                "confidence": 0-100,
                "threats": ["threat1", "threat2"],
                "recommendation": "action to take",
                "explanation": "brief explanation"
              }`
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          max_tokens: 500,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      return this.parseAIResponse(aiResponse);
      
    } catch (error) {
      console.error('OpenAI API error:', error.message);
      return null;
    }
  }

  buildAnalysisPrompt(transaction, logs, basicThreat) {
    let prompt = `Analyze this Solana transaction for security threats:\n\n`;
    
    // Add basic threat info
    if (basicThreat) {
      prompt += `Initial Analysis:\n`;
      prompt += `- Risk Score: ${basicThreat.riskScore}/100\n`;
      prompt += `- Threats: ${basicThreat.threats.join(', ')}\n\n`;
    }
    
    // Add transaction logs
    if (logs && logs.logs) {
      prompt += `Transaction Logs:\n`;
      logs.logs.slice(0, 10).forEach((log, index) => {
        prompt += `${index + 1}. ${log}\n`;
      });
      prompt += `\n`;
    }
    
    // Add transaction metadata
    if (transaction && transaction.meta) {
      prompt += `Transaction Metadata:\n`;
      prompt += `- Status: ${transaction.meta.err ? 'Failed' : 'Success'}\n`;
      prompt += `- Fee: ${transaction.meta.fee} lamports\n`;
      
      if (transaction.meta.preBalances && transaction.meta.postBalances) {
        const balanceChanges = transaction.meta.postBalances.map((post, i) => {
          const pre = transaction.meta.preBalances[i] || 0;
          return post - pre;
        });
        prompt += `- Balance Changes: ${balanceChanges.join(', ')} lamports\n`;
      }
    }
    
    prompt += `\nProvide your security assessment:`;
    
    return prompt;
  }

  parseAIResponse(aiResponse) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback parsing if no valid JSON
      return {
        threatLevel: 'MEDIUM',
        confidence: 50,
        threats: ['AI analysis incomplete'],
        recommendation: 'Monitor closely',
        explanation: 'AI response could not be parsed'
      };
      
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return null;
    }
  }

  combineAnalysis(basicThreat, aiAnalysis, walletAddress) {
    if (!basicThreat) return null;
    
    const enhancedThreat = { ...basicThreat };
    
    // Add wallet profile context
    const profile = this.walletProfiles.get(walletAddress);
    if (profile) {
      enhancedThreat.walletProfile = {
        totalTransactions: profile.totalTransactions,
        accountAge: Math.floor((Date.now() - profile.firstSeen) / (1000 * 60 * 60 * 24)), // days
        patterns: Array.from(profile.patterns)
      };
    }
    
    // Enhance with AI analysis
    if (aiAnalysis) {
      enhancedThreat.aiAnalysis = aiAnalysis;
      
      // Adjust risk score based on AI confidence
      if (aiAnalysis.confidence > 80) {
        if (aiAnalysis.threatLevel === 'CRITICAL') {
          enhancedThreat.riskScore = Math.max(enhancedThreat.riskScore, 90);
        } else if (aiAnalysis.threatLevel === 'HIGH') {
          enhancedThreat.riskScore = Math.max(enhancedThreat.riskScore, 75);
        }
      }
      
      // Combine threat lists
      if (aiAnalysis.threats) {
        enhancedThreat.threats = [...new Set([...enhancedThreat.threats, ...aiAnalysis.threats])];
      }
      
      // Add AI recommendation
      enhancedThreat.recommendation = aiAnalysis.recommendation;
      enhancedThreat.aiExplanation = aiAnalysis.explanation;
    }
    
    // Pattern matching against threat database
    const knownThreats = this.matchKnownThreats(enhancedThreat);
    if (knownThreats.length > 0) {
      enhancedThreat.knownThreats = knownThreats;
      enhancedThreat.riskScore = Math.max(enhancedThreat.riskScore, 80);
    }
    
    return enhancedThreat;
  }

  matchKnownThreats(threat) {
    const matches = [];
    
    for (const [threatType, threatInfo] of this.threatDatabase) {
      const patternMatches = threatInfo.patterns.filter(pattern => {
        return threat.threats.some(t => t.toLowerCase().includes(pattern.toLowerCase()));
      });
      
      if (patternMatches.length >= 2) {
        matches.push({
          type: threatType,
          description: threatInfo.description,
          riskLevel: threatInfo.riskLevel,
          matchedPatterns: patternMatches
        });
      }
    }
    
    return matches;
  }

  generateEmergencyActions(threat) {
    const actions = [];
    
    if (threat.riskScore >= 80) {
      actions.push({
        priority: 'IMMEDIATE',
        action: 'REVOKE_APPROVALS',
        description: 'Revoke all token approvals immediately',
        command: '/emergency revoke'
      });
      
      actions.push({
        priority: 'IMMEDIATE', 
        action: 'MOVE_FUNDS',
        description: 'Move funds to a secure wallet',
        command: '/emergency move'
      });
    }
    
    if (threat.riskScore >= 60) {
      actions.push({
        priority: 'HIGH',
        action: 'PAUSE_ACTIVITY',
        description: 'Stop all DeFi interactions',
        command: '/emergency pause'
      });
    }
    
    actions.push({
      priority: 'MEDIUM',
      action: 'MONITOR_CLOSELY',
      description: 'Increase monitoring sensitivity',
      command: '/settings monitor-high'
    });
    
    return actions;
  }

  formatThreatAlert(walletAddress, threat) {
    const urgencyEmoji = threat.riskScore >= 80 ? '🚨🚨🚨' : threat.riskScore >= 60 ? '⚠️⚠️' : '👀';
    const urgencyLevel = threat.riskScore >= 80 ? 'CRITICAL THREAT' : threat.riskScore >= 60 ? 'HIGH RISK' : 'SUSPICIOUS ACTIVITY';
    
    let message = `${urgencyEmoji} **${urgencyLevel} DETECTED** ${urgencyEmoji}\n\n`;
    
    message += `🐙 **Wallet**: \`${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}\`\n`;
    message += `📊 **Risk Score**: ${threat.riskScore}/100\n`;
    message += `⏰ **Time**: ${threat.timestamp.toLocaleTimeString()}\n\n`;
    
    // Add threats
    message += `⚡ **Detected Threats**:\n`;
    threat.threats.forEach(t => {
      message += `• ${t}\n`;
    });
    message += `\n`;
    
    // Add AI analysis if available
    if (threat.aiAnalysis) {
      message += `🧠 **AI Analysis** (${threat.aiAnalysis.confidence}% confidence):\n`;
      message += `${threat.aiAnalysis.explanation}\n\n`;
    }
    
    // Add emergency actions
    const emergencyActions = this.generateEmergencyActions(threat);
    if (emergencyActions.length > 0) {
      message += `🆘 **Recommended Actions**:\n`;
      emergencyActions.slice(0, 3).forEach(action => {
        message += `${action.priority === 'IMMEDIATE' ? '🔴' : action.priority === 'HIGH' ? '🟡' : '🟢'} ${action.description}\n`;
      });
      message += `\n`;
    }
    
    // Add transaction link if available
    if (threat.signature) {
      message += `🔗 **Transaction**: \`${threat.signature}\`\n\n`;
    }
    
    message += `🐙 **Your octopus guardian is protecting you!**`;
    
    return message;
  }

  getWalletRiskProfile(walletAddress) {
    const profile = this.walletProfiles.get(walletAddress);
    if (!profile) return null;
    
    return {
      totalTransactions: profile.totalTransactions,
      accountAge: Math.floor((Date.now() - profile.firstSeen) / (1000 * 60 * 60 * 24)),
      patterns: Array.from(profile.patterns),
      riskScore: profile.riskScore,
      lastActivity: new Date(profile.lastActivity).toLocaleString()
    };
  }
}

module.exports = ThreatAnalyzer;