#!/usr/bin/env python3
"""
C1 ↔ C2 통신 모듈
- C1 → C2: 지시 전달 (cmux send + 메시지 큐)
- C2 → C1: 결과 보고 (파일 기반)
- 상태 모니터링: C2 헬스체크
"""

import json
import os
import subprocess
import time
from datetime import datetime
from pathlib import Path

# === 설정 ===
COMM_DIR = Path("/Users/alex-gracy/Documents/09_프로젝트/멀티에이전트회사-왕짱플젝/c1c2comm")
INBOX_C1 = COMM_DIR / "inbox_c1"      # C2 → C1 메시지
INBOX_C2 = COMM_DIR / "inbox_c2"      # C1 → C2 메시지
STATUS_DIR = COMM_DIR / "status"       # C2 상태
LOG_DIR = COMM_DIR / "logs"            # 통신 로그

CMUX_BIN = "/Applications/cmux.app/Contents/Resources/bin/cmux"

# 패널 매핑 (왕짱플젝 기준, 프로젝트별로 설정 파일에서 로드)
PANELS = {
    "왕짱플젝": {
        "c1": "surface:3",
        "c2": "surface:17",
        "paperclip": "surface:11",
        "browser": "surface:12",
        "bridge": "surface:16",
    }
}

# 디렉토리 초기화
for d in [INBOX_C1, INBOX_C2, STATUS_DIR, LOG_DIR]:
    d.mkdir(parents=True, exist_ok=True)


def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _log(msg):
    """통신 로그 기록"""
    today = datetime.now().strftime("%Y-%m-%d")
    log_file = LOG_DIR / f"{today}.log"
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(f"[{_now()}] {msg}\n")


# ============================================================
# C1 → C2 직접 통신 (cmux send)
# ============================================================

