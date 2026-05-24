import React from 'react';

export function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-300 flex items-center justify-center md:py-10">
      <div className="
        relative
        w-full max-w-[392px]
        h-screen md:h-[820px] md:max-h-[calc(100vh-80px)]
        bg-[#E4ECE6]
        md:rounded-[44px] md:border-8 md:border-black
        md:shadow-2xl
        overflow-hidden
        flex flex-col
      ">
        {children}
      </div>
    </div>
  );
}
