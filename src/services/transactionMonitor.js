// src/services/transactionMonitor.js
const { Connection, PublicKey } = require('@solana/web3.js');

class TransactionMonitor {
  constructor(rpcUrl) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.monitoredWallets = new Map(); // walletAddress -> { userId, subscriptionId, lastCheck }
    this.threatCallbacks = new Map(); // walletAddress -> callback function
    this.isMonitoring = false;
  }

  async startMonitoring(walletAddress, userId, threatCallback) {
    try {
      const publicKey = new PublicKey(walletAddress);
      
      // Store monitoring info
      this.monitoredWallets.set(walletAddress, {
        userId,
        publicKey,
        lastCheck: Date.now(),
        transactionCount: 0
      });
      
      this.threatCallbacks.set(walletAddress, threatCallback);

      // Subscribe to account changes
      const subscriptionId = this.connection.onAccountChange(
        publicKey,
        (accountInfo, context) => {
          this.handleAccountChange(walletAddress, accountInfo, context);
        },
        'confirmed'
      );

      // Subscribe to transaction logs
      const logsSubscriptionId = this.connection.onLogs(
        publicKey,
        (logs, context) => {
          this.handleTransactionLogs(walletAddress, logs, context);
        },
        'confirmed'
      );

      // Update monitoring info with subscription IDs
      const walletInfo = this.monitoredWallets.get(walletAddress);
      walletInfo.subscriptionId = subscriptionId;
      walletInfo.logsSubscriptionId = logsSubscriptionId;
      this.monitoredWallets.set(walletAddress, walletInfo);

      console.log(`🚨 Started monitoring wallet: ${walletAddress}`);
      
      // Start periodic health checks if not already running
      if (!this.isMonitoring) {
        this.startPeriodicChecks();
      }

      return true;
    } catch (error) {
      console.error(`Failed to start monitoring ${walletAddress}:`, error);
      return false;
    }
  }

  async stopMonitoring(walletAddress) {
    try {
      const walletInfo = this.monitoredWallets.get(walletAddress);
      
      if (walletInfo) {
        // Unsubscribe from account changes
        if (walletInfo.subscriptionId) {
          await this.connection.removeAccountChangeListener(walletInfo.subscriptionId);
        }
        
        // Unsubscribe from logs
        if (walletInfo.logsSubscriptionId) {
          await this.connection.removeOnLogsListener(walletInfo.logsSubscriptionId);
        }
        
        // Remove from monitoring
        this.monitoredWallets.delete(walletAddress);
        this.threatCallbacks.delete(walletAddress);
        
        console.log(`🛑 Stopped monitoring wallet: ${walletAddress}`);
      }
    } catch (error) {
      console.error(`Error stopping monitoring for ${walletAddress}:`, error);
    }
  }

  handleAccountChange(walletAddress, accountInfo, context) {
    console.log(`📊 Account change detected for ${walletAddress.slice(0, 8)}...`);
    
    const walletInfo = this.monitoredWallets.get(walletAddress);
    if (!walletInfo) return;

    // Analyze account changes for threats
    const threat = this.analyzeAccountChange(walletAddress, accountInfo, context);
    
    if (threat) {
      this.sendThreatAlert(walletAddress, threat);
    }
  }

  async handleTransactionLogs(walletAddress, logs, context) {
    console.log(`📝 Transaction logs for ${walletAddress.slice(0, 8)}...`);
    
    const walletInfo = this.monitoredWallets.get(walletAddress);
    if (!walletInfo) return;

    // Increment transaction count
    walletInfo.transactionCount++;
    walletInfo.lastActivity = Date.now();
    this.monitoredWallets.set(walletAddress, walletInfo);

    try {
      // Get full transaction details
      const signature = logs.signature;
      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      // Analyze transaction for threats
      const threat = await this.analyzeTransaction(walletAddress, transaction, logs);
      
      if (threat) {
        this.sendThreatAlert(walletAddress, threat);
      }

    } catch (error) {
      console.error(`Error analyzing transaction for ${walletAddress}:`, error);
    }
  }

  analyzeAccountChange(walletAddress, accountInfo, context) {
    // Basic account change analysis
    const threats = [];
    let riskScore = 0;

    // Check for suspicious account changes
    if (!accountInfo) {
      threats.push('Account closed or emptied');
      riskScore += 70;
    } else {
      // Check for unusual lamport changes
      if (accountInfo.lamports === 0) {
        threats.push('Account drained of SOL');
        riskScore += 80;
      }
    }

    if (riskScore > 50) {
      return {
        type: riskScore >= 70 ? 'CRITICAL' : 'WARNING',
        source: 'Account Change',
        riskScore,
        threats,
        timestamp: new Date(),
        context: context
      };
    }

    return null;
  }

  async analyzeTransaction(walletAddress, transaction, logs) {
    if (!transaction) return null;

    const threats = [];
    let riskScore = 0;

    try {
      // Analyze transaction logs for suspicious patterns
      const logMessages = logs.logs || [];
      
      // Check for common threat patterns
      logMessages.forEach(log => {
        const lowerLog = log.toLowerCase();
        
        // Token transfer patterns
        if (lowerLog.includes('transfer') && lowerLog.includes('authority')) {
          threats.push('Token authority transfer detected');
          riskScore += 60;
        }
        
        // Unknown program interactions
        if (lowerLog.includes('invoke') && !this.isKnownProgram(log)) {
          threats.push('Interaction with unknown program');
          riskScore += 30;
        }
        
        // Large transfer patterns
        if (lowerLog.includes('transfer') && this.detectLargeTransfer(log)) {
          threats.push('Large token transfer detected');
          riskScore += 40;
        }
        
        // Suspicious program calls
        if (this.detectSuspiciousProgram(log)) {
          threats.push('Interaction with flagged program');
          riskScore += 80;
        }
        
        // Token approval patterns
        if (lowerLog.includes('approve') || lowerLog.includes('allowance')) {
          threats.push('Token approval detected - potential drainer');
          riskScore += 50;
        }
      });

      // Analyze transaction structure
      if (transaction.meta) {
        // Check for failed transactions
        if (transaction.meta.err) {
          threats.push('Transaction failed - possible attack attempt');
          riskScore += 20;
        }

        // Check for multiple account interactions
        const accountKeys = transaction.transaction?.message?.accountKeys || [];
        if (accountKeys.length > 10) {
          threats.push('High number of account interactions');
          riskScore += 25;
        }

        // Check for balance changes
        const postBalances = transaction.meta.postBalances || [];
        const preBalances = transaction.meta.preBalances || [];
        
        for (let i = 0; i < postBalances.length; i++) {
          const change = postBalances[i] - (preBalances[i] || 0);
          if (change < -1000000) { // More than 0.001 SOL decrease
            threats.push('Significant SOL balance decrease');
            riskScore += 30;
          }
        }
      }

      // Check transaction frequency
      const walletInfo = this.monitoredWallets.get(walletAddress);
      if (walletInfo && walletInfo.transactionCount > 5) {
        const timePeriod = (Date.now() - walletInfo.lastCheck) / 1000 / 60; // minutes
        const txPerMinute = walletInfo.transactionCount / timePeriod;
        
        if (txPerMinute > 2) {
          threats.push('High transaction frequency detected');
          riskScore += 35;
        }
      }

    } catch (error) {
      console.error('Error in transaction analysis:', error);
      threats.push('Analysis error occurred');
      riskScore += 10;
    }

    if (riskScore > 40) {
      return {
        type: riskScore >= 70 ? 'CRITICAL' : 'WARNING',
        source: 'Transaction Analysis',
        riskScore,
        threats,
        timestamp: new Date(),
        signature: logs.signature,
        transaction: transaction
      };
    }

    return null;
  }

  isKnownProgram(log) {
    const knownPrograms = [
      'system program',
      'token program',
      'associated token',
      'spl-token',
      'jupiter',
      'raydium',
      'serum',
      'orca'
    ];
    
    const lowerLog = log.toLowerCase();
    return knownPrograms.some(program => lowerLog.includes(program));
  }

  detectLargeTransfer(log) {
    // Simple heuristic for large transfers
    const matches = log.match(/transfer.*?(\d+)/i);
    if (matches && matches[1]) {
      const amount = parseInt(matches[1]);
      return amount > 1000000; // Arbitrary threshold
    }
    return false;
  }

  detectSuspiciousProgram(log) {
    const suspiciousPatterns = [
      'drainer',
      'stealer',
      'malicious',
      'phishing',
      'unknown_program'
    ];
    
    const lowerLog = log.toLowerCase();
    return suspiciousPatterns.some(pattern => lowerLog.includes(pattern));
  }

  sendThreatAlert(walletAddress, threat) {
    const callback = this.threatCallbacks.get(walletAddress);
    if (callback) {
      callback(walletAddress, threat);
    }
  }

  startPeriodicChecks() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Run health checks every 30 seconds
    setInterval(() => {
      this.performPeriodicChecks();
    }, 30000);
    
    console.log('🔄 Started periodic monitoring checks');
  }

  async performPeriodicChecks() {
    for (const [walletAddress, walletInfo] of this.monitoredWallets) {
      try {
        // Reset transaction count periodically
        const timeSinceLastCheck = Date.now() - walletInfo.lastCheck;
        if (timeSinceLastCheck > 300000) { // 5 minutes
          walletInfo.transactionCount = 0;
          walletInfo.lastCheck = Date.now();
          this.monitoredWallets.set(walletAddress, walletInfo);
        }
        
        // Perform health check
        await this.performHealthCheck(walletAddress);
        
      } catch (error) {
        console.error(`Periodic check failed for ${walletAddress}:`, error);
      }
    }
  }

  async performHealthCheck(walletAddress) {
    try {
      const walletInfo = this.monitoredWallets.get(walletAddress);
      if (!walletInfo) return;

      const accountInfo = await this.connection.getAccountInfo(walletInfo.publicKey);
      
      // Check for account existence
      if (!accountInfo && walletInfo.hadAccount) {
        const threat = {
          type: 'CRITICAL',
          source: 'Health Check',
          riskScore: 90,
          threats: ['Account no longer exists - possible drain'],
          timestamp: new Date()
        };
        
        this.sendThreatAlert(walletAddress, threat);
      }
      
      // Update account status
      walletInfo.hadAccount = !!accountInfo;
      this.monitoredWallets.set(walletAddress, walletInfo);
      
    } catch (error) {
      console.error(`Health check failed for ${walletAddress}:`, error);
    }
  }

  getMonitoringStats() {
    return {
      totalWallets: this.monitoredWallets.size,
      wallets: Array.from(this.monitoredWallets.entries()).map(([address, info]) => ({
        address: address.slice(0, 8) + '...',
        userId: info.userId,
        transactionCount: info.transactionCount,
        lastActivity: info.lastActivity ? new Date(info.lastActivity).toLocaleString() : 'None'
      }))
    };
  }
}

module.exports = TransactionMonitor;