def c1_send_to_c2(project: str, message: str, wait_response: bool = False, timeout: int = 30):
    """C1이 C2에게 직접 메시지 전송 (cmux send)"""
    panels = PANELS.get(project)
    if not panels:
        return {"error": f"프로젝트 '{project}' 없음"}

    c2_surface = panels["c2"]

    # cmux send
    subprocess.run(
        [CMUX_BIN, "send", "--surface", c2_surface, message],
        capture_output=True, text=True, timeout=5
    )
    subprocess.run(
        [CMUX_BIN, "send-key", "--surface", c2_surface, "Enter"],
        capture_output=True, text=True, timeout=5
    )

    _log(f"C1→C2 [{project}] 전송: {message[:100]}")

    if not wait_response:
        return {"status": "sent", "project": project}

    # 응답 대기
    for _ in range(timeout // 3):
        time.sleep(3)
        screen = c1_read_c2_screen(project, lines=5)
        if "❯" in screen and "interrupt" not in screen.lower():
            break

    response = c1_read_c2_screen(project, lines=30)
    _log(f"C2→C1 [{project}] 응답: {response[:200]}")
    return {"status": "responded", "project": project, "response": response}


def c1_read_c2_screen(project: str, lines: int = 20):
    """C1이 C2 화면 읽기"""
    panels = PANELS.get(project)
    if not panels:
        return ""

    result = subprocess.run(
        [CMUX_BIN, "read-screen", "--surface", panels["c2"], "--lines", str(lines)],
        capture_output=True, text=True, timeout=10
    )
    return result.stdout.strip()


def c1_stop_c2(project: str):
    """C1이 C2 작업 중단 (Ctrl+C)"""
    panels = PANELS.get(project)
    if not panels:
        return

    subprocess.run(
        [CMUX_BIN, "send-key", "--surface", panels["c2"], "ctrl+c"],
        capture_output=True, text=True, timeout=5
    )
    _log(f"C1→C2 [{project}] Ctrl+C 전송")


# ============================================================
# 파일 기반 메시지 큐 (비동기 통신)
# ============================================================

def send_message(sender: str, receiver_inbox: Path, project: str, msg_type: str, content: str, priority: str = "normal"):
    """메시지 큐에 메시지 작성"""
    msg_id = f"{int(time.time()*1000)}"
    msg = {
        "id": msg_id,
        "sender": sender,
        "project": project,
        "type": msg_type,      # command, report, alert, status
        "content": content,
        "priority": priority,  # normal, high, urgent
        "timestamp": _now(),
        "read": False,
    }

    msg_file = receiver_inbox / f"{msg_id}.json"
    with open(msg_file, "w", encoding="utf-8") as f:
        json.dump(msg, f, ensure_ascii=False, indent=2)

    _log(f"{sender} → {receiver_inbox.name} [{project}] {msg_type}: {content[:80]}")
    return msg_id


def read_messages(inbox: Path, unread_only: bool = True):
    """메시지 큐에서 메시지 읽기"""
    messages = []
    for f in sorted(inbox.glob("*.json")):
        with open(f, "r", encoding="utf-8") as fp:
            msg = json.load(fp)
            if unread_only and msg.get("read"):
                continue
            msg["_file"] = str(f)
            messages.append(msg)
    return messages


def mark_read(msg):
    """메시지를 읽음 처리"""
    msg["read"] = True
    with open(msg["_file"], "w", encoding="utf-8") as f:
        data = {k: v for k, v in msg.items() if k != "_file"}
        json.dump(data, f, ensure_ascii=False, indent=2)


def clear_old_messages(inbox: Path, days: int = 7):
    """오래된 메시지 정리"""
    cutoff = time.time() - (days * 86400)
    for f in inbox.glob("*.json"):
        if f.stat().st_mtime < cutoff:
            f.unlink()


# ============================================================
# C1 전용 함수
# ============================================================

def c1_command_c2(project: str, command: str, priority: str = "normal"):
    """C1이 C2에게 비동기 명령 (파일 큐)"""
    return send_message("c1", INBOX_C2, project, "command", command, priority)


def c1_check_reports():
    """C1이 C2로부터 온 보고 확인"""
    return read_messages(INBOX_C1, unread_only=True)


def c1_broadcast(message: str, priority: str = "normal"):
    """C1이 모든 프로젝트 C2에게 브로드캐스트"""
    results = []
    for project in PANELS:
        msg_id = c1_command_c2(project, message, priority)
        results.append({"project": project, "msg_id": msg_id})
    _log(f"C1 브로드캐스트: {message[:80]}")
    return results


# ============================================================
# C2 전용 함수
# ============================================================

def c2_check_commands(project: str = None):
    """C2가 C1으로부터 온 명령 확인"""
    messages = read_messages(INBOX_C2, unread_only=True)
    if project:
        messages = [m for m in messages if m.get("project") == project]
    return messages


def c2_report_to_c1(project: str, report_type: str, content: str, priority: str = "normal"):
    """C2가 C1에게 보고"""
    return send_message("c2", INBOX_C1, project, report_type, content, priority)


def c2_update_status(project: str, status: str):
    """C2 상태 업데이트"""
    status_file = STATUS_DIR / f"{project}.json"
    data = {
        "project": project,
        "status": status,     # idle, busy, error
        "updated": _now(),
    }
    with open(status_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ============================================================
# 헬스체크
# ============================================================

def c1_healthcheck():
    """C1이 모든 C2 상태 확인"""
    results = {}
    for project, panels in PANELS.items():
        # C2 화면 읽기
        screen = c1_read_c2_screen(project, lines=3)
        is_alive = bool(screen.strip())

        # 상태 파일 확인
        status_file = STATUS_DIR / f"{project}.json"
        if status_file.exists():
            with open(status_file, "r") as f:
                status = json.load(f)
        else:
            status = {"status": "unknown"}

        results[project] = {
            "alive": is_alive,
            "screen_preview": screen[:100] if screen else "(empty)",
            "status": status.get("status", "unknown"),
            "last_update": status.get("updated", "unknown"),
        }

    _log(f"헬스체크: {json.dumps({k: v['alive'] for k, v in results.items()})}")
    return results


# ============================================================
# CLI 인터페이스 (C1에서 직접 실행 가능)
# ============================================================

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("사용법:")
        print("  python3 comm.py send <project> <message>")
        print("  python3 comm.py read")
        print("  python3 comm.py health")
        print("  python3 comm.py broadcast <message>")
        sys.exit(0)

    cmd = sys.argv[1]

    if cmd == "send" and len(sys.argv) >= 4:
        project = sys.argv[2]
        message = " ".join(sys.argv[3:])
        result = c1_send_to_c2(project, message, wait_response=True)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    elif cmd == "read":
        reports = c1_check_reports()
        for r in reports:
            print(f"[{r['timestamp']}] {r['project']}: {r['content'][:200]}")
            mark_read(r)

    elif cmd == "health":
        results = c1_healthcheck()
        for project, info in results.items():
            status = "✅" if info["alive"] else "❌"
            print(f"{status} {project}: {info['status']} ({info['screen_preview'][:50]})")

    elif cmd == "broadcast" and len(sys.argv) >= 3:
        message = " ".join(sys.argv[2:])
        results = c1_broadcast(message)
        for r in results:
            print(f"→ {r['project']}: {r['msg_id']}")

    else:
        print(f"알 수 없는 명령: {cmd}")
