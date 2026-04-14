#!/usr/bin/env python3
"""
tenant_middleware.py 단위 테스트

실행: python3 -m pytest test_tenant_middleware.py -v
또는: python3 test_tenant_middleware.py
"""

import json
import os
import shutil
import tempfile
import threading
import unittest
from pathlib import Path

from tenant_middleware import (
    AccessDeniedError,
    DailyLimitTracker,
    IsolatedPathResolver,
    TenantContext,
    TenantMiddleware,
    TenantNotFoundError,
    TenantRegistry,
)


class TestTenantRegistry(unittest.TestCase):
    def setUp(self):
        self.tmpdir = Path(tempfile.mkdtemp())
        self.config = self.tmpdir / "tenants.json"
        self.registry = TenantRegistry(self.config)

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def test_register_and_get(self):
        self.registry.register_company(
            "comp_001", name="소시안", chat_ids=[111, 222], daily_limit=30
        )
        info = self.registry.get_company("comp_001")
        self.assertEqual(info["name"], "소시안")
        self.assertEqual(info["chat_ids"], [111, 222])
        self.assertEqual(info["daily_limit"], 30)

    def test_get_company_by_chat(self):
        self.registry.register_company("comp_001", name="A사", chat_ids=[111])
        self.registry.register_company("comp_002", name="B사", chat_ids=[222])

        cid, info = self.registry.get_company_by_chat(111)
        self.assertEqual(cid, "comp_001")
        self.assertEqual(info["name"], "A사")

        cid, info = self.registry.get_company_by_chat(222)
        self.assertEqual(cid, "comp_002")

    def test_unknown_chat_raises(self):
        with self.assertRaises(TenantNotFoundError):
            self.registry.get_company_by_chat(999)

    def test_add_chat_id(self):
        self.registry.register_company("comp_001", name="A사", chat_ids=[111])
        self.registry.add_chat_id("comp_001", 333)
        cid, _ = self.registry.get_company_by_chat(333)
        self.assertEqual(cid, "comp_001")

    def test_add_chat_id_idempotent(self):
        self.registry.register_company("comp_001", name="A사", chat_ids=[111])
        self.registry.add_chat_id("comp_001", 111)  # 중복 추가
        info = self.registry.get_company("comp_001")
        self.assertEqual(info["chat_ids"].count(111), 1)

    def test_remove_company(self):
        self.registry.register_company("comp_001", name="A사", chat_ids=[111])
        self.registry.remove_company("comp_001")
        self.assertIsNone(self.registry.get_company("comp_001"))
        with self.assertRaises(TenantNotFoundError):
            self.registry.get_company_by_chat(111)

    def test_persistence(self):
        self.registry.register_company("comp_001", name="A사", chat_ids=[111])
        # 새 인스턴스로 다시 로드
        registry2 = TenantRegistry(self.config)
        cid, info = registry2.get_company_by_chat(111)
        self.assertEqual(cid, "comp_001")
        self.assertEqual(info["name"], "A사")

    def test_list_companies(self):
        self.registry.register_company("comp_001", name="A사", chat_ids=[111])
        self.registry.register_company("comp_002", name="B사", chat_ids=[222])
        companies = self.registry.list_companies()
        self.assertEqual(len(companies), 2)
        self.assertIn("comp_001", companies)
        self.assertIn("comp_002", companies)

    def test_get_panels(self):
        panels = {"c1": "surface:3", "c2": "surface:17"}
        self.registry.register_company("comp_001", name="A사", panels=panels)
        self.assertEqual(self.registry.get_panels("comp_001"), panels)

    def test_get_panels_empty(self):
        self.assertEqual(self.registry.get_panels("nonexistent"), {})


class TestIsolatedPathResolver(unittest.TestCase):
    def setUp(self):
        self.tmpdir = Path(tempfile.mkdtemp())
        self.resolver = IsolatedPathResolver(self.tmpdir)

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def test_ensure_dirs_creates_structure(self):
        self.resolver.ensure_dirs("comp_001")
        for sub in ["logs", "inbox_c1", "inbox_c2", "status", "cache"]:
            self.assertTrue((self.tmpdir / "comp_001" / sub).is_dir())

    def test_paths_are_isolated(self):
        log_a = self.resolver.get_log_path("comp_A")
        log_b = self.resolver.get_log_path("comp_B")
        self.assertNotEqual(log_a, log_b)
        self.assertIn("comp_A", str(log_a))
        self.assertIn("comp_B", str(log_b))

    def test_inbox_paths(self):
        c1 = self.resolver.get_inbox_path("comp_001", "c1")
        c2 = self.resolver.get_inbox_path("comp_001", "c2")
        self.assertTrue(str(c1).endswith("inbox_c1"))
        self.assertTrue(str(c2).endswith("inbox_c2"))

    def test_log_file_today(self):
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        log_file = self.resolver.get_log_file("comp_001")
        self.assertEqual(log_file.name, f"{today}.md")

    def test_log_file_specific_date(self):
        log_file = self.resolver.get_log_file("comp_001", "2026-04-01")
        self.assertEqual(log_file.name, "2026-04-01.md")

    def test_validate_path_inside(self):
        self.resolver.ensure_dirs("comp_001")
        target = self.tmpdir / "comp_001" / "logs" / "test.md"
        self.assertTrue(self.resolver.validate_path("comp_001", target))

    def test_validate_path_outside(self):
        self.resolver.ensure_dirs("comp_001")
        self.resolver.ensure_dirs("comp_002")
        target = self.tmpdir / "comp_002" / "logs" / "test.md"
        self.assertFalse(self.resolver.validate_path("comp_001", target))

    def test_validate_path_traversal(self):
        self.resolver.ensure_dirs("comp_001")
        target = self.tmpdir / "comp_001" / ".." / "comp_002" / "logs"
        self.assertFalse(self.resolver.validate_path("comp_001", target))


