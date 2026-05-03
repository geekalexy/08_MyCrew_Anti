import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_CHATS = 200;

export const useChatStore = create(
  persist(
    (set) => ({
      chats: [],

      appendChat: (chat) =>
        set((s) => {
          if (s.chats.length >= MAX_CHATS) {
            const chats = s.chats.slice(1);
            chats.push(chat);
            return { chats };
          }
          return { chats: [...s.chats, chat] };
        }),

      clearChatLogs: (projectId) =>
        set((s) => ({
          chats: s.chats.filter(c => c.projectId !== projectId)
        })),

      dangerouslyPurgeAllChats: () => set({ chats: [] }),
    }),
    {
      name: 'ari-chat-storage', // 로컬스토리지 키 이름
    }
  )
);
