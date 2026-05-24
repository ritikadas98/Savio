import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { BottomNav } from '../components/layout/BottomNav';
import { MessageBubble } from '../components/chat/MessageBubble';
import { Composer } from '../components/chat/Composer';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { SuggestedChips } from '../components/chat/SuggestedChips';
import { DisclaimerFooter } from '../components/chat/DisclaimerFooter';

export function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadHistory() {
      // Resolve auth user -> profile.id (the app-level UUID used in all FKs)
      const { data: { session } } = await supabase.auth.getSession();
      const authUid = session?.user?.id;
      if (!authUid) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', authUid)
        .single();

      if (!profile) {
        console.error('ChatPage: Could not resolve profile for auth user');
        return;
      }

      setProfileId(profile.id);

      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        setMessages(data.reverse());
      }
    }
    loadHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (text: string) => {
    if (!profileId) return;

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Insert user message with profile.id (not auth.uid())
    const { error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: profileId,
        role: 'user',
        content: text
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to save user message', insertError);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('chat-respond', {
        body: { message: text }
      });

      if (error) throw error;

      // Insert assistant message with profile.id
      const { data: insertedAssistantMsg } = await supabase
        .from('chat_messages')
        .insert({
          user_id: profileId,
          role: 'assistant',
          content: data.response,
          ai_metadata: data.ai_metadata
        })
        .select()
        .single();

      if (insertedAssistantMsg) {
        setMessages(prev => [...prev, insertedAssistantMsg]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = { id: crypto.randomUUID(), role: 'assistant', content: "Sorry, I ran into an issue connecting to my brain." };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="flex flex-col h-full bg-[#E4ECE6]">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 flex-shrink-0">
        <h1 className="text-heading font-medium text-primary">Chat with Savio</h1>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4">
        <div className="flex flex-col min-h-full">
          <div className="flex-1" />

          {isEmpty && (
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                <svg width="32" height="32" fill="none" stroke="#0C447C" strokeWidth="1.5">
                  <polygon points="16 4 4 28 16 22 28 28 16 4"></polygon>
                </svg>
              </div>
              <p className="text-body text-primary font-medium mb-1">Ask Savio anything about your money</p>
              <p className="text-caption text-secondary">Try one of these prompts:</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={msg.id || i} message={msg} />
          ))}

          {loading && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Sticky bottom controls */}
      <div className="flex-shrink-0 bg-[#E4ECE6] border-t border-black/5 px-4 pt-2 pb-1">
        {isEmpty && (
          <div className="mb-2">
            <SuggestedChips onSelect={handleSend} disabled={loading} />
          </div>
        )}
        <Composer onSend={handleSend} disabled={loading} />
        <DisclaimerFooter />
      </div>

      <BottomNav />
    </div>
  );
}
