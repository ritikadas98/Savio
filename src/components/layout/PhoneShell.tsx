import React from 'react';
import { Signal, Wifi, BatteryFull } from 'lucide-react';

function StatusBar() {
  return (
    <div className="hidden md:flex flex-shrink-0 items-center justify-between px-6 pt-3.5 pb-2 text-sm font-medium text-[#1A1A1A]">
      <span>9:41</span>
      <div className="flex items-center gap-1.5">
        <Signal size={14} />
        <Wifi size={14} />
        <BatteryFull size={18} />
      </div>
    </div>
  );
}

// Phone-frame chrome — kept by explicit user preference. Master plan §2.1 #8
// recommended removal ("responsive mobile web, no phone-frame chrome") but
// the bezel was reinstated as a deliberate portfolio-presentation choice.
// Bezel + notch + status bar only render on md+ viewports; mobile fills screen.
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
        {/* Physical notch on the bezel — desktop frame only */}
        <div className="hidden md:block absolute top-2 left-1/2 -translate-x-1/2 w-[110px] h-[26px] bg-black rounded-full z-10" />
        <StatusBar />
        <div className="flex-1 min-h-0 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
