#!/usr/bin/env python3
"""
Cmux-Paperclip Telegram ChatOps Bridge v3
텔레그램에서 Claude Code(c1/c2)와 Paperclip을 원격 제어합니다.
"""

import asyncio
import re
import subprocess
import os
import sys
import logging
import random
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, BotCommand

# 멀티테넌트 미들웨어
from tenant_middleware import TenantMiddleware, TenantNotFoundError

# C1↔C2 통신 모듈
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "c1c2comm"))
try:
    from comm import (
        c1_send_to_c2, c1_read_c2_screen, c1_healthcheck,
        c1_check_reports, c2_report_to_c1, c2_update_status, _log as comm_log
    )
    COMM_ENABLED = True
except ImportError:
    COMM_ENABLED = False
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
    ContextTypes,
)

# === 설정 ===
BOT_TOKEN = os.environ.get(
    "TELEGRAM_BOT_TOKEN", "8450479614:AAEBrgkmc5UtgP72WBY1QnD6G-8AfybQHnk"
)
# 일일 사용 제한 (무료 테스트용: 30회, 유료 버전: 0=무제한) — 폴백 전용
DAILY_COMMAND_LIMIT = 30

CMUX_BIN = "/Applications/cmux.app/Contents/Resources/bin/cmux"
CMUX_SOCKET = "/Users/alex-gracy/Library/Application Support/cmux/cmux.sock"

# 기본 패널 매핑 (테넌트 미등록 시 폴백)
S_C1 = "surface:7"        # Claude 1 (대표 직접 소통)
S_C2 = "surface:6"        # Claude 2 (텔레그램 비서)
S_PAPERCLIP = "surface:3"  # Paperclip 터미널
S_BROWSER = "surface:4"    # Paperclip 브라우저

AGENTS = ["CEO", "CMO", "Ad Sales Manager", "Ad Sales Manager 2", "Content Marketer", "Performance Marketer"]
PROJECTS = ["Onboarding", "광고주센터 기획", "컨텐츠 기획"]
C2_LOG_DIR = "/Users/alex-gracy/Desktop/claude-3/c2"

