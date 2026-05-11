---
displayName: End-to-End Test Plan for Remote Control App
description: 텔레그램 미니앱 UI부터 에이전트 실제 동작까지 전 과정에 대한 테스트 계획 수립 스킬
---
# E2E Test Plan: Remote Agent Control

## 1. Test Scenarios

### TC-01: Happy Path - Successful Command Execution
1.  **Pre-condition:** User is logged in. At least one agent is 'idle'.
2.  **Steps:**
    a. Open the Mini App.
    b. Verify the agent list is displayed correctly.
    c. Select an 'idle' agent.
    d. Enter a valid command (e.g., `list_files`) and send.
3.  **Expected Result:**
    a. The command appears in the log with a 'pending' status.
    b. Within 5 seconds, the status changes to 'success'.
    c. The correct output of the command is displayed.
    d. The agent's status in the main list briefly shows 'running' then returns to 'idle'.

### TC-02: Failure Path - Invalid Command
1.  **Pre-condition:** Same as TC-01.
2.  **Steps:**
    a. Select an 'idle' agent.
    b. Enter an invalid command (e.g., `invalid_command_xyz`).
3.  **Expected Result:**
    a. The command log shows a 'failed' status.
    b. An error message like "Unknown command" is displayed.

## 2. Test Environment
- **Frontend:** Telegram Web App on various devices (iOS, Android, Desktop).
- **Backend:** Staging server with a mock Agent Control System.
- **Tools:** Playwright or Cypress for automated UI testing.