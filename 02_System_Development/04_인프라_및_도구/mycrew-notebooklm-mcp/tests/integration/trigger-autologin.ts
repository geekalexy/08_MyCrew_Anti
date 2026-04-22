/**
 * Trigger Auto-Login Script
 *
 * This script triggers the auto-login flow using stored credentials.
 * Run with: npx tsx tests/integration/trigger-autologin.ts
 */

import { AccountManager } from '../../src/accounts/account-manager.js';
import { AutoLoginManager } from '../../src/accounts/auto-login-manager.js';
import { log } from '../../src/utils/logger.js';

async function main() {
  log.info('🔐 Triggering auto-login...');

  const accountManager = new AccountManager();
  await accountManager.initialize();

  const autoLoginManager = new AutoLoginManager(accountManager);

  // Get the accounts
  const accounts = accountManager.listAccounts();
  log.info(`📋 Found ${accounts.length} account(s)`);

  if (accounts.length === 0) {
    log.error('❌ No accounts configured');
    process.exit(1);
  }

  const account = accounts[0];
  log.info(`👤 Using account: ${account.config.email}`);
  log.info(`   ID: ${account.config.id}`);
  log.info(`   Has credentials: ${account.config.hasCredentials}`);
  log.info(`   Enabled: ${account.config.enabled}`);

  // Perform auto-login
  log.info('🚀 Starting auto-login (headless mode)...');

  try {
    const result = await autoLoginManager.performAutoLogin(account.config.id, {
      showBrowser: true, // visible browser - Google blocks headless
      timeout: 120000, // 2 minutes
    });

    if (result.success) {
      log.success('✅ Auto-login successful!');
      log.info(`   Duration: ${result.duration}ms`);
    } else {
      log.error(`❌ Auto-login failed: ${result.error}`);
      if (result.requiresManualIntervention) {
        log.warning('   Manual intervention required');
      }
    }
  } catch (error) {
    log.error(`❌ Error: ${error}`);
    process.exit(1);
  }
}

main().catch(console.error);
