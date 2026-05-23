import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export function WelcomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const loginAsPriya = async () => {
    setLoading(true);
    setError('');
    const email = 'priya@savio.demo';
    const password = import.meta.env.VITE_DEMO_PRIYA_PASSWORD || 'amanbabu@26';

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      // Use React Router navigate so the SPA stays in the same JS context
      // and the shared supabase client retains the session.
      navigate('/home');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to login');
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex-1 flex flex-col justify-center items-center bg-canvas px-6">
      <div className="w-full max-w-md bg-white rounded-[32px] p-8 text-center border shadow-sm">
        <h1 className="text-display font-medium text-primary mb-2 tracking-tight">Savio</h1>
        <p className="text-body text-secondary mb-8">Better money decisions, made together.</p>

        {error && (
          <div className="bg-alert-plate text-alert-stop p-4 rounded-md mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            disabled={true}
            className="w-full bg-primary text-white py-4 rounded-pill font-medium text-body opacity-50 cursor-not-allowed"
          >
            Get started
          </button>

          <button
            onClick={loginAsPriya}
            disabled={loading}
            className="w-full bg-white border border-black text-primary py-4 rounded-pill font-medium text-body hover:bg-gray-50 transition-colors"
          >
            {loading ? 'Logging in...' : 'Demo: Log in as Priya'}
          </button>
        </div>
      </div>
    </div>
  );
}
