#!/usr/bin/env python3
"""
companyId 기반 데이터 격리 미들웨어

텔레그램 Chat ID → companyId 매핑을 통해
모든 파일 기반 데이터 접근을 회사별로 격리합니다.

사용법:
    from tenant_middleware import TenantMiddleware

    mw = TenantMiddleware("/path/to/data")
    mw.register_company("comp_001", name="소시안", chat_ids=[12345])

    ctx = mw.get_context(chat_id=12345)
    ctx.log_path          # /path/to/data/comp_001/logs/
    ctx.inbox_c1_path     # /path/to/data/comp_001/inbox_c1/
    ctx.check_daily_limit()  # True/False
"""

from __future__ import annotations

import json
import os
import threading
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional, Union


class TenantNotFoundError(Exception):
    """chat_id에 매핑된 회사가 없을 때"""
    pass


class AccessDeniedError(Exception):
    """다른 회사 데이터 접근 시도 시"""
    pass


class TenantRegistry:
    """회사 등록소 — tenants.json 기반 CRUD"""

    def __init__(self, config_path: Path):
        self._config_path = config_path
        self._lock = threading.Lock()
        self._data: dict = {}
        self._chat_index: dict[int, str] = {}  # chat_id → company_id
        self._load()

    def _load(self):
        if self._config_path.exists():
            with open(self._config_path, "r", encoding="utf-8") as f:
                self._data = json.load(f)
        else:
            self._data = {}
        self._rebuild_index()

    def _save(self):
        self._config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._config_path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)

    def _rebuild_index(self):
        self._chat_index.clear()
        for cid, info in self._data.items():
            for chat_id in info.get("chat_ids", []):
                self._chat_index[chat_id] = cid

    def register_company(
        self,
        company_id: str,
        *,
        name: str,
        chat_ids: list[int] = None,
        paperclip_company_id: str = "",
        panels: dict = None,
        daily_limit: int = 30,
        bot_token: str = "",
    ):
        with self._lock:
            self._data[company_id] = {
                "name": name,
                "chat_ids": chat_ids or [],
                "paperclip_company_id": paperclip_company_id,
                "panels": panels or {},
                "daily_limit": daily_limit,
                "bot_token": bot_token,
            }
            self._save()
            self._rebuild_index()

    def remove_company(self, company_id: str):
        with self._lock:
            self._data.pop(company_id, None)
            self._save()
            self._rebuild_index()

    def get_company(self, company_id: str) -> Optional[dict]:
        return self._data.get(company_id)

    def get_company_by_chat(self, chat_id: int) -> tuple[str, dict]:
        """chat_id로 회사 조회. 없으면 TenantNotFoundError."""
        cid = self._chat_index.get(chat_id)
        if cid is None:
            raise TenantNotFoundError(f"chat_id {chat_id}에 매핑된 회사 없음")
        return cid, self._data[cid]

    def add_chat_id(self, company_id: str, chat_id: int):
        with self._lock:
            info = self._data.get(company_id)
            if info is None:
                raise TenantNotFoundError(f"회사 '{company_id}' 없음")
            if chat_id not in info["chat_ids"]:
                info["chat_ids"].append(chat_id)
                self._save()
                self._rebuild_index()

    def get_panels(self, company_id: str) -> dict:
        info = self._data.get(company_id, {})
        return info.get("panels", {})

    def get_daily_limit(self, company_id: str) -> int:
        info = self._data.get(company_id, {})
        return info.get("daily_limit", 30)

    def list_companies(self) -> dict:
        return dict(self._data)

    def reload(self):
        with self._lock:
            self._load()


class IsolatedPathResolver:
    """company별 격리된 파일 경로 제공"""

    SUBDIRS = ["logs", "inbox_c1", "inbox_c2", "status", "cache"]

    def __init__(self, base_dir: Path):
        self._base = base_dir

    def _company_dir(self, company_id: str) -> Path:
        return self._base / company_id

    def ensure_dirs(self, company_id: str):
        """회사 디렉토리 구조 생성"""
        for sub in self.SUBDIRS:
            (self._company_dir(company_id) / sub).mkdir(parents=True, exist_ok=True)

    def get_log_path(self, company_id: str) -> Path:
        return self._company_dir(company_id) / "logs"

    def get_inbox_path(self, company_id: str, direction: str) -> Path:
        """direction: 'c1' 또는 'c2'"""
        return self._company_dir(company_id) / f"inbox_{direction}"

    def get_status_path(self, company_id: str) -> Path:
        return self._company_dir(company_id) / "status"

    def get_cache_path(self, company_id: str) -> Path:
        return self._company_dir(company_id) / "cache"

    def get_log_file(self, company_id: str, date: str = None) -> Path:
        """특정 날짜의 로그 파일 경로. date 미지정 시 오늘."""
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        return self.get_log_path(company_id) / f"{date}.md"

    def validate_path(self, company_id: str, target_path: Path) -> bool:
        """target_path가 해당 company 디렉토리 안에 있는지 검증"""
        try:
            target_resolved = target_path.resolve()
            company_resolved = self._company_dir(company_id).resolve()
            return str(target_resolved).startswith(str(company_resolved))
        except (OSError, ValueError):
            return False


