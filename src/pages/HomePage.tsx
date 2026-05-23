import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function HomePage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-canvas p-6 flex flex-col items-center pt-20">
      <div className="bg-white rounded-[32px] p-8 shadow-sm w-full max-w-md">
        <h1 className="text-title font-medium mb-4">Your Dashboard</h1>
        {user ? (
          <p className="text-body text-secondary mb-8">Logged in as Priya Sharma ({user.email})</p>
        ) : (
          <p className="text-body text-secondary mb-8">Checking auth state...</p>
        )}
        
        <button 
          onClick={logout}
          className="bg-primary text-white px-6 py-2 rounded-pill font-medium"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
