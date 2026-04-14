import { useState } from 'react';

export default function TaskCreateModal({ isOpen, onClose }) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('http://localhost:4000/webhook/antigravity/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ISSUE_CREATE',
          payload: { title: content.trim() },
        }),
      });
      if (res.ok) {
        // C2 완전 해결: 낙관적 UI 제거 — 서버의 task:created 소켓 이벤트로 카드 생성 위임
        setContent('');
        onClose();
      }
    } catch (err) {
      console.error('[Modal] Task create failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="새 이슈 생성">
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title">✍️ 새 업무 지시</h2>
          <button className="modal__close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal__body">
          <textarea
            className="modal__textarea"
            placeholder="아리에게 지시할 업무 내용을 입력하세요..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            autoFocus
          />
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              취소
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!content.trim() || isSubmitting}
            >
              {isSubmitting ? '전송 중...' : '🚀 업무 지시'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