logging.basicConfig(format="%(asctime)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

# === 멀티테넌트 미들웨어 ===
TENANT_DATA_DIR = os.environ.get(
    "TENANT_DATA_DIR",
    os.path.join(os.path.dirname(__file__), "tenant_data")
)
_tenant_mw = TenantMiddleware(TENANT_DATA_DIR)


def resolve_tenant(chat_id):
    """chat_id로 TenantContext 반환. 미등록 시 기본값(폴백) 반환."""
    try:
        return _tenant_mw.get_context(chat_id)
    except TenantNotFoundError:
        return None


def get_panels(ctx):
    """TenantContext에서 패널 매핑 추출. ctx=None이면 전역 기본값."""
    if ctx and ctx.panels:
        return (
            ctx.panels.get("c1", S_C1),
            ctx.panels.get("c2", S_C2),
            ctx.panels.get("paperclip", S_PAPERCLIP),
            ctx.panels.get("browser", S_BROWSER),
        )
    return S_C1, S_C2, S_PAPERCLIP, S_BROWSER


def log_c2(role, text, ctx=None):
    """C2 대화 내용을 날짜별 파일에 저장 (테넌트 격리)"""
    if ctx:
        ctx.log_c2(role, text)
        return
    from datetime import datetime
    now = datetime.now()
    filename = now.strftime("%Y-%m-%d") + ".md"
    filepath = os.path.join(C2_LOG_DIR, filename)
    timestamp = now.strftime("%H:%M:%S")
    with open(filepath, "a", encoding="utf-8") as f:
        f.write(f"**[{timestamp}] {role}:** {text}\n\n")


def check_daily_limit(ctx=None):
    """일일 명령 횟수 체크. 초과 시 False 반환. (테넌트별 격리)"""
    if ctx:
        return ctx.check_daily_limit()
    if DAILY_COMMAND_LIMIT <= 0:
        return True
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    if _daily_count["date"] != today:
        _daily_count["date"] = today
        _daily_count["count"] = 0
    _daily_count["count"] += 1
    return _daily_count["count"] <= DAILY_COMMAND_LIMIT


def get_remaining(ctx=None):
    """남은 명령 횟수 (테넌트별 격리)"""
    if ctx:
        return ctx.get_remaining()
    if DAILY_COMMAND_LIMIT <= 0:
        return "무제한"
    return max(0, DAILY_COMMAND_LIMIT - _daily_count["count"])


# 일일 사용량 제한 (폴백용 — 미등록 chat_id)
_daily_count = {"date": "", "count": 0}

# 폴링 태스크 참조
_monitor_task = None


# ============================================================
# CMUX 헬퍼
# ============================================================

def cmux(args):
    try:
        env = dict(os.environ)
        env["CMUX_SOCKET_PATH"] = CMUX_SOCKET
        r = subprocess.run([CMUX_BIN] + args, capture_output=True, text=True, timeout=15, env=env)
        return r.stdout.strip() or r.stderr.strip()
    except subprocess.TimeoutExpired:
        return "(timeout)"
    except Exception as e:
        return f"(error: {e})"


def send_text(surface, text):
    cmux(["send", "--surface", surface, text])
    cmux(["send-key", "--surface", surface, "Enter"])


def send_key(surface, key):
    cmux(["send-key", "--surface", surface, key])


def read_screen(surface, lines=30):
    return cmux(["read-screen", "--surface", surface, "--lines", str(lines)])


def snap(surface):
    return cmux(["browser", "snapshot", "--surface", surface, "--compact"])


def get_page_text(surface):
    """브라우저 페이지의 실제 텍스트 내용 추출"""
    return cmux(["browser", "get", "--surface", surface, "text", "main"])


def click(surface, ref):
    return cmux(["browser", "click", "--surface", surface, ref])


def fill(surface, selector, text):
    return cmux(["browser", "fill", "--surface", surface, selector, text])


def browser_type(surface, selector, text):
    return cmux(["browser", "type", "--surface", surface, selector, text])


def trunc(text, limit=4000):
    return text[-limit:] if len(text) > limit else text


# 보드가 마지막으로 보낸 원문 텍스트 (에코 필터용)
_last_board_input = ""

# 랜덤 응답 풀
_ACK_MESSAGES = [
    "알겠습니다. 확인하고 알려드릴게요.",
    "네, 바로 확인해볼게요.",
    "잠시만요, 파악해볼게요.",
    "확인 중이에요. 잠시만 기다려주세요.",
    "네, 처리할게요.",
    "바로 확인합니다.",
    "알겠습니다. 잠시만요.",
    "네, 살펴보고 알려드릴게요.",
]

_WAITING_MESSAGES = [
    "아직 처리 중이에요. 완료되면 바로 알려드릴게요.",
    "작업이 좀 걸리고 있어요. 끝나면 말씀드릴게요.",
    "확인하는 중입니다. 조금만 기다려주세요.",
    "처리 중이에요. 곧 결과 알려드릴게요.",
]


def random_ack():
    return random.choice(_ACK_MESSAGES)


def random_waiting():
    return random.choice(_WAITING_MESSAGES)


def set_last_board_input(text):
    """보드가 C2에 보낸 원문을 저장 — clean_terminal에서 에코 필터링에 사용"""
    global _last_board_input
    _last_board_input = text.strip()


def clean_terminal(text):
    """터미널 출력에서 도구/UI 노이즈 제거 — 텔레그램 전달용 (노이즈 라인 필터)"""
    global _last_board_input
    lines = text.split("\n")
    cleaned = []
    # 보드 원문 에코 감지용: 5글자 이상 부분 문자열 매칭
    input_fragments = set()
    if _last_board_input:
        for il in _last_board_input.split("\n"):
            il_stripped = il.strip()
            if len(il_stripped) >= 5:
                input_fragments.add(il_stripped)
        # 원문에서 연속 5글자 이상 조각 추출 (부분 매칭용)
        words = _last_board_input.replace("\n", " ").strip()
        for i in range(0, len(words) - 7, 4):
            frag = words[i:i+8]
            if frag.strip():
                input_fragments.add(frag)
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        # --- 보드 원문 에코 필터 (부분 문자열 매칭) ---
        if input_fragments:
            is_echo = False
            for frag in input_fragments:
                if frag in stripped:
                    is_echo = True
                    break
            if is_echo:
                continue
        # --- 확실한 노이즈 패턴 (한 줄이라도 매칭되면 제거) ---
        if _is_noise(stripped, line):
            continue
        cleaned.append(stripped)
    # 사용 후 초기화
    _last_board_input = ""
    return "\n".join(cleaned).strip()


def _is_code_noise(bl_s):
    """C2 스트리밍 블록 내부 라인이 코드/diff/경로/시스템 노이즈인지 판별"""
    if not bl_s:
        return True
    # 코드 패턴
    if re.match(r'^\d+\s*[+-]', bl_s):  # diff 줄번호
        return True
    if re.search(r're\.search|re\.match|re\.sub|re\.IGNORECASE', bl_s):  # regex 코드
        return True
    if re.search(r'def \w+|if \w+.*:|for \w+.*:|import |from .* import|return |await |async ', bl_s):  # python 코드
        return True
    if re.search(r'\.py[)(]|\.js[)(]|\.md[)(]|\.json[)(]', bl_s):  # 파일 확장자
        return True
    if re.search(r'Documents/|/Users/|~/|cmux_telegram|surface:|workspace:', bl_s):  # 경로/시스템
        return True
    if re.search(r'ctrl\+[oe]|expand\)|Reading \d|Update\(|\.startswi', bl_s):  # 시스템 UI
        return True
    if re.search(r'Evaporating|Finagling|Schlepping|Hyperspacing|Nucleating|Perusing|Flambéing|Newspapering', bl_s):  # 스피너
        return True
    if bl_s.startswith("+") or bl_s.startswith("-th("):  # diff
        return True
    if re.match(r'^"?\w+"\s+not\s+in\s+s', bl_s):  # "Xxx" not in stripped
        return True
    if "not stripped." in bl_s or "stripped not in" in bl_s:  # 코드 조건문
        return True
    if bl_s in ("y", "n", "yes", "no", "OK", "ok", "nd", "continue"):  # 단어 조각
        return True
    if re.match(r'^(pped|ped |ripped|tripped|ipped)', bl_s):  # 잘린 단어
        return True
    # 로그/시스템 메시지
    if re.search(r'Chat ID restored|Chat ID set|tokens\)|stop hooks|running hooks|Billowing|Sprouting|Baked for|Brewed for|Churned for|Crunched for|Worked for', bl_s):
        return True
    if bl_s.startswith("Claude's current") or bl_s.startswith("※"):
        return True
    return False


def _is_noise(stripped, raw_line=""):
    """터미널 노이즈 라인인지 판별 — True면 제거.
    화이트리스트 방식: 한글이 포함된 자연어 응답만 통과, 나머지는 노이즈로 판단."""

    # --- 1단계: 확실한 노이즈 즉시 제거 ---
    # 빈 줄, 프롬프트, 구분선
    if stripped in ("❯", ">", "", ")", "}", "]", "clicked", "ok", "done", "created", "inserted", "focused", "not found"):
        return True
    if stripped.startswith("❯ ") or stripped.startswith("─"):
        return True
    # Claude Code 도구 마커
    if re.match(r'^[⏺●◉⎿└✳✻⠂⠐⠒⠇⠋⠙⠸⠴⠦⠏⠛⠹⠼⠶⠧·*]+\s*', stripped):
        return True
    # 승인 프롬프트
    if re.match(r'^\d+\.\s*(Yes|No|Yes,)', stripped):
        return True
    if re.search(r'Esc to cancel|ctrl\+[eo]|commands in /|Do you want to proceed|accept edits|►►', stripped):
        return True
    # 스피너/사고 중
    if re.search(r'thinking|Nucleating|Flambéing|Perusing|Newspapering|Elucidating|Ruminating|Cogitating|Concocting|Crystallizing|Pondering|Deliberating|Formulating|Synthesizing|Ionizing|Whatchamacalliting|Churned? for|Worked for|Baked for|Brewed for|Crunched for', stripped, re.IGNORECASE):
        return True

    # --- 2단계: 기술적 내용 필터 (shell, 코드, API, 경로 등) ---
    # 쉘 명령/출력 패턴
    if re.search(r'2>&1|&&\s|cmux\s|surface:|workspace:|--surface|--compact|--lines|--snapshot|ref=e\d+', stripped):
        return True
    # 파일 경로
    if re.search(r'/Users/|/home/|/tmp/|/var/|~/\.|\.claude/|\.md\b|\.py\b|\.js\b', stripped):
        return True
    # 파일 시스템 명령
    if re.match(r'^(mkdir|cp|rm|ls|mv|cat|chmod|chown|touch|find|cd|pwd|sleep|python3?|node|npm)\s', stripped):
        return True
    # HTTP/API 로그 및 시스템 로그
    if re.search(r'HTTP Request|HTTP/1\.|api\.telegram|bot\d{8,}|POST https?://|GET https?://', stripped):
        return True
    if re.search(r'^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}', stripped):
        return True
    # 쉘 파이프/리다이렉트 패턴
    if re.search(r'xargs\s|awk\s|\{print\s|/dev/null|\|\s*grep|\|\s*tail|\|\s*head', stripped):
        return True
    # kill/ps 명령
    if re.match(r'^(kill|ps|lsof|grep|awk|tail|head|wc|sort|uniq)\s', stripped):
        return True
    # 코드/기술 패턴
    if re.match(r'^(OK|Running|done|submitted|succeeded|failed)\s*$', stripped):
        return True
    if re.match(r'^\(timeout|^\(Bash|^\(error', stripped):
        return True
    if re.match(r'^(Bash|Read|Write|Edit|Glob|Grep|Agent|Skill|Tool)\s*[\(]', stripped):
        return True
    if re.match(r'^(Bash|Read|Write|Edit|Glob|Grep|Agent|Skill|Tool)\s*(command|tool)?\s*$', stripped):
        return True
    # hex hash, run ID
    if re.match(r'^[0-9a-f]{6,10}$', stripped):
        return True
    # 줄임 표시
    if re.match(r'^\.\.\.\s*\+\d+ lines', stripped):
        return True
    # 시스템 메시지
    if re.match(r'^Wrote \d+ memo', stripped) or "Unhandled node type" in stripped:
        return True
    if stripped.startswith("? for shortcuts") or stripped.startswith("/buddy"):
        return True
    if "esc to interrupt" in stripped:
        return True
    # baseline/기술 설명 잔여
    if re.search(r'baseline|clean_terminal|_is_noise|wait_c2_response|set_last_board_input|read_screen', stripped):
        return True

    # --- 3단계: 한글 포함 여부로 최종 판단 ---
    # 한글이 포함된 줄은 자연어 응답일 가능성 높음 → 통과
    if re.search(r'[가-힣]', stripped):
        return False
    # 한글 없는 영문/기호만 줄 — 3단어 이하면 노이즈
    words = stripped.split()
    if len(words) <= 3:
        return True
    # 한글 없지만 긴 영문 → 기술 용어 비율 체크
    tech_keywords = r'(click|eval|snapshot|browser|button|link|document|query|selector|element|function|const|let|var|return|import|export|async|await|error|debug|log|config|script|install|build|compile|deploy)'
    if re.search(tech_keywords, stripped, re.IGNORECASE):
        return True

    return False


async def wait_c2_response(max_wait=120, surface_c2=None, baseline=None):
    """C2가 응답 완료할 때까지 대기 (최대 max_wait초, 기본 120초)
    baseline: 메시지 전송 전 터미널 내용. 있으면 새 내용만 추출."""
    s_c2 = surface_c2 or S_C2
    for _ in range(max_wait // 3):
        await asyncio.sleep(3)
        screen = read_screen(s_c2, 5)
        # 프롬프트(❯)가 보이면 응답 완료
        if "❯" in screen and "interrupt" not in screen.lower():
            break
    # 전체 응답 읽기
    result = read_screen(s_c2, 40)
    # baseline이 있으면 새 내용만 추출 (이전 응답 제거)
    if baseline:
        baseline_lines = set(baseline.strip().split("\n"))
        new_lines = []
        for line in result.split("\n"):
            if line.strip() and line not in baseline_lines:
                new_lines.append(line)
        result = "\n".join(new_lines)
    return clean_terminal(result)


def humanize_snapshot(raw):
    """브라우저 스냅샷에서 사람이 읽을 수 있는 텍스트만 추출"""
    # 제외할 UI 텍스트
    SKIP = {
        "Skip to Main Content", "Dashboard", "Inbox", "Issues", "Routines Beta",
        "Goals", "Org", "Skills", "Costs", "Activity", "Settings",
        "Documentation", "Instance settings", "CEO", "CMO",
        "Ad Sales Manager", "Ad Sales Manager 2", "Content Marketer",
        "Performance Marketer", "Switch to light mode", "Add company",
        "New Issue", "New project", "New agent", "Command Palette",
        "PROJECTS", "AGENTS", "Upload attachment", "New document",
        "Documents", "Comments", "Sub-issues", "Copy issue as markdown",
        "Scroll to bottom", "List view", "Board view", "Filter", "Sort", "Group",
    }

    lines = []
    for line in raw.split("\n"):
        line = line.strip()
        # 따옴표 안 텍스트 추출
        m = re.search(r'"(.+?)"', line)
        if not m:
            continue
        text = m.group(1).strip()

        # 스킵 대상
        if text in SKIP or re.match(r'^e\d+$', text) or len(text) < 3:
            continue
        # ref만 있는 줄 스킵
        if "ref=" in text:
            continue
        # 순수 UI 패턴 스킵
        if text.startswith("tab ") or text in ("unread", "read"):
            continue

        # heading
        if 'heading' in line:
            # UI heading 스킵
            if text in ("ISSUES", "INBOX", "DASHBOARD", "ORG CHART"):
                continue
            lines.append(f"\n**{text}**")
        else:
            lines.append(text)

    # 중복 제거 (연속된 같은 텍스트)
    deduped = []
    for l in lines:
        if not deduped or l != deduped[-1]:
            deduped.append(l)

    result = "\n".join(deduped).strip()
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result if result else "(내용을 파싱할 수 없어요)"


def format_notification(raw):
    """Cmux 알림 raw 텍스트를 자연어로 변환"""
    # 파이프로 구분된 필드 파싱: id|...|status|source|message|user|내용
    parts = raw.split("|")
    # 주요 필드 추출
    status = ""
    source = ""
    user = ""
    message = ""
    for p in parts:
        p = p.strip()
        if p in ("unread", "read"):
            status = p
        elif "Claude Code" in p:
            source = "Claude Code"
        elif "Completed" in p:
            status = "완료"
        elif p.startswith("alex") or p.startswith("geek"):
            user = p
        # UUID 패턴 스킵
        elif re.match(r'^[0-9a-fA-F]{8}-', p):
            continue
        elif re.match(r'^[0-9]+:', p):
            continue
        elif len(p) > 5 and not re.match(r'^[0-9A-F-]+$', p, re.IGNORECASE):
            # 의미있는 텍스트
            if not message:
                message = p
            else:
                message += " " + p

    if source and status:
        return f"{source} {status}: {message}" if message else f"{source} {status}"
    elif message:
        return message
    else:
        # 파싱 실패 시 UUID만 제거
        cleaned = re.sub(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '', raw)
        cleaned = re.sub(r'\|+', ' ', cleaned).strip()
        return cleaned if cleaned else raw


# ============================================================
# 화면 모니터링 (Claude 승인/선택 자동 감지)
# ============================================================

async def monitor_claude_screens(app):
    """5초마다 c1/c2 화면 + cmux 알림 + Paperclip inbox를 확인 (멀티테넌트)"""
    last_seen_notifications = set()
    app.bot_data.setdefault("last_inbox_count", -1)
    app.bot_data.setdefault("c2_seen_lines", set())
    inbox_check_counter = 0  # inbox는 30분마다 체크 (360사이클 x 5초)

    while True:
        await asyncio.sleep(5)

        # 활성 chat 목록에서 모니터링할 테넌트들 수집
        active_chats = app.bot_data.get("active_chats", {})
        # 폴백: 단일 chat_id만 있는 경우 (레거시 호환)
        if not active_chats and app.bot_data.get("chat_id"):
            fallback_id = app.bot_data["chat_id"]
            active_chats = {fallback_id: {"ctx": None, "panels": (S_C1, S_C2, S_PAPERCLIP, S_BROWSER)}}

        if not active_chats:
            continue

        # 모든 활성 테넌트에 대해 모니터링 수행
        # (surface 중복 방지를 위해 이미 확인한 surface 추적)
        checked_surfaces = set()

        for chat_id, chat_info in active_chats.items():
            tenant_ctx = chat_info.get("ctx")
            t_c1, t_c2, t_paperclip, t_browser = chat_info.get("panels", (S_C1, S_C2, S_PAPERCLIP, S_BROWSER))

            # --- C1 → Bridge 메시지 확인 (comm 모듈, 전역 1회) ---
            if COMM_ENABLED and "comm_checked" not in checked_surfaces:
                checked_surfaces.add("comm_checked")
                try:
                    reports = c1_check_reports()
                    for r in reports:
                        if r.get("type") == "alert" and r.get("priority") in ("high", "urgent"):
                            await app.bot.send_message(
                                chat_id=chat_id,
                                text=f"🔔 시스템 업데이트: {r['content']}"
                            )
                        from comm import mark_read
                        mark_read(r)
                except Exception as e:
                    logger.error(f"Comm check error: {e}")

            # --- Paperclip Inbox 알림 감지 (5분마다, 테넌트별 브라우저) ---
            browser_key = f"inbox_{t_browser}"
            if browser_key not in checked_surfaces:
                checked_surfaces.add(browser_key)
                inbox_check_counter += 1
                if inbox_check_counter >= 60:  # 60사이클 x 5초 = 5분
                    inbox_check_counter = 0
                    try:
                        badge_text = cmux(["browser", "eval", "--surface", t_browser,
                            "const links=[...document.querySelectorAll('a')];const il=links.find(a=>a.textContent.includes('Inbox'));il?il.textContent.trim():'Inbox0'"])
                        import re as _re
                        badge_match = _re.search(r'Inbox\s*(\d+)', badge_text)
                        current_count = int(badge_match.group(1)) if badge_match else 0
                        last_inbox_count = app.bot_data.get("last_inbox_count", -1)

                        if last_inbox_count == -1:
                            app.bot_data["last_inbox_count"] = current_count
                        elif current_count > last_inbox_count:
                            # inbox unread 내용 읽어서 전달
                            cmux(["browser", "goto", "--surface", t_browser, "http://127.0.0.1:3100/SOC/inbox"])
                            await asyncio.sleep(2)
                            s = snap(t_browser)
                            for line in s.split("\n"):
                                if '"Unread"' in line:
                                    ref_match = _re.search(r'\[ref=(e\d+)\]', line)
                                    if ref_match:
                                        click(t_browser, ref_match.group(1))
                                        await asyncio.sleep(1)
                                        break
                            inbox_content = get_page_text(t_browser)
                            parsed = parse_inbox(inbox_content) if inbox_content else ""
                            if parsed and app.bot_data.get("notifications_enabled", True):
                                try:
                                    await app.bot.send_message(
                                        chat_id=chat_id,
                                        text=trunc(f"📬 새 알림:\n\n{parsed}", 3000)
                                    )
                                except Exception as e:
                                    logger.error(f"Inbox notify error: {e}")
                            app.bot_data["last_inbox_count"] = current_count
                        elif current_count < last_inbox_count:
                            app.bot_data["last_inbox_count"] = current_count
                    except Exception as e:
                        logger.error(f"Inbox check error: {e}")

            # --- Cmux 알림 감지 (비활성화 — 노이즈가 많아 텔레그램 전달 중단) ---
            if "notif_checked" not in checked_surfaces:
                checked_surfaces.add("notif_checked")
                try:
                    cmux(["list-notifications"])  # 알림 큐 소비만 (쌓이지 않도록)
                except Exception:
                    pass

            # --- C2 실시간 스트리밍 (⏺ 자연어 블록 단위로 텔레그램에 전송) ---
            if t_c2 and f"stream_{t_c2}" not in checked_surfaces:
                checked_surfaces.add(f"stream_{t_c2}")
                try:
                    screen = read_screen(t_c2, 60)
                    if screen:
                        seen = app.bot_data.get("c2_seen_lines", set())
                        # ⏺ 블록 단위로 묶어서 전송
                        blocks = []
                        current_block = []
                        for line in screen.split("\n"):
                            stripped = line.strip()
                            if stripped.startswith("⏺"):
                                # 이전 블록 저장
                                if current_block:
                                    blocks.append("\n".join(current_block))
                                current_block = [stripped]
                            elif current_block:
                                # ⏺ 블록의 연속 줄 (들여쓰기 or 빈 줄 아닌 자연어)
                                if (stripped and
                                    "Bash(" not in stripped and
                                    "Read(" not in stripped and
                                    "Write(" not in stripped and
                                    "Edit(" not in stripped and
                                    "Glob(" not in stripped and
                                    "Grep(" not in stripped and
                                    "Agent(" not in stripped and
                                    "⎿" not in stripped and
                                    "Running" not in stripped and
                                    "ctrl+o" not in stripped and
                                    "Finagling" not in stripped and
                                    "Schlepping" not in stripped and
                                    "Hyperspacing" not in stripped and
                                    "Nucleating" not in stripped and
                                    "Perusing" not in stripped and
                                    "Flambéing" not in stripped and
                                    "Newspapering" not in stripped and
                                    not stripped.startswith("·") and
                                    not stripped.startswith("*") and
                                    not stripped.startswith("───") and
                                    not stripped.startswith("❯") and
                                    stripped not in ("y", "n", "yes", "no", "OK", "ok")):
                                    current_block.append(stripped)
                                elif stripped.startswith("───") or stripped.startswith("❯"):
                                    # 블록 종료
                                    if current_block:
                                        blocks.append("\n".join(current_block))
                                        current_block = []
                        if current_block:
                            blocks.append("\n".join(current_block))

                        for block in blocks:
                            # 노이즈 필터
                            first_line = block.split("\n")[0].strip()
                            if ("Bash(" in first_line or
                                "Read(" in first_line or
                                "Write(" in first_line or
                                "Edit(" in first_line or
                                "Glob(" in first_line or
                                "Grep(" in first_line or
                                "Agent(" in first_line or
                                "Update(" in first_line or
                                "memory" in first_line.lower() or
                                "ctrl+o" in first_line.lower() or
                                "Reading" in first_line or
                                len(first_line) <= 5):
                                continue
                            # 코드/diff/경로/시스템 노이즈 제거
                            clean_lines = []
                            for bl in block.split("\n"):
                                bl_s = bl.strip()
                                if _is_code_noise(bl_s):
                                    continue
                                clean_lines.append(bl_s)
                            block = "\n".join(clean_lines).strip()
                            if not block or len(block) < 5:
                                continue
                            # 첫 줄 전체를 키로 사용 (같은 메시지 중복 방지)
                            first_clean = block.split("\n")[0].lstrip("⏺").strip()
                            block_key = first_clean
                            if block_key not in seen:
                                seen.add(block_key)
                                msg = block.split("\n", 1)
                                first = msg[0].lstrip("⏺").strip()
                                rest = msg[1] if len(msg) > 1 else ""
                                full_msg = (first + "\n" + rest).strip() if rest else first
                                if full_msg:
                                    try:
                                        await app.bot.send_message(chat_id=chat_id, text=trunc(full_msg, 4000))
                                    except Exception:
                                        pass
                        # 오래된 항목 정리
                        if len(seen) > 200:
                            app.bot_data["c2_seen_lines"] = set(list(seen)[-100:])
                        else:
                            app.bot_data["c2_seen_lines"] = seen
                except Exception as e:
                    logger.error(f"C2 stream error: {e}")

            # --- Claude 화면 승인/선택 감지 (테넌트별 surface) ---
            for label, surface, last_key in [("Luca", t_c1, "c1"), ("Ari", t_c2, "c2")]:
                surface_key = f"screen_{surface}"
                if surface_key in checked_surfaces:
                    continue
                checked_surfaces.add(surface_key)
                try:
                    screen = read_screen(surface, 15)
                    if not screen:
                        continue

                    last_prompt = app.bot_data.get(f"last_{last_key}_prompt", "")

                    # 승인/선택 패턴 감지
                    prompt_text = ""
                    buttons = []

                    # 무시할 패턴: 세션 피드백
                    if re.search(r'How is Claude doing\?|Dismiss this', screen):
                        continue

                    # 승인 프롬프트 먼저 체크 (❯ 1. Yes 패턴이 있으므로 ❯ 체크보다 우선)
                    has_approval_prompt = "Do you want to proceed" in screen or "want to proceed" in screen

                    # 승인 프롬프트가 아닌데 ❯가 있으면 → 응답 완료 상태
                    if not has_approval_prompt and "❯" in screen:
                        # 이전 승인 요청이 있었으면 패널에서 처리된 것 → 텔레그램 메시지 삭제
                        if app.bot_data.get(f"last_{last_key}_prompt"):
                            old_msg_id = app.bot_data.get(f"last_{last_key}_prompt_msg_id")
                            if old_msg_id:
                                try:
                                    await app.bot.delete_message(chat_id=chat_id, message_id=old_msg_id)
                                except Exception:
                                    pass
                                app.bot_data[f"last_{last_key}_prompt_msg_id"] = None
                            app.bot_data[f"last_{last_key}_prompt"] = ""
                        continue

                    # 승인 프롬프트 감지 → 인라인 버튼으로 전달
                    if has_approval_prompt:
                        prompt_text = extract_question(screen)
                        if prompt_text and prompt_text != last_prompt:
                            buttons = [
                                [InlineKeyboardButton("1. Yes", callback_data=f"key:{last_key}:1"),
                                 InlineKeyboardButton("2. Yes+", callback_data=f"key:{last_key}:2"),
                                 InlineKeyboardButton("3. No", callback_data=f"key:{last_key}:3")]
                            ]

                    # Y/N 패턴 (정확한 프롬프트 패턴만 매칭)
                    elif re.search(r'\(Y\)es.*\(N\)o|\(y/n\)', screen, re.IGNORECASE):
                        prompt_text = extract_question(screen)
                        if prompt_text and prompt_text != last_prompt:
                            buttons = [
                                [InlineKeyboardButton("Y", callback_data=f"key:{last_key}:Y"),
                                 InlineKeyboardButton("N", callback_data=f"key:{last_key}:N")]
                            ]

                    # tool call 허용 패턴 (Claude Code 권한 요청만 매칭)
                    elif re.search(r'Allow.*once|Allow.*always|허용.*한번|허용.*항상', screen, re.IGNORECASE):
                        prompt_text = extract_question(screen)
                        if prompt_text and prompt_text != last_prompt:
                            buttons = [
                                [InlineKeyboardButton("허용", callback_data=f"key:{last_key}:y"),
                                 InlineKeyboardButton("거부", callback_data=f"key:{last_key}:n"),
                                 InlineKeyboardButton("항상 허용", callback_data=f"key:{last_key}:a")]
                            ]

                    if buttons and prompt_text:
                        app.bot_data[f"last_{last_key}_prompt"] = prompt_text
                        try:
                            # 영문 CLI 원문을 한글 자연어로 요약
                            friendly_text = _humanize_prompt(prompt_text)
                            msg = await app.bot.send_message(
                                chat_id=chat_id,
                                text=f"🔔 {label}가 확인을 요청해요:\n\n{friendly_text}",
                                reply_markup=InlineKeyboardMarkup(buttons)
                            )
                            # 패널에서 직접 승인 시 메시지 삭제를 위해 ID 저장
                            app.bot_data[f"last_{last_key}_prompt_msg_id"] = msg.message_id
                        except Exception as e:
                            logger.error(f"Monitor send error: {e}")

                    # 이전에 승인 요청이 있었는데 지금 사라졌으면 → 패널에서 처리된 것 → 텔레그램 메시지 삭제
                    elif not buttons and not prompt_text and app.bot_data.get(f"last_{last_key}_prompt"):
                        old_msg_id = app.bot_data.get(f"last_{last_key}_prompt_msg_id")
                        if old_msg_id:
                            try:
                                await app.bot.delete_message(chat_id=chat_id, message_id=old_msg_id)
                            except Exception:
                                pass
                            app.bot_data[f"last_{last_key}_prompt_msg_id"] = None
                        app.bot_data[f"last_{last_key}_prompt"] = ""

                except Exception as e:
                    logger.error(f"Monitor error ({label}): {e}")


def extract_question(screen):
    """화면에서 질문/프롬프트 부분 추출"""
    lines = screen.strip().split("\n")
    # 마지막 의미있는 라인들 추출
    meaningful = [l for l in lines if l.strip() and not l.strip().startswith("─") and l.strip() != "❯"]
    if meaningful:
        return "\n".join(meaningful[-8:])
    return ""


def _humanize_prompt(raw_text):
    """영문 CLI 승인 프롬프트를 한글 자연어로 요약"""
    text = raw_text.strip()

    # Bash command 패턴
    m = re.search(r'Bash command\s*\n\s*(.+?)(?:\n|$)', text)
    if m:
        cmd = m.group(1).strip()
        if re.search(r'\bls\b', cmd):
            return f"폴더 내용을 확인해도 될까요?\n({cmd})"
        if re.search(r'\bmkdir\b', cmd):
            return f"폴더를 생성해도 될까요?\n({cmd})"
        if re.search(r'\brm\b', cmd):
            return f"파일을 삭제해도 될까요?\n({cmd})"
        if re.search(r'\bgit\b', cmd):
            return f"Git 명령을 실행해도 될까요?\n({cmd})"
        if re.search(r'\bnpm|npx|pip|brew\b', cmd):
            return f"패키지 명령을 실행해도 될까요?\n({cmd})"
        if re.search(r'\bcurl|wget\b', cmd):
            return f"네트워크 요청을 실행해도 될까요?\n({cmd})"
        return f"쉘 명령을 실행해도 될까요?\n({cmd})"

    # Read/Write/Edit 패턴
    m = re.search(r'(Read|Write|Edit)\s+(?:file\s+)?(.+?)(?:\n|$)', text)
    if m:
        action = {"Read": "파일을 읽어", "Write": "파일을 작성해", "Edit": "파일을 수정해"}.get(m.group(1), "파일 작업을")
        return f"{action}도 될까요?\n({m.group(2).strip()})"

    # 그 외: 시스템 텍스트 및 코드 제거 후 자연어 요약 생성
    cleaned = re.sub(r'Do you want to proceed\??', '', text)
    cleaned = re.sub(r'Esc to cancel.*$', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'Run shell command', '', cleaned)
    cleaned = re.sub(r'^\s*\d+\.\s*(Yes|No|Yes,).*$', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'shift\+tab to cycle', '', cleaned)

    # 코드/명령어 패턴 감지 → 간단한 한글 요약으로 대체
    if re.search(r'json\.loads|sys\.stdin|print\(|import\s|\.get\(|querySelectorAll|document\.|eval\(', cleaned):
        # 어떤 작업인지 추론
        if re.search(r'issue|이슈', cleaned, re.IGNORECASE):
            return "이슈 데이터를 조회해도 될까요?"
        if re.search(r'agent|에이전트', cleaned, re.IGNORECASE):
            return "에이전트 정보를 조회해도 될까요?"
        if re.search(r'kill|restart|bridge', cleaned, re.IGNORECASE):
            return "프로세스를 재시작해도 될까요?"
        if re.search(r'comment|댓글', cleaned, re.IGNORECASE):
            return "댓글을 작성해도 될까요?"
        return "데이터를 처리해도 될까요?"

    # cmux/surface 명령 패턴
    if re.search(r'cmux|surface:|send-key|read-screen', cleaned):
        if re.search(r'kill|restart', cleaned, re.IGNORECASE):
            return "프로세스를 재시작해도 될까요?"
        return "패널 명령을 실행해도 될까요?"

    cleaned = cleaned.strip()
    if cleaned:
        return cleaned
    return "작업을 진행해도 될까요?"


# ============================================================
# 콜백: 인라인 버튼 처리
# ============================================================

async def _safe_edit(query, text, reply_markup=None):
    """edit_message_text의 안전한 래퍼 (만료/중복 에러 방지)"""
    try:
        await query.edit_message_text(text=text, reply_markup=reply_markup)
    except Exception as e:
        # 메시지 수정 불가 시 새 메시지로 전송
        try:
            await query.message.reply_text(text, reply_markup=reply_markup)
        except Exception:
            logger.error(f"Safe edit fallback failed: {e}")

async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    data = query.data or ""
    chat_id = update.effective_chat.id
    ctx = resolve_tenant(chat_id)
    s_c1, s_c2, s_paperclip, s_browser = get_panels(ctx)

    try:
        await query.answer()
    except Exception:
        pass  # 이미 응답된 콜백이면 무시

    # 알림 ON/OFF 토글
    if data == "noti:toggle":
        current = context.bot_data.get("notifications_enabled", True)
        new_state = not current
        context.bot_data["notifications_enabled"] = new_state
        _save_noti_state(new_state)
        text, kb = _noti_text_and_kb(new_state)
        try:
            await query.edit_message_text(text, reply_markup=kb, parse_mode="Markdown")
        except Exception as e:
            logger.error(f"noti toggle edit error: {e}")
        return

    # key:c1:Y / key:c2:2 등 (승인/선택 응답)
    if data.startswith("key:"):
        try:
            _, target, value = data.split(":", 2)
        except ValueError:
            await _safe_edit(query, "⚠️ 잘못된 버튼 데이터입니다.")
            return
        surface = s_c1 if target == "c1" else s_c2
        label = "Luca" if target == "c1" else "Ari"
        send_text(surface, value)
        await _safe_edit(query, f"✅ {label}에게 전달 완료")
        return

    # issue:SOC-XX:refXX
    if data.startswith("issue:"):
        try:
            parts = data.split(":")
            soc_id, ref = parts[1], parts[2]
        except (IndexError, ValueError):
            await _safe_edit(query, "⚠️ 이슈 데이터 파싱 실패")
            return
        click(s_browser, ref)
        await asyncio.sleep(2)
        # Scroll to bottom
        s = snap(s_browser)
        for line in s.split("\n"):
            if "Scroll to bottom" in line:
                rm = re.search(r'\[ref=(e\d+)\]', line)
                if rm:
                    click(s_browser, rm.group(1))
                    await asyncio.sleep(1)
                    break
        content = get_page_text(s_browser)
        context.user_data["active_issue"] = soc_id
        context.user_data["mode"] = "issue_comment"
        parsed = parse_issue_page(content)
        await _safe_edit(query, trunc(f"📌 {soc_id}\n\n{parsed}", 3500))
        await query.message.reply_text(f"{soc_id} 열었어요. 댓글 입력하면 등록해드릴게요.")
        log_c2("시스템", f"{soc_id} 이슈 열람\n\n{trunc(content, 2000)}", ctx)
        return

    # inbox:SOC-XX:refXX
    if data.startswith("inbox:"):
        try:
            parts = data.split(":")
            soc_id, ref = parts[1], parts[2]
        except (IndexError, ValueError):
            await _safe_edit(query, "⚠️ 알림 데이터 파싱 실패")
            return
        click(s_browser, ref)
        await asyncio.sleep(2)
        s = snap(s_browser)
        context.user_data["active_issue"] = soc_id
        context.user_data["mode"] = "issue_comment"

        is_approval = "approv" in s.lower() or "승인" in s.lower()
        if is_approval:
            await _safe_edit(query,
                f"대표님, {soc_id} 건에 대해 승인 요청이 들어왔어요~\n\n{trunc(get_page_text(s_browser), 3000)}",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("승인", callback_data=f"approve:{soc_id}")
                ]])
            )
        else:
            await _safe_edit(query,
                f"{soc_id} 업데이트 내용이에요:\n\n{trunc(get_page_text(s_browser), 3000)}\n\n텍스트 입력하면 댓글로 남겨드릴게요."
            )
        return

    # approve:SOC-XX
    if data.startswith("approve:"):
        soc_id = data.split(":", 1)[1] if ":" in data else ""
        if not soc_id:
            await _safe_edit(query, "⚠️ 승인 데이터 오류")
            return
        s = snap(s_browser)
        for line in s.split("\n"):
            if "approve" in line.lower() or "승인" in line.lower():
                ref_match = re.search(r'\[ref=(e\d+)\]', line)
                if ref_match:
                    click(s_browser, ref_match.group(1))
                    await _safe_edit(query, f"✅ {soc_id} 승인 완료!")
                    return
        await _safe_edit(query, f"{soc_id} 승인 버튼을 찾지 못했어요.")
        return

    # assignee:XXX
    if data.startswith("assignee:"):
        agent = data.split(":", 1)[1]
        context.user_data["new_issue_assignee"] = agent
        buttons = [[InlineKeyboardButton(p, callback_data=f"project:{p}")] for p in PROJECTS]
        await _safe_edit(query,
            f"담당자: {agent}\n프로젝트를 선택해주세요:",
            reply_markup=InlineKeyboardMarkup(buttons)
        )
        return

    # project:XXX
    if data.startswith("project:"):
        project = data.split(":", 1)[1]
        context.user_data["new_issue_project"] = project
        context.user_data["mode"] = "newissue_title"
        await _safe_edit(query,
            f"담당자: {context.user_data.get('new_issue_assignee')}\n"
            f"프로젝트: {project}\n\n이슈 제목을 입력해주세요:"
        )
        return