class TestDailyLimitTracker(unittest.TestCase):
    def setUp(self):
        self.tracker = DailyLimitTracker()

    def test_within_limit(self):
        for _ in range(5):
            self.assertTrue(self.tracker.check_and_increment("comp_001", 10))

    def test_exceeds_limit(self):
        for _ in range(30):
            self.tracker.check_and_increment("comp_001", 30)
        self.assertFalse(self.tracker.check_and_increment("comp_001", 30))

    def test_unlimited(self):
        for _ in range(100):
            self.assertTrue(self.tracker.check_and_increment("comp_001", 0))

    def test_remaining(self):
        self.tracker.check_and_increment("comp_001", 10)
        self.tracker.check_and_increment("comp_001", 10)
        self.assertEqual(self.tracker.get_remaining("comp_001", 10), 8)

    def test_remaining_unlimited(self):
        self.assertEqual(self.tracker.get_remaining("comp_001", 0), "무제한")

    def test_isolation_between_companies(self):
        for _ in range(5):
            self.tracker.check_and_increment("comp_A", 5)
        self.assertFalse(self.tracker.check_and_increment("comp_A", 5))
        self.assertTrue(self.tracker.check_and_increment("comp_B", 5))

    def test_get_used(self):
        self.tracker.check_and_increment("comp_001", 10)
        self.tracker.check_and_increment("comp_001", 10)
        self.assertEqual(self.tracker.get_used("comp_001"), 2)
        self.assertEqual(self.tracker.get_used("comp_002"), 0)

    def test_reset(self):
        self.tracker.check_and_increment("comp_001", 10)
        self.tracker.reset("comp_001")
        self.assertEqual(self.tracker.get_used("comp_001"), 0)


class TestTenantContext(unittest.TestCase):
    def setUp(self):
        self.tmpdir = Path(tempfile.mkdtemp())
        self.resolver = IsolatedPathResolver(self.tmpdir)
        self.tracker = DailyLimitTracker()
        self.resolver.ensure_dirs("comp_001")
        self.info = {
            "name": "소시안",
            "chat_ids": [111],
            "paperclip_company_id": "uuid-123",
            "panels": {"c1": "surface:3", "c2": "surface:17"},
            "daily_limit": 30,
            "bot_token": "token-abc",
        }
        self.ctx = TenantContext("comp_001", self.info, self.resolver, self.tracker)

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def test_properties(self):
        self.assertEqual(self.ctx.company_id, "comp_001")
        self.assertEqual(self.ctx.name, "소시안")
        self.assertEqual(self.ctx.panels["c1"], "surface:3")

    def test_paths(self):
        self.assertIn("comp_001", str(self.ctx.log_path))
        self.assertIn("comp_001", str(self.ctx.inbox_c1_path))
        self.assertIn("comp_001", str(self.ctx.inbox_c2_path))
        self.assertIn("comp_001", str(self.ctx.status_path))

    def test_log_c2(self):
        self.ctx.log_c2("C2", "테스트 메시지")
        log_file = self.ctx.get_log_file()
        self.assertTrue(log_file.exists())
        content = log_file.read_text(encoding="utf-8")
        self.assertIn("C2", content)
        self.assertIn("테스트 메시지", content)

    def test_daily_limit(self):
        self.assertTrue(self.ctx.check_daily_limit())

    def test_validate_path(self):
        good = self.tmpdir / "comp_001" / "logs" / "test.md"
        bad = self.tmpdir / "comp_002" / "logs" / "test.md"
        self.assertTrue(self.ctx.validate_path(good))
        self.assertFalse(self.ctx.validate_path(bad))