class DailyLimitTracker:
    """company별 일일 사용량 추적"""

    def __init__(self):
        self._counts: dict[str, dict] = {}  # company_id → {"date": str, "count": int}
        self._lock = threading.Lock()

    def _get_today(self) -> str:
        return datetime.now().strftime("%Y-%m-%d")

    def check_and_increment(self, company_id: str, daily_limit: int) -> bool:
        """사용 가능하면 카운트 증가 후 True, 초과면 False."""
        if daily_limit <= 0:
            return True  # 0 = 무제한

        with self._lock:
            today = self._get_today()
            entry = self._counts.get(company_id, {"date": "", "count": 0})
            if entry["date"] != today:
                entry = {"date": today, "count": 0}
            entry["count"] += 1
            self._counts[company_id] = entry
            return entry["count"] <= daily_limit

    def get_remaining(self, company_id: str, daily_limit: int) -> int | str:
        """남은 횟수. 무제한이면 '무제한' 반환."""
        if daily_limit <= 0:
            return "무제한"
        today = self._get_today()
        entry = self._counts.get(company_id, {"date": "", "count": 0})
        if entry["date"] != today:
            return daily_limit
        return max(0, daily_limit - entry["count"])

    def get_used(self, company_id: str) -> int:
        """오늘 사용한 횟수."""
        today = self._get_today()
        entry = self._counts.get(company_id, {"date": "", "count": 0})
        if entry["date"] != today:
            return 0
        return entry["count"]

    def reset(self, company_id: str):
        with self._lock:
            self._counts.pop(company_id, None)


class TenantContext:
    """특정 회사의 격리된 실행 컨텍스트"""

    def __init__(
        self,
        company_id: str,
        company_info: dict,
        resolver: IsolatedPathResolver,
        tracker: DailyLimitTracker,
    ):
        self.company_id = company_id
        self.name = company_info.get("name", "")
        self.chat_ids = company_info.get("chat_ids", [])
        self.paperclip_company_id = company_info.get("paperclip_company_id", "")
        self.panels = company_info.get("panels", {})
        self.daily_limit = company_info.get("daily_limit", 30)
        self.bot_token = company_info.get("bot_token", "")
        self._resolver = resolver
        self._tracker = tracker

    @property
    def log_path(self) -> Path:
        return self._resolver.get_log_path(self.company_id)

    @property
    def inbox_c1_path(self) -> Path:
        return self._resolver.get_inbox_path(self.company_id, "c1")

    @property
    def inbox_c2_path(self) -> Path:
        return self._resolver.get_inbox_path(self.company_id, "c2")

    @property
    def status_path(self) -> Path:
        return self._resolver.get_status_path(self.company_id)

    @property
    def cache_path(self) -> Path:
        return self._resolver.get_cache_path(self.company_id)

    def get_log_file(self, date: str = None) -> Path:
        return self._resolver.get_log_file(self.company_id, date)

    def check_daily_limit(self) -> bool:
        return self._tracker.check_and_increment(self.company_id, self.daily_limit)

    def get_remaining(self) -> int | str:
        return self._tracker.get_remaining(self.company_id, self.daily_limit)

    def validate_path(self, target: Path) -> bool:
        return self._resolver.validate_path(self.company_id, target)

    def log_c2(self, role: str, text: str):
        """격리된 로그 파일에 C2 대화 기록"""
        log_file = self.get_log_file()
        log_file.parent.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%H:%M:%S")
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"**[{timestamp}] {role}:** {text}\n\n")


# 스레드 로컬 저장소 (현재 컨텍스트)
_thread_local = threading.local()


class TenantMiddleware:
    """메인 미들웨어 — 모든 컴포넌트를 통합"""

    def __init__(self, base_dir: str | Path, config_file: str = "tenants.json"):
        self._base = Path(base_dir)
        self._registry = TenantRegistry(self._base / config_file)
        self._resolver = IsolatedPathResolver(self._base)
        self._tracker = DailyLimitTracker()

    @property
    def registry(self) -> TenantRegistry:
        return self._registry

    @property
    def resolver(self) -> IsolatedPathResolver:
        return self._resolver

    @property
    def tracker(self) -> DailyLimitTracker:
        return self._tracker

    def register_company(self, company_id: str, **kwargs):
        """회사 등록 + 디렉토리 생성"""
        self._registry.register_company(company_id, **kwargs)
        self._resolver.ensure_dirs(company_id)

    def get_context(self, chat_id: int) -> TenantContext:
        """chat_id로 TenantContext 생성"""
        company_id, info = self._registry.get_company_by_chat(chat_id)
        return TenantContext(company_id, info, self._resolver, self._tracker)

    def get_context_by_company(self, company_id: str) -> TenantContext:
        """company_id로 직접 TenantContext 생성 (내부/관리자용)"""
        info = self._registry.get_company(company_id)
        if info is None:
            raise TenantNotFoundError(f"회사 '{company_id}' 없음")
        return TenantContext(company_id, info, self._resolver, self._tracker)

    @contextmanager
    def tenant_scope(self, chat_id: int):
        """컨텍스트 매니저로 현재 스레드에 테넌트 바인딩

        사용:
            with mw.tenant_scope(chat_id) as ctx:
                ctx.log_c2("C2", "응답 내용")
        """
        ctx = self.get_context(chat_id)
        old = getattr(_thread_local, "tenant_ctx", None)
        _thread_local.tenant_ctx = ctx
        try:
            yield ctx
        finally:
            _thread_local.tenant_ctx = old

    @staticmethod
    def current_context() -> Optional[TenantContext]:
        """현재 스레드에 바인딩된 TenantContext 반환"""
        return getattr(_thread_local, "tenant_ctx", None)

    def is_authorized(self, chat_id: int, company_id: str) -> bool:
        """chat_id가 해당 회사의 소유자인지 확인"""
        info = self._registry.get_company(company_id)
        if info is None:
            return False
        return chat_id in info.get("chat_ids", [])