# ============================================================
# /c1 - Claude 1 (대표 직접 소통)
# ============================================================

async def cmd_c1(update: Update, context: ContextTypes.DEFAULT_TYPE):
    ctx = resolve_tenant(update.effective_chat.id)
    s_c1, s_c2, s_paperclip, s_browser = get_panels(ctx)
    if not context.args:
        result = clean_terminal(read_screen(s_c1, 30))
        await update.message.reply_text(trunc(f"Luca 화면:\n\n{result}"))
        return
    text = " ".join(context.args)
    send_text(s_c1, text)
    context.user_data["last_claude"] = "c1"
    await update.message.reply_text(f"Luca에게 전달했어요.\n> {text}")


# ============================================================
# /ari - Ari에게 직접 지시
# ============================================================

async def cmd_ari(update: Update, context: ContextTypes.DEFAULT_TYPE):
    ctx = resolve_tenant(update.effective_chat.id)
    s_c1, s_c2, s_paperclip, s_browser = get_panels(ctx)
    if not context.args:
        result = clean_terminal(read_screen(s_c2, 30))
        await update.message.reply_text(trunc(f"Ari 화면:\n\n{result}"))
        return
    text = " ".join(context.args)
    log_c2("대표", text, ctx)
    set_last_board_input(text)
    send_text(s_c2, text)
    context.user_data["last_claude"] = "c2"