class TestTenantMiddleware(unittest.TestCase):
    def setUp(self):
        self.tmpdir = Path(tempfile.mkdtemp())
        self.mw = TenantMiddleware(self.tmpdir)

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def test_register_and_context(self):
        self.mw.register_company(
            "comp_001", name="소시안", chat_ids=[111], daily_limit=30
        )
        ctx = self.mw.get_context(111)
        self.assertEqual(ctx.company_id, "comp_001")
        self.assertEqual(ctx.name, "소시안")

    def test_dirs_created_on_register(self):
        self.mw.register_company("comp_001", name="소시안")
        for sub in ["logs", "inbox_c1", "inbox_c2", "status", "cache"]:
            self.assertTrue((self.tmpdir / "comp_001" / sub).is_dir())

    def test_context_by_company(self):
        self.mw.register_company("comp_001", name="소시안")
        ctx = self.mw.get_context_by_company("comp_001")
        self.assertEqual(ctx.name, "소시안")

    def test_context_by_company_not_found(self):
        with self.assertRaises(TenantNotFoundError):
            self.mw.get_context_by_company("nonexistent")

    def test_unknown_chat(self):
        with self.assertRaises(TenantNotFoundError):
            self.mw.get_context(999)

    def test_tenant_scope(self):
        self.mw.register_company("comp_001", name="A사", chat_ids=[111])
        with self.mw.tenant_scope(111) as ctx:
            self.assertEqual(ctx.company_id, "comp_001")
            current = TenantMiddleware.current_context()
            self.assertIs(current, ctx)
        # scope 밖에서는 None
        self.assertIsNone(TenantMiddleware.current_context())

    def test_nested_scope(self):
        self.mw.register_company("comp_A", name="A사", chat_ids=[111])
        self.mw.register_company("comp_B", name="B사", chat_ids=[222])

        with self.mw.tenant_scope(111) as ctx_a:
            self.assertEqual(ctx_a.company_id, "comp_A")
            with self.mw.tenant_scope(222) as ctx_b:
                self.assertEqual(ctx_b.company_id, "comp_B")
                self.assertIs(TenantMiddleware.current_context(), ctx_b)
            # 외부 scope 복원
            self.assertIs(TenantMiddleware.current_context(), ctx_a)

    def test_is_authorized(self):
        self.mw.register_company("comp_001", name="A사", chat_ids=[111, 222])
        self.assertTrue(self.mw.is_authorized(111, "comp_001"))
        self.assertTrue(self.mw.is_authorized(222, "comp_001"))
        self.assertFalse(self.mw.is_authorized(333, "comp_001"))
        self.assertFalse(self.mw.is_authorized(111, "comp_002"))

    def test_multi_company_isolation(self):
        """두 회사의 데이터가 완전히 격리되는지 검증"""
        self.mw.register_company("comp_A", name="A사", chat_ids=[111])
        self.mw.register_company("comp_B", name="B사", chat_ids=[222])

        ctx_a = self.mw.get_context(111)
        ctx_b = self.mw.get_context(222)

        # 로그 기록
        ctx_a.log_c2("대표", "A사 지시사항")
        ctx_b.log_c2("���표", "B사 지시사항")

        # A사 로그에 B사 내용이 없어야 함
        a_log = ctx_a.get_log_file().read_text(encoding="utf-8")
        b_log = ctx_b.get_log_file().read_text(encoding="utf-8")

        self.assertIn("A사 지시사항", a_log)
        self.assertNotIn("B사 지시사항", a_log)
        self.assertIn("B사 지시사항", b_log)
        self.assertNotIn("A사 지시��항", b_log)

    def test_daily_limit_per_company(self):
        """일일 사용량이 회사별로 독립 추적되는지 검증"""
        self.mw.register_company("comp_A", name="A사", chat_ids=[111], daily_limit=3)
        self.mw.register_company("comp_B", name="B사", chat_ids=[222], daily_limit=3)

        ctx_a = self.mw.get_context(111)
        ctx_b = self.mw.get_context(222)

        # A사 한도 소진
        for _ in range(3):
            ctx_a.check_daily_limit()
        self.assertFalse(ctx_a.check_daily_limit())

        # B사는 영향 없음
        self.assertTrue(ctx_b.check_daily_limit())

    def test_path_traversal_blocked(self):
        """경로 우회 공격 차단 검증"""
        self.mw.register_company("comp_A", name="A사", chat_ids=[111])
        self.mw.register_company("comp_B", name="B사", chat_ids=[222])

        ctx_a = self.mw.get_context(111)
        # A사 컨텍스트에서 B사 경로 접근 시도
        bad_path = self.tmpdir / "comp_B" / "logs" / "secret.md"
        self.assertFalse(ctx_a.validate_path(bad_path))

    def test_thread_safety(self):
        """멀티스레드 환경에서 컨텍스트 격리 검증"""
        self.mw.register_company("comp_A", name="A사", chat_ids=[111])
        self.mw.register_company("comp_B", name="B사", chat_ids=[222])

        results = {}

        def worker(chat_id, key):
            with self.mw.tenant_scope(chat_id) as ctx:
                results[key] = ctx.company_id

        t1 = threading.Thread(target=worker, args=(111, "t1"))
        t2 = threading.Thread(target=worker, args=(222, "t2"))
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        self.assertEqual(results["t1"], "comp_A")
        self.assertEqual(results["t2"], "comp_B")


if __name__ == "__main__":
    unittest.main()
