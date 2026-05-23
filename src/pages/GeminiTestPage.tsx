import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function GeminiTestPage() {
  const [prompt, setPrompt] = useState('Say hello world in 3 words');
  const [response, setResponse] = useState('');
  const [latency, setLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const testGemini = async () => {
    setLoading(true);
    setResponse('');
    setLatency(null);

    try {
      // Record time from client perspective as well
      const clientStartTime = Date.now();
      
      const { data, error } = await supabase.functions.invoke('gemini-test', {
        body: { prompt }
      });

      const clientLatency = Date.now() - clientStartTime;

      if (error) throw error;
      
      setResponse(data.response);
      setLatency(data.latency_ms);
      
      console.log(`[Gemini Test] Edge Latency: ${data.latency_ms}ms | Client Latency: ${clientLatency}ms`);
    } catch (err: any) {
      console.error('Error invoking gemini-test function:', err);
      setResponse(`Error: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-xl mx-auto space-y-6">
      <h1 className="text-3xl font-medium tracking-tight">Gemini Smoke Test</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Test Prompt</label>
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-32 p-3 border rounded-md"
          />
        </div>
        
        <button 
          onClick={testGemini}
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded-full font-medium disabled:opacity-50"
        >
          {loading ? 'Calling Gemini...' : 'Test Gemini API'}
        </button>

        {response && (
          <div className="mt-8 p-4 bg-gray-50 rounded-lg border">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Response:</h3>
            <p className="whitespace-pre-wrap">{response}</p>
            {latency && (
              <p className="text-xs text-gray-400 mt-4">Server-side latency: {latency}ms (check console for full details)</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
