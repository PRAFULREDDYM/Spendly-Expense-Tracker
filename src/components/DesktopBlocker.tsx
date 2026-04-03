import React from 'react';

export function DesktopBlocker() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0F1117] px-6 py-10 text-white">
      <div className="w-full max-w-md rounded-[32px] border border-white/8 bg-[rgba(24,28,37,0.92)] p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-[rgba(43,127,255,0.14)]">
          <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
            <rect x="10" y="12" width="22" height="18" rx="5" fill="#2B7FFF" />
            <path d="M13 12.5C13 10.567 14.567 9 16.5 9H25.5C27.433 9 29 10.567 29 12.5V16H13V12.5Z" fill="#2B7FFF" />
            <circle cx="25.5" cy="21" r="2.5" fill="#0F1117" />
            <rect x="15" y="19.25" width="8" height="3.5" rx="1.75" fill="#0F1117" />
          </svg>
        </div>

        <h1 className="text-[30px] font-bold tracking-[-0.03em] text-white">Expense Tracker</h1>
        <p className="mt-3 text-[15px] leading-7 text-[rgba(232,234,240,0.72)]">
          This app is designed for mobile. Download it from the App Store or Google Play for the
          best experience.
        </p>

        <div className="mt-8 grid gap-3">
          <a
            href="https://play.google.com/store/apps/details?id=com.prafulreddy.expensetracker"
            className="flex h-12 items-center justify-center rounded-[16px] bg-[#2B7FFF] text-sm font-semibold text-white"
          >
            Google Play
          </a>
          <a
            href="https://apps.apple.com/app/id0000000000"
            className="flex h-12 items-center justify-center rounded-[16px] border border-white/12 bg-white/4 text-sm font-semibold text-white"
          >
            App Store
          </a>
        </div>

        <p className="mt-6 text-[13px] leading-6 text-[rgba(124,129,150,0.92)]">
          Already have an account? Your data syncs automatically when you sign in on your phone.
        </p>
      </div>
    </main>
  );
}
