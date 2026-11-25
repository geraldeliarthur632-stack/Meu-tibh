import React, { useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { MessageSquare, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { db, formatFriendlyFirebaseError, handleFirestoreError, OperationType } from '../lib/firebase';
import { createClientId } from '../lib/imageUtils';
import { FIELD_LIMITS, Team, TeamMember, TeamMessage } from '../types/studio';

interface TeamChatProps {
  team: Team;
  currentMember: TeamMember | null;
  currentUserId: string;
  onMessageSent?: () => void;
}

export const TeamChat: React.FC<TeamChatProps> = ({
  team,
  currentMember,
  currentUserId,
  onMessageSent,
}) => {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const path = `teams/${team.id}/messages`;
    const q = query(
      collection(db, 'teams', team.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(150)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => d.data() as TeamMessage));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
    return () => unsub();
  }, [team.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    setSending(true);

    const msgId = createClientId('msg');
    try {
      await setDoc(doc(db, 'teams', team.id, 'messages', msgId), {
        id: msgId,
        teamId: team.id,
        senderId: currentUserId,
        senderName: currentMember?.name || 'Jogador',
        senderJersey: currentMember?.jerseyNumber || 0,
        senderPosition: currentMember?.position || '',
        text: trimmed.slice(0, FIELD_LIMITS.MAX_MESSAGE),
        createdAt: serverTimestamp(),
      });
      setText('');
      onMessageSent?.();
    } catch (err) {
      setError(formatFriendlyFirebaseError(err));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (createdAt: unknown) => {
    if (createdAt instanceof Timestamp) {
      return createdAt.toDate().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return 'agora';
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-13.5rem)] min-h-[380px] max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">
            Vestiário · Chat do {team.name}
          </h2>
          <p className="text-xs text-slate-500">
            Conversa sincronizada em tempo real com todo o elenco.
          </p>
        </div>
        <span className="font-mono-tabular text-xs font-semibold text-slate-500">
          {messages.length} msgs
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[#F8FAFC] p-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageSquare className="h-8 w-8 text-emerald-600/70" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              Nenhuma mensagem enviada ainda
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Combine horários, tática ou comemorem o último jogo por aqui.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-bold text-slate-700">
                    {msg.senderJersey > 0 ? `#${msg.senderJersey} ` : ''}
                    {msg.senderName}
                  </span>
                  {msg.senderPosition && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{msg.senderPosition}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{formatTime(msg.createdAt)}</span>
                </div>
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-2xs ${
                    isMine
                      ? 'bg-emerald-600 font-medium text-white'
                      : 'border border-slate-200 bg-white text-slate-900'
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mx-5 my-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => void handleSend(e)}
        className="flex items-center gap-3 border-t border-slate-200 bg-white p-3.5"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={FIELD_LIMITS.MAX_MESSAGE}
          placeholder="Escreva uma mensagem para o time..."
          className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label="Enviar mensagem"
          className="btn-studio inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-700 border-b-[3px] bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Enviar</span>
        </button>
      </form>
    </div>
  );
};
