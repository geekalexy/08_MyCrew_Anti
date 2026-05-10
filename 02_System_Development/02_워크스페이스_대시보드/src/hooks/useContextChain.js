/**
 * useContextChain.js — [Phase 37] 컨텍스트 체이닝 훅
 *
 * - [#ID] 문법 감지 → API 검증 (디바운스 300ms)
 * - 체인 데이터 상태 관리
 * - 중첩 체인 탐색 (뒤로가기 스택)
 */

import { useState, useCallback, useRef } from 'react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4010';
const DEBOUNCE_MS = 350;

// [#숫자] 또는 [#숫자C숫자] 형식
export const CHAIN_REF_REGEX = /\[(#\d+(?:C\d+)?)\]/g;

/**
 * 텍스트에서 [#ID] 참조를 모두 추출
 * @param {string} text
 * @returns {string[]} — ["#5C6", "#12"] 형태의 refId 배열
 */
export function extractChainRefs(text) {
  if (!text) return [];
  const regex = new RegExp(CHAIN_REF_REGEX.source, 'g');
  const refs = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    refs.push(match[1]); // ex) "#5C6"
  }
  return [...new Set(refs)]; // 중복 제거
}

/**
 * refId에서 숫자만 추출 (API path용)
 * ex) "#5C6" → "5C6", "#12" → "12"
 */
function toApiRefId(refId) {
  return refId.replace(/^#/, '');
}

export function useContextChain(projectId) {
  // ref → 체인 데이터 맵 { "#5C6": { chain: [...], error: null } }
  const [chainCache, setChainCache]   = useState({});
  // 현재 활성 패널에 표시중인 refId
  const [activeRef, setActiveRef]     = useState(null);
  // 뒤로가기 스택 (중첩 탐색)
  const [navStack, setNavStack]       = useState([]);
  // 로딩 상태
  const [isLoading, setIsLoading]     = useState(false);

  const debounceTimers = useRef({});

  /**
   * API 호출하여 체인 데이터 조회 (캐시 우선)
   */
  const fetchChain = useCallback(async (refId) => {
    if (!projectId || !refId) return null;
    // 캐시 HIT
    if (chainCache[refId]) return chainCache[refId];

    setIsLoading(true);
    try {
      const apiId = toApiRefId(refId);
      const res = await fetch(`${SERVER_URL}/api/v1/context/${apiId}/${projectId}`);
      const data = await res.json();

      const result = res.ok
        ? { chain: data.chain || [], error: null }
        : { chain: data.truncated_chain || [], error: data.error || '유효하지 않은 참조입니다.' };

      setChainCache(prev => ({ ...prev, [refId]: result }));
      return result;
    } catch (e) {
      const errResult = { chain: [], error: '네트워크 오류: ' + e.message };
      setChainCache(prev => ({ ...prev, [refId]: errResult }));
      return errResult;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, chainCache]);

  /**
   * 디바운스 검증: 텍스트 입력 중 [#ID] 감지 시 호출
   * 유효하면 캐시에 저장 (버튼 변환용 사전 로딩)
   */
  const debouncedValidate = useCallback((refId) => {
    if (debounceTimers.current[refId]) {
      clearTimeout(debounceTimers.current[refId]);
    }
    debounceTimers.current[refId] = setTimeout(() => {
      fetchChain(refId);
    }, DEBOUNCE_MS);
  }, [fetchChain]);

  /**
   * 패널 열기 — 최초 진입
   */
  const openPanel = useCallback(async (refId) => {
    setNavStack([]);
    setActiveRef(refId);
    await fetchChain(refId);
  }, [fetchChain]);

  /**
   * 중첩 참조 탐색 — 우측 패널 내에서 [#다른ID] 클릭 시
   */
  const navigateTo = useCallback(async (refId) => {
    if (activeRef) {
      setNavStack(prev => [...prev, activeRef]);
    }
    setActiveRef(refId);
    await fetchChain(refId);
  }, [activeRef, fetchChain]);

  /**
   * 뒤로가기
   */
  const navigateBack = useCallback(() => {
    if (navStack.length === 0) return;
    const prev = navStack[navStack.length - 1];
    setNavStack(s => s.slice(0, -1));
    setActiveRef(prev);
  }, [navStack]);

  /**
   * 패널 닫기
   */
  const closePanel = useCallback(() => {
    setActiveRef(null);
    setNavStack([]);
  }, []);

  const currentChainData = activeRef ? (chainCache[activeRef] || null) : null;

  return {
    // 상태
    activeRef,
    chainData: currentChainData,
    chainCache,
    isLoading,
    canGoBack: navStack.length > 0,
    navStack,
    // 액션
    debouncedValidate,
    fetchChain,
    openPanel,
    navigateTo,
    navigateBack,
    closePanel,
    // 유틸
    extractChainRefs,
    CHAIN_REF_REGEX,
  };
}
