import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { BottomNav } from '../components/layout/BottomNav';
import { MessageBubble } from '../components/chat/MessageBubble';
import { Composer } from '../components/chat/Composer';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { SuggestedChips } from '../components/chat/SuggestedChips';
import { DisclaimerFooter } from '../components/chat/DisclaimerFooter';
import { getRealNow } from '../lib/dates';

export function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadHistory() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setSessionUser(user);

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
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
    if (!sessionUser) return;

    // Optimistic UI update
    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      created_at: getRealNow().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // 1. Write user message to DB BEFORE calling edge function
    const { data: insertedUserMsg, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: sessionUser.id,
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
      // 2. Call Edge Function
      const { data, error } = await supabase.functions.invoke('chat-respond', {
        body: { message: text }
      });

      if (error) throw error;

      // 3. Write assistant message AFTER receiving response
      const { data: insertedAssistantMsg } = await supabase
        .from('chat_messages')
        .insert({
          user_id: sessionUser.id,
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
      // Insert error message fallback
      const errorMsg = { role: 'assistant', content: "Sorry, I ran into an issue connecting to my brain." };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#E4ECE6]">
      <div className="flex-1 overflow-y-auto p-4 pt-8 pb-32">
        <div className="max-w-md mx-auto flex flex-col justify-end min-h-full">
          {messages.length === 0 && !loading && (
            <div className="text-center text-secondary mb-8">
              <div className="w-16 h-16 mx-auto bg-white rounded-full flex items-center justify-center mb-4">
                <svg width="32" height="32" fill="none" stroke="#0C447C" strokeWidth="2"><polygon points="12 2 2 22 12 18 22 22 12 2"></polygon></svg>
              </div>
              <p className="text-body">I'm here to help you think through your decisions.</p>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <MessageBubble key={msg.id || i} message={msg} />
          ))}
          
          {loading && <TypingIndicator />}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Sticky Bottom Area */}
      <div className="fixed bottom-[64px] left-0 right-0 bg-gradient-to-t from-[#E4ECE6] via-[#E4ECE6] to-transparent pt-6 pb-2 px-4 z-40">
        <div className="max-w-md mx-auto">
          {messages.length === 0 && <SuggestedChips onSelect={handleSend} disabled={loading} />}
          <div className="mt-2">
            <Composer onSend={handleSend} disabled={loading} />
          </div>
          <DisclaimerFooter />
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
