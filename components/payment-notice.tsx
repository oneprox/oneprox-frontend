"use client";

import { useEffect, useState } from "react";

/**
 * PaymentNotice — modal popup reminding the client of a payment due date.
 *
 * Controlled entirely by environment variables so it can be switched on/off
 * without code changes:
 *   NEXT_PUBLIC_PAYMENT_NOTICE=true            -> show popup  (anything else / unset = hidden)
 *   NEXT_PUBLIC_PAYMENT_NOTICE_DUE="25 Oktober 2026"
 *
 * To turn it OFF: set NEXT_PUBLIC_PAYMENT_NOTICE=false (or remove the line), then rebuild/restart.
 */
export function PaymentNotice() {
  const enabled = process.env.NEXT_PUBLIC_PAYMENT_NOTICE === "true";
  const due = process.env.NEXT_PUBLIC_PAYMENT_NOTICE_DUE || "25 Oktober 2026";

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    // Shows once per browser session; reappears on next login / new session.
    try {
      if (sessionStorage.getItem("payment_notice_dismissed") !== "1") {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, [enabled]);

  if (!enabled || !open) return null;

  const close = () => {
    try {
      sessionStorage.setItem("payment_notice_dismissed", "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-notice-title"
      onClick={close}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <h2
            id="payment-notice-title"
            className="text-base font-semibold text-amber-900 dark:text-amber-200"
          >
            Pemberitahuan Pembayaran
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">
            Mohon dengan hormat agar pembayaran untuk sistem ini dapat
            diselesaikan paling lambat{" "}
            <span className="font-semibold">{due}</span>. Apabila melewati
            tanggal tersebut, layanan sistem akan kami hentikan sementara hingga
            pembayaran diterima. Terima kasih atas perhatian dan kerja samanya.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-3 dark:border-neutral-700">
          <button
            type="button"
            onClick={close}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-600"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