# ============================================================
# /ari_stop - Ari 작업 중단
# ============================================================

async def cmd_ari_stop(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/ari_stop - Ari 작업 중단"""
    ctx = resolve_tenant(update.effective_chat.id)
    _, s_c2, _, _ = get_panels(ctx)
    send_key(s_c2, "ctrl+c")
    await update.message.reply_text("Ari에 Ctrl+C 전송했어요.")


# ============================================================
# /p - Paperclip 통합 명령
# ============================================================

async def cmd_p(update: Update, context: ContextTypes.DEFAULT_TYPE):
    ctx = resolve_tenant(update.effective_chat.id)
    s_c1, s_c2, s_paperclip, s_browser = get_panels(ctx)
    if not context.args:
        await update.message.reply_text(
            "사용법:\n/p issues - 이슈 목록\n/p issue SOC-XX - 이슈 상세\n"
            "/p newissue - 이슈 생성\n/p inbox - 알림 확인\n/p heartbeat - 하트비트"
        )
        return

    sub = context.args[0].lower()

    # --- issues ---
    if sub == "issues":
        # Issues 페이지로 이동
        s = snap(s_browser)
        for line in s.split("\n"):
            if 'link "Issues"' in line:
                ref_match = re.search(r'\[ref=(e\d+)\]', line)
                if ref_match:
                    click(s_browser, ref_match.group(1))
                    await asyncio.sleep(2)
                    break
        s = snap(s_browser)
        issues = parse_issues(s)
        if not issues:
            await update.message.reply_text("이슈를 찾을 수 없어요.")
            return
        buttons = [[InlineKeyboardButton(
            f"{i['id']} {i['title'][:28]}", callback_data=f"issue:{i['id']}:{i['ref']}"
        )] for i in issues[:20]]
        await update.message.reply_text("이슈 목록:", reply_markup=InlineKeyboardMarkup(buttons))

    # --- issue SOC-XX ---
    elif sub == "issue" and len(context.args) > 1:
        soc_id = context.args[1].upper()
        s = snap(s_browser)
        for line in s.split("\n"):
            if soc_id in line:
                ref_match = re.search(r'\[ref=(e\d+)\]', line)
                if ref_match:
                    click(s_browser, ref_match.group(1))
                    await asyncio.sleep(2)
                    s = snap(s_browser)
                    for sline in s.split("\n"):
                        if "Scroll to bottom" in sline:
                            rm = re.search(r'\[ref=(e\d+)\]', sline)
                            if rm:
                                click(s_browser, rm.group(1))
                                await asyncio.sleep(1)
                                break
                    content = get_page_text(s_browser)
                    context.user_data["active_issue"] = soc_id
                    context.user_data["mode"] = "issue_comment"
                    parsed = parse_issue_page(content)
                    await update.message.reply_text(trunc(f"📌 {soc_id}\n\n{parsed}", 3500))
                    await update.message.reply_text("댓글 입력하면 등록해드릴게요.")
                    log_c2("시스템", f"{soc_id} 이슈 열람\n\n{trunc(content, 2000)}", ctx)
                    return
        await update.message.reply_text(f"{soc_id}를 찾을 수 없어요.")

    # --- newissue ---
    elif sub == "newissue":
        context.user_data["mode"] = "newissue_assignee"
        buttons = [[InlineKeyboardButton(a, callback_data=f"assignee:{a}")] for a in AGENTS]
        await update.message.reply_text("담당자를 선택해주세요:", reply_markup=InlineKeyboardMarkup(buttons))

    # --- inbox ---
    elif sub == "inbox":
        # Inbox 페이지로 이동
        cmux(["browser", "goto", "--surface", s_browser, "http://127.0.0.1:3100/SOC/inbox"])
        await asyncio.sleep(2)
        # Unread 탭 클릭
        s = snap(s_browser)
        for line in s.split("\n"):
            if '"Unread"' in line:
                ref_match = re.search(r'\[ref=(e\d+)\]', line)
                if ref_match:
                    click(s_browser, ref_match.group(1))
                    await asyncio.sleep(1)
                    break
        # Unread 내용 읽기 + 파싱
        content = get_page_text(s_browser)
        if not content or len(content.strip()) < 20:
            await update.message.reply_text("📬 미읽음 알림이 없습니다.")
            return
        parsed = parse_inbox(content)
        if not parsed:
            await update.message.reply_text("📬 미읽음 알림이 없습니다.")
            return
        await update.message.reply_text(trunc(f"📬 미읽음 알림:\n\n{parsed}", 3000))

    # --- heartbeat ---
    elif sub == "heartbeat":
        s = snap(s_browser)
        for line in s.split("\n"):
            if "heartbeat" in line.lower():
                ref_match = re.search(r'\[ref=(e\d+)\]', line)
                if ref_match:
                    click(s_browser, ref_match.group(1))
                    await update.message.reply_text("하트비트 활성화했어요!")
                    return
        send_text(s_paperclip, "heartbeat")
        await update.message.reply_text("Paperclip에 heartbeat 전달했어요.")


# ============================================================
# /iss - 이슈 목록 (단축)
# ============================================================

async def cmd_iss(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/iss [SOC-XX] - 이슈 목록 또는 상세"""
    ctx = resolve_tenant(update.effective_chat.id)
    s_c1, s_c2, s_paperclip, s_browser = get_panels(ctx)
    # /iss SOC-XX → 이슈 상세
    if context.args:
        soc_id = context.args[0].upper()
        s = snap(s_browser)
        # Issues 페이지가 아니면 이동
        if "ISSUES" not in s:
            for line in s.split("\n"):
                if 'link "Issues"' in line:
                    ref_match = re.search(r'\[ref=(e\d+)\]', line)
                    if ref_match:
                        click(s_browser, ref_match.group(1))
                        await asyncio.sleep(2)
                        s = snap(s_browser)
                        break
        for line in s.split("\n"):
            if soc_id in line:
                ref_match = re.search(r'\[ref=(e\d+)\]', line)
                if ref_match:
                    click(s_browser, ref_match.group(1))
                    await asyncio.sleep(2)
                    s = snap(s_browser)
                    for sline in s.split("\n"):
                        if "Scroll to bottom" in sline:
                            rm = re.search(r'\[ref=(e\d+)\]', sline)
                            if rm:
                                click(s_browser, rm.group(1))
                                await asyncio.sleep(1)
                                break
                    content = get_page_text(s_browser)
                    context.user_data["active_issue"] = soc_id
                    context.user_data["mode"] = "issue_comment"
                    parsed = parse_issue_page(content)
                    await update.message.reply_text(trunc(f"📌 {soc_id}\n\n{parsed}", 3500))
                    await update.message.reply_text("댓글 입력하면 등록해드릴게요.")
                    log_c2("시스템", f"{soc_id} 이슈 열람\n\n{trunc(content, 2000)}", ctx)
                    return
        await update.message.reply_text(f"{soc_id}를 찾을 수 없어요.")
        return

    # /iss → 이슈 목록
    s = snap(s_browser)
    if "ISSUES" not in s:
        for line in s.split("\n"):
            if 'link "Issues"' in line:
                ref_match = re.search(r'\[ref=(e\d+)\]', line)
                if ref_match:
                    click(s_browser, ref_match.group(1))
                    await asyncio.sleep(2)
                    break
        s = snap(s_browser)

    issues = parse_issues(s)
    if not issues:
        await update.message.reply_text("이슈를 찾을 수 없어요.")
        return
    buttons = [[InlineKeyboardButton(
        f"{i['id']} {i['title'][:28]}", callback_data=f"issue:{i['id']}:{i['ref']}"
    )] for i in issues[:20]]
    await update.message.reply_text("이슈 목록:", reply_markup=InlineKeyboardMarkup(buttons))


# ============================================================
# /newiss - 새 이슈 생성
# ============================================================

async def cmd_newiss(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["mode"] = "newissue_assignee"
    buttons = [[InlineKeyboardButton(a, callback_data=f"assignee:{a}")] for a in AGENTS]
    await update.message.reply_text("담당자를 선택해주세요:", reply_markup=InlineKeyboardMarkup(buttons))


# ============================================================
# /inbox - 알림 확인
# ============================================================

async def cmd_inbox(update: Update, context: ContextTypes.DEFAULT_TYPE):
    ctx = resolve_tenant(update.effective_chat.id)
    s_c1, s_c2, s_paperclip, s_browser = get_panels(ctx)
    # Inbox 페이지로 URL 직접 이동
    cmux(["browser", "goto", "--surface", s_browser, "http://127.0.0.1:3100/SOC/inbox"])
    await asyncio.sleep(2)
    # Unread 탭 클릭
    s = snap(s_browser)
    for line in s.split("\n"):
        if '"Unread"' in line:
            ref_match = re.search(r'\[ref=(e\d+)\]', line)
            if ref_match:
                click(s_browser, ref_match.group(1))
                await asyncio.sleep(1)
                break
    # Unread 내용 읽기 + 파싱
    content = get_page_text(s_browser)
    if not content or len(content.strip()) < 20:
        await update.message.reply_text("📬 미읽음 알림이 없습니다.")
        return
    parsed = parse_inbox(content)
    if not parsed:
        await update.message.reply_text("📬 미읽음 알림이 없습니다.")
        return
    await update.message.reply_text(trunc(f"📬 미읽음 알림:\n\n{parsed}", 3000))


def _translate_agent_text(text):
    """에이전트 영문 댓글을 한글로 규칙 기반 번역"""
    replacements = [
        # 상태/완료
        (r'\bDone\.', '완료.'),
        (r'\bCompleted\.', '완료.'),
        (r'\bFinished\.', '완료.'),
        (r'\bUpdated\.', '업데이트 완료.'),
        # Board 관련
        (r"Board's headcount change processed:", '보드 인원 변경 반영:'),
        (r"Board's change processed:", '보드 변경사항 반영:'),
        (r"Board requested", '보드 요청'),
        (r"Board's request", '보드 요청'),
        (r'\bboard\b', '보드'),
        # 문서/Plan
        (r'Plan updated to (v\d+)', r'Plan \1로 업데이트'),
        (r'updated to (v\d+)', r'\1로 업데이트'),
        (r'with new headcount', '새 인원수 반영'),
        (r'cost simulation', '비용 시뮬레이션'),
        # 알림/통보
        (r'(\w+) notified on (SOC-\d+) to update deliverables', r'\1에게 \2 산출물 업데이트 알림'),
        (r'(\w+) notified on (SOC-\d+)', r'\1에게 \2 알림'),
        (r'notified (\w+) on (SOC-\d+)', r'\1에게 \2 알림'),
        # 이슈 상태
        (r'(SOC-\d+) closed\.', r'\1 완료 처리.'),
        (r'(SOC-\d+) reopened\.', r'\1 재오픈.'),
        (r'(SOC-\d+) was reopened via a comment\.', r'\1이 댓글로 재오픈됨.'),
        # 변경 내역
        (r'change processed', '변경 반영'),
        (r'changes applied', '변경사항 적용'),
        (r'All dates updated', '모든 날짜 업데이트 완료'),
        (r'dates updated', '날짜 업데이트'),
        (r'headcount change', '인원 변경'),
        # 액션
        (r'Next action:', '다음 액션:'),
        (r'Remaining action:', '남은 액션:'),
        (r'No other assignments\.', '다른 할당 없음.'),
        (r'deliverables', '산출물'),
        (r'updated successfully', '업데이트 완료'),
        # 리뷰/이벤트
        (r'event period', '이벤트 기간'),
        (r'review period', '리뷰 기간'),
        (r'submission period', '접수 기간'),
        (r'judging period', '심사 기간'),
        (r'results announcement', '결과 발표'),
        (r'benefits structure', '혜택 구조'),
        (r'tier', '등급'),
        (r'unchanged', '변동 없음'),
        # 문서/업데이트
        (r'updated the plan', '플랜 업데이트 완료'),
        (r'document updated', '문서 업데이트 완료'),
        (r'all dates updated', '모든 날짜 업데이트 완료'),
        (r'reflected in', '에 반영'),
        (r'applied to', '에 적용'),
        (r'blog post', '블로그 포스트'),
        (r'card news', '카드뉴스'),
        (r'Google Form', '구글폼'),
        (r'landing page', '랜딩페이지'),
        (r'onboarding guide', '온보딩 가이드'),
        # 인원/비용
        (r'total cost', '총 비용'),
        (r'cost simulation', '비용 시뮬레이션'),
        (r'headcount', '인원수'),
        (r'selected\b', '선정'),
        # 상태
        (r'\bclosed\b', '완료 처리'),
        (r'\breopened\b', '재오픈'),
        (r'\bin progress\b', '진행 중'),
        (r'\bpending\b', '대기 중'),
        (r'\bblocked\b', '차단됨'),
        # 일반
        (r'\bsucceeded\b', '성공'),
        (r'\bfailed\b', '실패'),
        (r'\bprocessed\b', '처리됨'),
        (r'\brevised\b', '수정됨'),
        (r'\bconfirmed\b', '확인됨'),
        (r'\bcompleted\b', '완료'),
        (r'\bapproved\b', '승인'),
        (r'\brejected\b', '거부'),
        (r'\bscheduled\b', '예정'),
        (r'\bremaining\b', '남은'),
        (r'\brequired\b', '필요'),
        (r'\baction\b', '액션'),
        (r'\bsummary\b', '요약'),
        (r'\bchanges\b', '변경사항'),
        (r'\bapplied\b', '적용됨'),
        (r'\bnotified\b', '알림됨'),
        (r'\bcheck\b', '확인'),
        (r'\breview\b', '리뷰'),
        (r'\bupdate\b', '업데이트'),
    ]
    result = text
    for pattern, replacement in replacements:
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
    return result


def parse_issue_page(raw):
    """이슈 페이지 raw 텍스트를 '누가/언제/무엇' 포맷으로 파싱"""
    lines = raw.strip().split("\n")

    # UI 노이즈 제거 대상
    skip_exact = {
        "Comments", "Sub-issues", "Activity", "Leave a comment...", "Re-open",
        "Comment", "Idle", "Upload attachment", "New document", "Done",
        "succeeded", "failed", "", "CE", "CM", "PM", "A2", "YO", "Me",
    }

    # Run 상태 노이즈 (running 시 나타나는 UI 요소 + 에이전트 내부 동작 로그)
    run_noise = {"running", "Stop", "Open run", "STDOUT", "Live Runs", "LIVE RUNS",
                 "Streamed with the same transcript UI used on the full run detail page."}
    # 에이전트 내부 동작 패턴 (영문 사고/실행 로그)
    run_noise_patterns = [
        r'^EXECUTED \d+ COMMAND',
        r'^EXECUTED COMMAND',
        r'^SYSTEMrun\s',
        r'^SYSTEM\s',
        r'^INIT\s*model',
        r'^model\s+claude',
        r'^session\s+[0-9a-f]',
        r'^Now (let me|close|notify|update|check)',
        r'^Let me (read|check|update|notify|close)',
        r'^Plan updated to',
        r'^Exiting heartbeat',
        r'^No other assignments',
        r'^Executed \d+ command',
    ]

    # 에이전트 이름 매핑
    agent_names = {"CEO", "CMO", "Content Marketer", "Performance Marketer",
                   "Ad Sales Manager", "Ad Sales Manager 2", "You"}

    result_lines = []
    comments = []
    current_author = None
    current_time = None
    current_body = []
    in_comments = False
    issue_title = ""
    issue_desc = []

    for i, line in enumerate(lines):
        stripped = line.strip()

        # Comments & Runs 섹션 시작
        if re.match(r'^Comments & Runs', stripped):
            in_comments = True
            continue

        if not in_comments:
            # 이슈 본문 영역
            if stripped in skip_exact:
                continue
            if re.match(r'^SOC-\d+$', stripped):
                continue
            # 프로젝트명 (Onboarding, 광고주센터 기획, 컨텐츠 기획)
            if stripped in {"Onboarding", "광고주센터 기획", "컨텐츠 기획"}:
                continue
            # Properties 영역
            if re.match(r'^(Status|Priority|Labels|Assignee|Project|Created|Started|Completed|Updated)', stripped):
                continue
            if stripped:
                if not issue_title:
                    issue_title = stripped
                else:
                    issue_desc.append(stripped)
            continue

        # Comments 영역 파싱
        if stripped in skip_exact:
            continue

        # Run ID (hex)
        if re.match(r'^[0-9a-f]{7,8}$', stripped):
            continue
        # "Run" 단독
        if stripped == "Run":
            continue
        # "run xxxxx" 참조
        if re.match(r'^run [0-9a-f]{7,8}$', stripped):
            continue

        # 에이전트 이름 감지
        if stripped in agent_names:
            # 이전 댓글 저장
            if current_author and current_body:
                body_text = "\n".join(current_body).strip()
                if body_text:
                    comments.append(f"💬 {current_author} ({current_time}):\n{body_text}")
            current_author = stripped
            current_body = []
            current_time = None
            continue

        # 타임스탬프
        time_match = re.match(r'^(Apr|Mar|Feb|Jan|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+,\s+\d{4}\s+at\s+\d+:\d+\s+(AM|PM)$', stripped)
        if time_match:
            current_time = stripped
            continue

        # 댓글 본문 (run 노이즈 필터)
        if current_author:
            if stripped in run_noise:
                continue
            # 에이전트 내부 동작 패턴 필터
            is_noise = False
            for pat in run_noise_patterns:
                if re.match(pat, stripped, re.IGNORECASE):
                    is_noise = True
                    break
            if is_noise:
                continue
            current_body.append(stripped)

    # 마지막 댓글
    if current_author and current_body:
        body_text = "\n".join(current_body).strip()
        if body_text:
            comments.append(f"💬 {current_author} ({current_time}):\n{body_text}")

    # running 상태 댓글을 친근한 메시지로 변환
    cleaned_comments = []
    for c in comments:
        # 본문이 비었거나 running 관련만 남은 경우
        parts = c.split(":\n", 1)
        if len(parts) == 2:
            header, body = parts
            body_stripped = body.strip()
            if not body_stripped:
                # 에이전트 이름 추출
                agent_match = re.search(r'💬 (\S+)', header)
                agent = agent_match.group(1) if agent_match else "에이전트"
                cleaned_comments.append(f"🏃 {agent}가 일하기 시작했어요.")
            else:
                cleaned_comments.append(c)
        else:
            cleaned_comments.append(c)
    # 영문 → 한글 규칙 기반 번역
    translated_comments = []
    for c in cleaned_comments:
        translated_comments.append(_translate_agent_text(c))
    comments = translated_comments

    # 결과 조합
    output = []
    if issue_title:
        output.append(issue_title)
    if issue_desc:
        desc = "\n".join(issue_desc[:5])  # 설명은 최대 5줄
        if len(issue_desc) > 5:
            desc += "\n..."
        output.append(desc)

    if comments:
        output.append("")
        output.append(f"--- 댓글 ({len(comments)}건) ---")
        for c in comments:
            output.append("")
            output.append(c)

    return "\n".join(output).strip() if output else raw


def _is_within_24h(time_str):
    """시간 문자열이 24시간 이내인지 판별 (Xm ago, Xh ago, Xd ago 패턴)"""
    if not time_str:
        return False
    m = re.match(r'(\d+)\s*(m|h|d|min|hour|day)', time_str, re.IGNORECASE)
    if m:
        val, unit = int(m.group(1)), m.group(2).lower()
        if unit in ('m', 'min'):
            return True  # 분 단위는 항상 24h 이내
        if unit in ('h', 'hour'):
            return val <= 24
        if unit in ('d', 'day'):
            return val < 1
    # "just now", "Xm ago", "Xh ago" 등
    if "just now" in time_str or "now" in time_str:
        return True
    # "1d ago" 이상은 제외
    return False


def parse_inbox(raw):
    """Inbox raw 텍스트를 깔끔한 알림 목록으로 파싱"""
    lines = raw.strip().split("\n")
    # UI 요소 제거
    skip_words = {"Recent", "Unread", "All", "Mark all as read", "Retry", "failed", ""}
    items = []
    current = None
    for line in lines:
        stripped = line.strip()
        if stripped in skip_words:
            continue
        # SOC-XX 이슈 댓글 알림
        soc_match = re.match(r'^(SOC-\d+)$', stripped)
        if soc_match:
            if current:
                current["id"] = soc_match.group(1)
            continue
        # 시간 정보
        time_match = re.match(r'^(\d+[mhd]\s+ago|\d+ (minutes?|hours?|days?) ago)$', stripped)
        if time_match:
            if current:
                current["time"] = stripped
                items.append(current)
                current = None
            continue
        # Failed run 알림
        if stripped.startswith("Failed run"):
            if current and "title" in current:
                items.append(current)
            current = {"title": stripped, "type": "error"}
            continue
        # Claude exited 에러 메시지
        if stripped.startswith("Claude exited"):
            if current:
                current["detail"] = stripped
            continue
        # Hire Agent: 에이전트명
        hire_match = re.match(r'^Hire Agent:\s*(.+?)(?:\s*—\s*)?$', stripped)
        if hire_match:
            if current and "title" in current:
                items.append(current)
            current = {"title": hire_match.group(1).strip(), "type": "approval"}
            continue
        if stripped == "Approved":
            if current and current.get("type") == "approval":
                current["approved"] = True
            continue
        if stripped.startswith("requested by"):
            requester = stripped.replace("requested by", "").strip()
            if current:
                current["requester"] = requester
                items.append(current)
                current = None
            continue
        if stripped.startswith("updated"):
            if current:
                current["time"] = stripped
                items.append(current)
                current = None
            continue
        # commented 시간
        commented_match = re.match(r'^commented\s+(.+)$', stripped)
        if commented_match:
            if current:
                current["time"] = commented_match.group(1)
                items.append(current)
                current = None
            continue
        # 이슈 제목 또는 기타 텍스트
        if not current:
            current = {"title": stripped}
        elif "title" in current and "id" not in current and "time" not in current:
            # 이미 제목이 있으면 추가 정보
            pass

    if current and "title" in current:
        items.append(current)

    if not items:
        return ""

    # 포맷팅: 에러와 이슈 분리
    errors = [i for i in items if i.get("type") == "error"]
    comments = [i for i in items if i.get("type") != "error" and i.get("type") != "approval"]
    approvals = [i for i in items if i.get("type") == "approval"]

    result = []
    if errors:
        result.append(f"❌ 실패 {len(errors)}건")
        for e in errors:
            detail = e.get("detail", "").replace("Claude exited with code 1: ", "")
            result.append(f"  • {e['title']} — {detail}")
        result.append("")
    if comments:
        # 24시간 이내 댓글만 필터
        recent_comments = [c for c in comments if _is_within_24h(c.get("time", ""))]
        if recent_comments:
            result.append("💬 이슈 댓글:")
            for c in recent_comments:
                soc = c.get("id", "")
                time_str = c.get("time", "")
                title = c.get("title", "")
                if soc:
                    result.append(f"  • {soc} {title} — {time_str}")
                else:
                    result.append(f"  • {title} — {time_str}")
            result.append("")
    if approvals:
        result.append(f"✅ 승인 완료 {len(approvals)}건")
        for a in approvals:
            result.append(f"  • {a.get('title', '')} 채용 승인")

    return "\n".join(result).strip()


# ============================================================
# /heartbeat - 하트비트
# ============================================================

async def cmd_heartbeat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    ctx = resolve_tenant(update.effective_chat.id)
    s_c1, s_c2, s_paperclip, s_browser = get_panels(ctx)
    s = snap(s_browser)
    for line in s.split("\n"):
        if "heartbeat" in line.lower():
            ref_match = re.search(r'\[ref=(e\d+)\]', line)
            if ref_match:
                click(s_browser, ref_match.group(1))
                await update.message.reply_text("하트비트 활성화했어요!")
                return
    send_text(s_paperclip, "heartbeat")
    await update.message.reply_text("Paperclip에 heartbeat 전달했어요.")


# ============================================================
# 알림 ON/OFF
# ============================================================

NOTI_STATE_PATH = os.path.expanduser("~/Desktop/claude-3/c2/.tg_noti_enabled")

def _save_noti_state(enabled: bool):
    try:
        os.makedirs(os.path.dirname(NOTI_STATE_PATH), exist_ok=True)
        with open(NOTI_STATE_PATH, "w") as f:
            f.write("1" if enabled else "0")
    except Exception as e:
        logger.error(f"Noti state save error: {e}")

def _load_noti_state() -> bool:
    try:
        if os.path.exists(NOTI_STATE_PATH):
            with open(NOTI_STATE_PATH, "r") as f:
                return f.read().strip() == "1"
    except Exception as e:
        logger.error(f"Noti state load error: {e}")
    return True

def _noti_text_and_kb(enabled: bool):
    if enabled:
        text = "🔔 알림 *켜짐*\n\n자동 푸시가 동작 중이에요.\n아래 버튼을 누르면 끌 수 있어요."
        btn_label = "🔕 알림 끄기"
    else:
        text = "🔕 알림 *꺼짐*\n\n자동 푸시가 멈춰있어요.\n아래 버튼을 누르면 다시 켜져요."
        btn_label = "🔔 알림 켜기"
    kb = InlineKeyboardMarkup([[InlineKeyboardButton(btn_label, callback_data="noti:toggle")]])
    return text, kb

async def cmd_mute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.bot_data["chat_id"] = update.effective_chat.id
    enabled = context.bot_data.get("notifications_enabled", True)
    text, kb = _noti_text_and_kb(enabled)
    await update.message.reply_text(text, reply_markup=kb, parse_mode="Markdown")


# ============================================================
# 파일/이미지 전송
# ============================================================

ALLOWED_SEND_ROOTS = [
    os.path.expanduser("~/Documents/12_socian_mycrew"),
    os.path.expanduser("~/ari-workspace"),
]

def _resolve_send_path(raw: str):
    if not raw:
        return None, "파일 경로를 입력해주세요."
    path = os.path.abspath(os.path.expanduser(raw.strip().strip('"').strip("'")))
    if not os.path.exists(path):
        return None, f"파일을 찾을 수 없어요: {path}"
    if not os.path.isfile(path):
        return None, "디렉토리가 아닌 파일 경로를 주세요."
    if not any(path.startswith(root) for root in ALLOWED_SEND_ROOTS):
        return None, f"허용된 폴더 밖이에요. 허용 경로: {', '.join(ALLOWED_SEND_ROOTS)}"
    return path, None

async def cmd_sendimg(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.bot_data["chat_id"] = update.effective_chat.id
    raw = " ".join(context.args) if context.args else ""
    path, err = _resolve_send_path(raw)
    if err:
        await update.message.reply_text(f"⚠️ {err}")
        return
    size = os.path.getsize(path)
    if size > 10 * 1024 * 1024:
        await update.message.reply_text(f"⚠️ 사진은 10MB까지예요 (현재 {size//1024//1024}MB). /sendfile 써주세요.")
        return
    try:
        with open(path, "rb") as f:
            await update.message.reply_photo(photo=f, caption=os.path.basename(path))
    except Exception as e:
        await update.message.reply_text(f"⚠️ 전송 실패: {e}")

async def cmd_sendfile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.bot_data["chat_id"] = update.effective_chat.id
    raw = " ".join(context.args) if context.args else ""
    path, err = _resolve_send_path(raw)
    if err:
        await update.message.reply_text(f"⚠️ {err}")
        return
    size = os.path.getsize(path)
    if size > 50 * 1024 * 1024:
        await update.message.reply_text(f"⚠️ 파일은 50MB까지예요 (현재 {size//1024//1024}MB).")
        return
    try:
        with open(path, "rb") as f:
            await update.message.reply_document(document=f, filename=os.path.basename(path))
    except Exception as e:
        await update.message.reply_text(f"⚠️ 전송 실패: {e}")


# ============================================================
# 일반 메시지 처리
# ============================================================

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    ctx = resolve_tenant(chat_id)
    s_c1, s_c2, s_paperclip, s_browser = get_panels(ctx)

    # 모든 메시지에서 chat_id 갱신 (모니터링용)
    context.bot_data["chat_id"] = chat_id
    # chat_id를 파일에 저장 (C2 직접 텔레그램 전송용)
    try:
        with open(os.path.expanduser("~/Desktop/claude-3/c2/.tg_chat_id"), "w") as f:
            f.write(str(chat_id))
    except Exception:
        pass
    # 테넌트별 chat_id 목록 관리 (모니터링에서 사용)
    active_chats = context.bot_data.setdefault("active_chats", {})
    active_chats[chat_id] = {"ctx": ctx, "panels": (s_c1, s_c2, s_paperclip, s_browser)}

    text = update.message.text
    if not text:
        return

    # 일일 사용량 제한 체크
    if not check_daily_limit(ctx):
        limit = ctx.daily_limit if ctx else DAILY_COMMAND_LIMIT
        await update.message.reply_text(
            f"오늘 사용 한도({limit}회)에 도달했습니다. 내일 다시 이용해주세요."
        )
        return

    mode = context.user_data.get("mode")
    active_issue = context.user_data.get("active_issue")

    # --- 새 이슈 제목 입력 ---
    if mode == "newissue_title":
        title = text
        assignee = context.user_data.get("new_issue_assignee", "")
        project = context.user_data.get("new_issue_project", "")

        s = snap(s_browser)
        for line in s.split("\n"):
            if '"New Issue"' in line or '"New issue"' in line:
                ref_match = re.search(r'\[ref=(e\d+)\]', line)
                if ref_match:
                    click(s_browser, ref_match.group(1))
                    await asyncio.sleep(2)
                    break

        s = snap(s_browser)
        for line in s.split("\n"):
            if "textbox" in line.lower() or "input" in line.lower():
                ref_match = re.search(r'\[ref=(e\d+)\]', line)
                if ref_match:
                    fill(s_browser, ref_match.group(1), title)
                    break

        await asyncio.sleep(1)
        s = snap(s_browser)
        for line in s.split("\n"):
            if assignee.lower() in line.lower():
                ref_match = re.search(r'\[ref=(e\d+)\]', line)
                if ref_match:
                    click(s_browser, ref_match.group(1))
                    break

        await asyncio.sleep(1)
        s = snap(s_browser)
        for line in s.split("\n"):
            if project in line:
                ref_match = re.search(r'\[ref=(e\d+)\]', line)
                if ref_match:
                    click(s_browser, ref_match.group(1))
                    break

        await asyncio.sleep(1)
        s = snap(s_browser)
        for line in s.split("\n"):
            if "create" in line.lower() and "issue" in line.lower():
                ref_match = re.search(r'\[ref=(e\d+)\]', line)
                if ref_match:
                    click(s_browser, ref_match.group(1))
                    break

        context.user_data["mode"] = None
        await update.message.reply_text(f"✅ 이슈 생성!\n제목: {title}\n담당: {assignee}\n프로젝트: {project}")
        return

    # --- 이슈 댓글 모드 → Ari에 전달 ---
    if mode == "issue_comment" and active_issue:
        log_c2("대표", f"[{active_issue} 댓글] {text}", ctx)
        send_text(s_c2, f"{active_issue} 이슈에 다음 내용을 댓글로 등록해줘. Paperclip 브라우저({s_browser})에서 댓글 입력창을 찾아서 입력하고 전송 버튼을 눌러줘: {text}")
        await update.message.reply_text(f"{active_issue} 댓글 등록 중...")
        context.user_data["mode"] = None

        # 클로저에서 사용할 패널 캡처
        _s_c2 = s_c2
        _s_browser = s_browser
        _ctx = ctx

        async def _watch_issue_reply(app_ref, issue, chat):
            """댓글 등록 후 live 감지 → 이슈 페이지에서 최신 상태 파싱 → 텔레그램 보고"""
            import re as _re
            # C2 작업 완료 대기
            await wait_c2_response(max_wait=45, surface_c2=_s_c2)
            try:
                # 이슈 페이지로 이동하여 댓글 수 기준선 확인
                cmux(["browser", "goto", "--surface", _s_browser, f"http://127.0.0.1:3100/SOC/issues/{issue}"])
                await asyncio.sleep(3)
                content = get_page_text(_s_browser)
                count_text = cmux(["browser", "eval", "--surface", _s_browser,
                    "const h=[...document.querySelectorAll('*')].find(e=>e.textContent.match(/Comments & Runs \\(\\d+\\)/));h?h.textContent.trim():'0'"])
                m = _re.search(r'\((\d+)\)', count_text)
                baseline = int(m.group(1)) if m else 0

                # 댓글이 실제로 등록되었는지 확인
                if issue.replace("-", "") in content.replace("-", "") or "You" in content:
                    await app_ref.bot.send_message(chat_id=chat, text=f"✅ {issue} 댓글 등록 완료")
                else:
                    await app_ref.bot.send_message(chat_id=chat, text=f"⚠️ {issue} 댓글 등록 확인 필요")

                # 10분간 15초 간격으로 live 상태 감시
                for _ in range(40):
                    await asyncio.sleep(15)
                    # 이슈 페이지 새로고침
                    cmux(["browser", "goto", "--surface", _s_browser, f"http://127.0.0.1:3100/SOC/issues/{issue}"])
                    await asyncio.sleep(3)
                    new_content = get_page_text(_s_browser)
                    count_text2 = cmux(["browser", "eval", "--surface", _s_browser,
                        "const h=[...document.querySelectorAll('*')].find(e=>e.textContent.match(/Comments & Runs \\(\\d+\\)/));h?h.textContent.trim():'0'"])
                    m2 = _re.search(r'\((\d+)\)', count_text2)
                    current = int(m2.group(1)) if m2 else 0

                    if current > baseline:
                        # 새 활동 감지 → 이슈 페이지에서 최신 댓글 파싱하여 보고
                        is_running = "running" in new_content.lower() or "Live Run" in new_content or "LIVE RUNS" in new_content

                        if is_running:
                            # Live run 시작 → 에이전트 이름 찾아서 보고
                            agent_found = None
                            for agent_name in ["CEO", "CMO", "Content Marketer", "Performance Marketer", "Ad Sales Manager 2", "Ad Sales Manager"]:
                                # running 근처에 에이전트 이름이 있는지 확인
                                if _re.search(agent_name + r'.*running|running.*' + agent_name, new_content, _re.IGNORECASE):
                                    agent_found = agent_name
                                    break
                                # 또는 Live Runs 섹션 근처
                                if _re.search(agent_name + r'.*Live|Live.*' + agent_name, new_content):
                                    agent_found = agent_name
                                    break
                            if not agent_found:
                                # 마지막 에이전트 이름 추출
                                for agent_name in ["CEO", "CMO", "Content Marketer", "Performance Marketer", "Ad Sales Manager 2", "Ad Sales Manager"]:
                                    if agent_name in new_content:
                                        agent_found = agent_name
                            msg = f"🏃 {agent_found}가 보드님의 지시에 일을 시작했어요." if agent_found else f"🏃 에이전트가 보드님의 지시에 일을 시작했어요."
                            await app_ref.bot.send_message(chat_id=chat, text=f"📌 {issue}\n{msg}")
                            baseline = current
                            continue

                        # 완료된 댓글 → 내용 파싱하여 보고
                        parsed = parse_issue_page(new_content)
                        if "--- 댓글" in parsed:
                            comments_section = parsed.split("--- 댓글")[1]
                            last_comments = comments_section.split("💬 ")
                            if len(last_comments) >= 2:
                                latest = "💬 " + last_comments[-1].strip()
                                # "일하기 시작했어요" 메시지는 이미 보냈으므로 스킵
                                if "일하기 시작했어요" not in latest:
                                    await app_ref.bot.send_message(
                                        chat_id=chat,
                                        text=trunc(f"📌 {issue} 결과:\n\n{latest}", 3000)
                                    )
                        # 로컬 캐시 갱신
                        import subprocess as _sp
                        cache_dirs = {"onboarding": ["1","2","3","4","7","9","10","11","12","17"],
                                      "광고주센터": ["8","13","15","19","20"],
                                      "컨텐츠기획": ["5","6","14","16","18","21","22","23"]}
                        issue_num = issue.replace("SOC-", "")
                        for d, nums in cache_dirs.items():
                            if issue_num in nums:
                                _sp.run(["bash", "-c", f"cmux browser get --surface {_s_browser} text main > '/Users/alex-gracy/Desktop/claude-3/c2/paper-socian-txt/{d}/{issue}.md' 2>/dev/null"], timeout=10)
                                break
                        # inbox badge 갱신
                        badge_text = cmux(["browser", "eval", "--surface", _s_browser,
                            "const links=[...document.querySelectorAll('a')];const il=links.find(a=>a.textContent.includes('Inbox'));il?il.textContent.trim():'Inbox0'"])
                        badge_match = _re.search(r'Inbox\s*(\d+)', badge_text)
                        app_ref.bot_data["last_inbox_count"] = int(badge_match.group(1)) if badge_match else 0
                        baseline = current
                        # running 아니면 감시 종료
                        if "running" not in new_content.lower() and "Live" not in new_content:
                            break
            except Exception as e:
                logger.error(f"Watch issue error: {e}")

        asyncio.create_task(_watch_issue_reply(context.application, active_issue, chat_id))
        return

    # --- 기본: Ari에 전달 ---
    log_c2("대표", text, ctx)
    set_last_board_input(text)
    send_text(s_c2, text)
    context.user_data["last_claude"] = "c2"
    # Ari가 tg_send.sh로 직접 텔레그램에 응답함 — Bridge는 전달만


# ============================================================
# 이슈 파싱
# ============================================================

def parse_issues(snapshot):
    issues = []
    seen = set()
    for line in snapshot.split("\n"):
        match = re.search(r'(SOC-\d+)', line)
        if match:
            soc_id = match.group(1)
            if soc_id in seen:
                continue
            seen.add(soc_id)
            title_match = re.search(r'link "(.+?)(?:\s+SOC-\d+)', line)
            title = title_match.group(1).strip() if title_match else soc_id
            ref_match = re.search(r'\[ref=(e\d+)\]', line)
            if ref_match:
                issues.append({"id": soc_id, "title": title, "ref": ref_match.group(1)})
    return issues


# ============================================================
# /start
# ============================================================

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    ctx = resolve_tenant(chat_id)
    s_c1, s_c2, s_paperclip, s_browser = get_panels(ctx)

    # chat_id 저장 (모니터링용)
    context.bot_data["chat_id"] = chat_id
    active_chats = context.bot_data.setdefault("active_chats", {})
    active_chats[chat_id] = {"ctx": ctx, "panels": (s_c1, s_c2, s_paperclip, s_browser)}

    logger.info(f"Chat ID set: {chat_id}, tenant: {ctx.company_id if ctx else 'default'}")

    # 테넌트 정보 표시
    tenant_info = ""
    if ctx:
        remaining = ctx.get_remaining()
        tenant_info = f"\n🏢 회사: {ctx.name} ({ctx.company_id})\n📊 남은 사용량: {remaining}\n"
    else:
        tenant_info = f"\n⚠️ 미등록 Chat ID ({chat_id}). 기본 설정으로 연결됩니다.\n"

    await update.message.reply_text(
        f"Cmux ChatOps v3 연결 완료!{tenant_info}\n"
        "📌 AI 비서\n"
        "  /luca - MYC CTO\n"
        "  /ari [텍스트] - Ari에게 직접 지시\n"
        "  /ari_stop - Ari 작업 중단\n\n"
        "📌 AI 회사\n"
        "  /iss - 이슈 목록\n"
        "  /iss SOC-XX - 이슈 상세\n"
        "  /newiss - 이슈 생성\n"
        "  /inbox - 알림 확인\n"
        "  /heartbeat - 하트비트\n\n"
        "일반 메시지 → Ari에 전달\n"
        "Claude 승인 요청 → 자동 버튼 알림"
    )


# ============================================================
# 메인
# ============================================================

async def post_init(app):
    """봇 시작 후 명령어 목록 등록 + 모니터링 시작"""
    # 텔레그램 명령어 자동완성 등록
    commands = [
        BotCommand("luca", "MYC CTO"),
        BotCommand("ari", "Ari에게 직접 지시"),
        BotCommand("ari_stop", "Ari 작업 중단"),
        BotCommand("iss", "이슈 목록 / 상세 (SOC-XX)"),
        BotCommand("newiss", "이슈 생성"),
        BotCommand("inbox", "알림 확인"),
        BotCommand("heartbeat", "하트비트 활성화"),
        BotCommand("mute", "🔕 자동 푸시 ON/OFF 토글"),
        BotCommand("sendimg", "이미지 전송 (압축)"),
        BotCommand("sendfile", "파일 원본 전송"),
        BotCommand("start", "도움말"),
    ]
    await app.bot.set_my_commands(commands)
    logger.info("Bot commands registered")

    # 저장된 chat_id 복구 (재시작 시 /start 없이 자동 연결)
    try:
        chat_id_path = os.path.expanduser("~/Desktop/claude-3/c2/.tg_chat_id")
        if os.path.exists(chat_id_path):
            with open(chat_id_path, "r") as f:
                saved_chat_id = int(f.read().strip())
            app.bot_data["chat_id"] = saved_chat_id
            ctx = resolve_tenant(saved_chat_id)
            s_c1, s_c2, s_paperclip, s_browser = get_panels(ctx)
            active_chats = app.bot_data.setdefault("active_chats", {})
            active_chats[saved_chat_id] = {"ctx": ctx, "panels": (s_c1, s_c2, s_paperclip, s_browser)}
            logger.info(f"Chat ID restored from file: {saved_chat_id}")
    except Exception as e:
        logger.error(f"Chat ID restore error: {e}")

    # 알림 ON/OFF 상태 복구
    app.bot_data["notifications_enabled"] = _load_noti_state()
    logger.info(f"Notifications enabled: {app.bot_data['notifications_enabled']}")

    # 화면 모니터링 시작
    global _monitor_task
    _monitor_task = asyncio.create_task(monitor_claude_screens(app))
    logger.info("Screen monitor started")


def main():
    app = ApplicationBuilder().token(BOT_TOKEN).post_init(post_init).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("luca", cmd_c1))
    app.add_handler(CommandHandler("ari", cmd_ari))
    app.add_handler(CommandHandler("ari_stop", cmd_ari_stop))
    app.add_handler(CommandHandler("iss", cmd_iss))
    app.add_handler(CommandHandler("newiss", cmd_newiss))
    app.add_handler(CommandHandler("inbox", cmd_inbox))
    app.add_handler(CommandHandler("heartbeat", cmd_heartbeat))
    app.add_handler(CommandHandler("sendimg", cmd_sendimg))
    app.add_handler(CommandHandler("sendfile", cmd_sendfile))
    app.add_handler(CommandHandler("mute", cmd_mute))
    app.add_handler(CallbackQueryHandler(callback_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("Cmux Telegram Bridge v3 started!")
    app.run_polling()


if __name__ == "__main__":
    main()
