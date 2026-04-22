#!/usr/bin/env node
/**
 * Account Management CLI
 *
 * Commands for managing NotebookLM accounts:
 * - add: Add a new account with credentials
 * - list: List all accounts
 * - remove: Remove an account
 * - test: Test auto-login for an account
 * - health: Check health of all accounts
 */

import { getAccountManager, AutoLoginManager, maskEmail } from '../accounts/index.js';
import { log } from '../utils/logger.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return;
  }

  try {
    switch (command) {
      case 'add':
        await addAccount(args.slice(1));
        break;

      case 'list':
        await listAccounts();
        break;

      case 'remove':
        await removeAccount(args[1]);
        break;

      case 'test':
        await testLogin(args[1], args.includes('--show'));
        break;

      case 'health':
        await checkHealth();
        break;

      case 'strategy':
        await setStrategy(args[1]);
        break;

      default:
        log.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    log.error(`Command failed: ${error}`);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
NotebookLM Account Manager

Usage: npx ts-node src/cli/accounts.ts <command> [options]

Commands:
  add <email> <password> [totp]  Add a new account
  list                           List all accounts
  remove <account-id>            Remove an account
  test <account-id> [--show]     Test auto-login for an account
  health                         Check health of all accounts
  strategy <strategy>            Set rotation strategy (least_used|round_robin|failover|random)

Examples:
  # Add account without 2FA
  npx ts-node src/cli/accounts.ts add user@gmail.com "password123"

  # Add account with TOTP secret
  npx ts-node src/cli/accounts.ts add user@gmail.com "password123" "JBSWY3DPEHPK3PXP"

  # Test login with visible browser
  npx ts-node src/cli/accounts.ts test account-123 --show

  # Check health
  npx ts-node src/cli/accounts.ts health
`);
}

async function addAccount(args: string[]) {
  if (args.length < 2) {
    log.error('Usage: add <email> <password> [totp-secret]');
    process.exit(1);
  }

  const [email, password, totpSecret] = args;

  log.info(`Adding account: ${maskEmail(email)}`);

  const manager = await getAccountManager();
  const accountId = await manager.addAccount(email, password, totpSecret);

  log.success(`Account added: ${accountId}`);
  log.info('You can test the login with: test ' + accountId);
}

async function listAccounts() {
  const manager = await getAccountManager();
  const accounts = manager.listAccounts();

  if (accounts.length === 0) {
    log.info('No accounts configured.');
    log.info('Add an account with: add <email> <password>');
    return;
  }

  console.log('\nConfigured Accounts:\n');
  console.log('ID                  | Email                | Status   | Quota    | Priority');
  console.log('-'.repeat(85));

  for (const account of accounts) {
    const email = maskEmail(account.config.email).padEnd(20);
    const status = account.state.sessionStatus.padEnd(8);
    const quota = `${account.quota.used}/${account.quota.limit}`.padEnd(8);
    const priority = account.config.priority.toString();
    const enabled = account.config.enabled ? '' : ' (disabled)';

    console.log(
      `${account.config.id.padEnd(19)} | ${email} | ${status} | ${quota} | ${priority}${enabled}`
    );
  }

  console.log('\nStrategy:', manager.getRotationStrategy());
  console.log('Auto-login:', manager.isAutoLoginEnabled() ? 'enabled' : 'disabled');
}

async function removeAccount(accountId: string) {
  if (!accountId) {
    log.error('Usage: remove <account-id>');
    process.exit(1);
  }

  const manager = await getAccountManager();
  const success = await manager.removeAccount(accountId);

  if (success) {
    log.success('Account removed');
  } else {
    log.error('Failed to remove account');
    process.exit(1);
  }
}

async function testLogin(accountId: string, showBrowser: boolean) {
  if (!accountId) {
    log.error('Usage: test <account-id> [--show]');
    process.exit(1);
  }

  const manager = await getAccountManager();
  const account = manager.getAccount(accountId);

  if (!account) {
    log.error(`Account not found: ${accountId}`);
    process.exit(1);
  }

  log.info(`Testing login for: ${maskEmail(account.config.email)}`);
  if (showBrowser) {
    log.info('Browser will be visible for debugging');
  }

  const autoLogin = new AutoLoginManager(manager);
  const result = await autoLogin.performAutoLogin(accountId, { showBrowser });

  if (result.success) {
    log.success(`Login successful! (${result.duration}ms)`);
  } else {
    log.error(`Login failed: ${result.error}`);
    if (result.requiresManualIntervention) {
      log.warning('This account requires manual intervention (2FA, verification, etc.)');
    }
    process.exit(1);
  }
}

async function checkHealth() {
  const manager = await getAccountManager();
  const health = await manager.healthCheck();

  if (health.length === 0) {
    log.info('No accounts configured.');
    return;
  }

  console.log('\nAccount Health:\n');

  for (const h of health) {
    const status = h.sessionValid ? '✅' : '❌';
    const email = maskEmail(h.email);
    const quota = `${h.quotaRemaining}/${h.quotaPercent}%`;

    console.log(`${status} ${email}`);
    console.log(`   Quota: ${quota} remaining`);
    console.log(`   Last activity: ${h.lastActivity || 'never'}`);

    if (h.issues.length > 0) {
      console.log('   Issues:');
      for (const issue of h.issues) {
        console.log(`     ⚠️  ${issue}`);
      }
    }
    console.log('');
  }
}

async function setStrategy(strategy: string) {
  const valid = ['least_used', 'round_robin', 'failover', 'random'];

  if (!strategy || !valid.includes(strategy)) {
    log.error(`Valid strategies: ${valid.join(', ')}`);
    process.exit(1);
  }

  const manager = await getAccountManager();
  await manager.setRotationStrategy(
    strategy as 'least_used' | 'round_robin' | 'failover' | 'random'
  );
}

// Run CLI
main().catch((error) => {
  log.error(`Fatal error: ${error}`);
  process.exit(1);
});
