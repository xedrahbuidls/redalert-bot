// src/services/emergencyActions.js
const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require('@solana/spl-token');

class EmergencyActions {
  constructor(rpcUrl) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.emergencyContacts = new Map(); // userId -> contact info
    this.emergencyHistory = new Map(); // walletAddress -> actions taken
  }

  // Emergency action: Analyze wallet for immediate threats
  async performEmergencyAnalysis(walletAddress) {
    try {
      const publicKey = new PublicKey(walletAddress);
      const analysis = {
        timestamp: new Date(),
        walletAddress,
        status: 'ANALYZING',
        findings: [],
        recommendations: []
      };

      console.log(`🚨 Emergency analysis started for ${walletAddress}`);

      // 1. Check account status
      const accountInfo = await this.connection.getAccountInfo(publicKey);
      if (!accountInfo) {
        analysis.findings.push({
          severity: 'CRITICAL',
          issue: 'Account not found or empty',
          description: 'Wallet may have been drained'
        });
      } else {
        analysis.findings.push({
          severity: 'INFO',
          issue: 'Account active',
          description: `Account has ${accountInfo.lamports} lamports`
        });
      }

      // 2. Check recent transactions
      const signatures = await this.connection.getSignaturesForAddress(publicKey, { limit: 20 });
      
      if (signatures.length > 10) {
        analysis.findings.push({
          severity: 'HIGH',
          issue: 'High transaction volume',
          description: `${signatures.length} transactions in recent history`
        });
        analysis.recommendations.push('Monitor all recent transactions carefully');
      }

      // 3. Check for recent failed transactions (potential attack attempts)
      const failedTxs = signatures.filter(sig => sig.err !== null);
      if (failedTxs.length > 0) {
        analysis.findings.push({
          severity: 'WARNING',
          issue: 'Failed transactions detected',
          description: `${failedTxs.length} failed transactions found`
        });
        analysis.recommendations.push('Review failed transactions for attack attempts');
      }

      // 4. Analyze token accounts
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID
      });

      for (const tokenAccount of tokenAccounts.value) {
        const tokenInfo = tokenAccount.account.data.parsed.info;
        
        // Check for unusual token approvals
        if (tokenInfo.delegatedAmount && parseFloat(tokenInfo.delegatedAmount) > 0) {
          analysis.findings.push({
            severity: 'CRITICAL',
            issue: 'Active token delegation found',
            description: `Token ${tokenInfo.mint} has ${tokenInfo.delegatedAmount} tokens approved to ${tokenInfo.delegate}`,
            mint: tokenInfo.mint,
            delegate: tokenInfo.delegate,
            amount: tokenInfo.delegatedAmount
          });
          analysis.recommendations.push(`URGENT: Revoke approval for token ${tokenInfo.mint.slice(0, 8)}...`);
        }

        // Check for zero balance tokens (potential drains)
        if (parseFloat(tokenInfo.tokenAmount.amount) === 0 && tokenInfo.tokenAmount.decimals > 0) {
          analysis.findings.push({
            severity: 'WARNING',
            issue: 'Empty token account',
            description: `Token account for ${tokenInfo.mint} is empty`,
            mint: tokenInfo.mint
          });
        }
      }

      // 5. Generate emergency action plan
      analysis.emergencyActions = this.generateEmergencyActionPlan(analysis.findings);
      analysis.status = 'COMPLETE';

      // Store analysis in history
      this.emergencyHistory.set(walletAddress, analysis);

      console.log(`✅ Emergency analysis complete for ${walletAddress}`);
      return analysis;

    } catch (error) {
      console.error(`Emergency analysis failed for ${walletAddress}:`, error);
      return {
        timestamp: new Date(),
        walletAddress,
        status: 'ERROR',
        error: error.message,
        findings: [],
        recommendations: ['Contact support immediately']
      };
    }
  }

  generateEmergencyActionPlan(findings) {
    const actions = [];
    
    // Categorize findings by severity
    const critical = findings.filter(f => f.severity === 'CRITICAL');
    const high = findings.filter(f => f.severity === 'HIGH');
    const warnings = findings.filter(f => f.severity === 'WARNING');

    if (critical.length > 0) {
      actions.push({
        priority: 1,
        action: 'IMMEDIATE_REVOKE',
        title: 'Revoke All Token Approvals',
        description: 'Immediately revoke all token approvals to stop potential draining',
        command: '/emergency revoke',
        estimated_time: '2-5 minutes',
        risk: 'Prevents further token theft'
      });

      actions.push({
        priority: 2,
        action: 'MOVE_CRITICAL_ASSETS',
        title: 'Move High-Value Assets',
        description: 'Transfer valuable tokens and SOL to a secure wallet',
        command: '/emergency move',
        estimated_time: '5-10 minutes',
        risk: 'Saves remaining funds'
      });
    }

    if (high.length > 0 || critical.length > 0) {
      actions.push({
        priority: 3,
        action: 'PAUSE_ALL_ACTIVITY',
        title: 'Stop All DeFi Interactions',
        description: 'Avoid any new transactions until threats are resolved',
        command: '/emergency pause',
        estimated_time: 'Immediate',
        risk: 'Prevents additional exposure'
      });
    }

    actions.push({
      priority: 4,
      action: 'CONTACT_SUPPORT',
      title: 'Contact Security Support',
      description: 'Get expert help to assess and resolve the situation',
      command: '/emergency contact',
      estimated_time: '1-2 minutes',
      risk: 'Expert guidance available'
    });

    return actions;
  }

  async generateRevokeInstructions(walletAddress) {
    try {
      const publicKey = new PublicKey(walletAddress);
      const instructions = [];

      // Get all token accounts with approvals
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID
      });

      for (const tokenAccount of tokenAccounts.value) {
        const tokenInfo = tokenAccount.account.data.parsed.info;
        
        if (tokenInfo.delegatedAmount && parseFloat(tokenInfo.delegatedAmount) > 0) {
          instructions.push({
            type: 'REVOKE_APPROVAL',
            tokenMint: tokenInfo.mint,
            tokenAccount: tokenAccount.pubkey.toString(),
            delegate: tokenInfo.delegate,
            amount: tokenInfo.delegatedAmount,
            instructions: `Revoke approval for ${tokenInfo.mint.slice(0, 8)}... (${tokenInfo.delegatedAmount} tokens)`
          });
        }
      }

      // Generate step-by-step revoke guide
      const guide = {
        walletAddress,
        timestamp: new Date(),
        totalApprovals: instructions.length,
        instructions: instructions,
        manualSteps: this.generateManualRevokeSteps(instructions),
        automatedOption: instructions.length > 0 ? this.generateRevokeTransaction(walletAddress, instructions) : null
      };

      return guide;

    } catch (error) {
      console.error('Error generating revoke instructions:', error);
      return {
        error: 'Failed to generate revoke instructions',
        message: 'Please use a manual revoke tool like revoke.cash'
      };
    }
  }

  generateManualRevokeSteps(instructions) {
    const steps = [
      '🔗 Go to revoke.cash or similar revoke tool',
      '🔌 Connect your wallet',
      '🔍 Review all active approvals',
      '❌ Revoke ALL approvals (especially these critical ones):'
    ];

    instructions.forEach((inst, index) => {
      steps.push(`   ${index + 1}. ${inst.tokenMint.slice(0, 8)}... (${inst.amount} tokens)`);
    });

    steps.push('✅ Confirm all revoke transactions');
    steps.push('🔄 Refresh and verify no approvals remain');

    return steps;
  }

  async generateRevokeTransaction(walletAddress, instructions) {
    // This would generate actual revoke transactions
    // For MVP, we'll return instructions for manual revocation
    return {
      method: 'MANUAL_RECOMMENDED',
      reason: 'Manual revocation via trusted tools is safer',
      recommendedTools: [
        'https://revoke.cash',
        'https://app.phantom.app/revoke',
        'Wallet built-in revoke features'
      ],
      warning: 'Never sign transactions from untrusted sources'
    };
  }

  async generateMoveAssetsInstructions(walletAddress) {
    try {
      const publicKey = new PublicKey(walletAddress);
      const assets = [];

      // Get SOL balance
      const solBalance = await this.connection.getBalance(publicKey);
      if (solBalance > 0) {
        assets.push({
          type: 'SOL',
          amount: (solBalance / 1e9).toFixed(4),
          priority: 'HIGH',
          instructions: 'Transfer SOL to secure wallet'
        });
      }

      // Get token balances
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID
      });

      for (const tokenAccount of tokenAccounts.value) {
        const tokenInfo = tokenAccount.account.data.parsed.info;
        const balance = parseFloat(tokenInfo.tokenAmount.uiAmount || 0);
        
        if (balance > 0) {
          assets.push({
            type: 'TOKEN',
            mint: tokenInfo.mint,
            amount: balance.toString(),
            decimals: tokenInfo.tokenAmount.decimals,
            priority: balance > 1000 ? 'HIGH' : 'MEDIUM',
            instructions: `Transfer ${balance} tokens of ${tokenInfo.mint.slice(0, 8)}...`
          });
        }
      }

      return {
        walletAddress,
        timestamp: new Date(),
        totalAssets: assets.length,
        assets: assets.sort((a, b) => (a.priority === 'HIGH' ? -1 : 1)),
        emergencySteps: this.generateMoveAssetsSteps(assets),
        securityTips: [
          '🔐 Use a completely new wallet for emergency transfers',
          '🔍 Verify recipient addresses carefully',
          '⚡ Move high-value assets first',
          '🚫 Don\'t use the same device if compromised'
        ]
      };

    } catch (error) {
      console.error('Error generating move instructions:', error);
      return {
        error: 'Failed to analyze assets',
        message: 'Manually check your wallet and move valuable assets'
      };
    }
  }

  generateMoveAssetsSteps(assets) {
    const steps = [
      '🆕 Create a new secure wallet (different device if possible)',
      '📝 Write down the new wallet address',
      '⚡ Start with highest priority assets:'
    ];

    const highPriority = assets.filter(a => a.priority === 'HIGH');
    highPriority.forEach((asset, index) => {
      if (asset.type === 'SOL') {
        steps.push(`   ${index + 1}. Transfer ${asset.amount} SOL (leave ~0.01 for fees)`);
      } else {
        steps.push(`   ${index + 1}. Transfer ${asset.amount} of ${asset.mint.slice(0, 8)}...`);
      }
    });

    steps.push('🔍 Verify transfers completed successfully');
    steps.push('🔄 Move remaining assets if needed');

    return steps;
  }

  setEmergencyContact(userId, contactInfo) {
    this.emergencyContacts.set(userId, {
      ...contactInfo,
      addedAt: new Date()
    });
  }

  async triggerEmergencyAlert(userId, walletAddress, threat) {
    const contact = this.emergencyContacts.get(userId);
    
    // Log emergency event
    console.log(`🚨 EMERGENCY ALERT for user ${userId}, wallet ${walletAddress}`);
    
    const alertData = {
      timestamp: new Date(),
      userId,
      walletAddress,
      threat,
      contact: contact || null,
      status: 'TRIGGERED'
    };

    // In a full implementation, this would:
    // - Send emails/SMS to emergency contacts
    // - Alert security team
    // - Create support tickets
    // - Log to security monitoring systems

    return alertData;
  }

  formatEmergencyResponse(analysis) {
    const criticalCount = analysis.findings.filter(f => f.severity === 'CRITICAL').length;
    const highCount = analysis.findings.filter(f => f.severity === 'HIGH').length;
    
    let message = `🚨 **EMERGENCY ANALYSIS COMPLETE** 🚨\n\n`;
    message += `🐙 **Wallet**: \`${analysis.walletAddress.slice(0, 8)}...${analysis.walletAddress.slice(-8)}\`\n`;
    message += `⏰ **Time**: ${analysis.timestamp.toLocaleTimeString()}\n\n`;
    
    if (criticalCount > 0) {
      message += `🔴 **CRITICAL ISSUES**: ${criticalCount}\n`;
    }
    if (highCount > 0) {
      message += `🟡 **HIGH RISK**: ${highCount}\n`;
    }
    
    message += `\n📋 **Key Findings**:\n`;
    analysis.findings.slice(0, 5).forEach(finding => {
      const emoji = finding.severity === 'CRITICAL' ? '🔴' : 
                   finding.severity === 'HIGH' ? '🟡' : '🟢';
      message += `${emoji} ${finding.issue}: ${finding.description}\n`;
    });
    
    if (analysis.emergencyActions && analysis.emergencyActions.length > 0) {
      message += `\n🆘 **IMMEDIATE ACTIONS**:\n`;
      analysis.emergencyActions.slice(0, 3).forEach((action, index) => {
        message += `${index + 1}. **${action.title}**\n`;
        message += `   ${action.description}\n`;
        message += `   Command: \`${action.command}\`\n\n`;
      });
    }
    
    message += `\n🔗 **Emergency Commands**:\n`;
    message += `\`/emergency revoke\` - Get revoke instructions\n`;
    message += `\`/emergency move\` - Get asset move guide\n`;
    message += `\`/emergency contact\` - Contact support\n\n`;
    
    message += `🐙 **Your octopus is here to help! Act quickly but carefully.**`;
    
    return message;
  }

  getEmergencyHistory(walletAddress) {
    return this.emergencyHistory.get(walletAddress) || null;
  }
}

module.exports = EmergencyActions;