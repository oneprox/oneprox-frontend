"use client";

import { useEffect, useState } from "react";

/**
 * PaymentNotice — login/dashboard banner reminding the client of a payment due date.
 *
 * Controlled entirely by environment variables so it can be switched on/off
 * without code changes:
 *   NEXT_PUBLIC_PAYMENT_NOTICE=true            -> show banner  (anything else / unset = hidden)
 *   NEXT_PUBLIC_PAYMENT_NOTICE_DUE="25 Oktober 2026"
 *
 * To turn it OFF: set NEXT_PUBLIC_PAYMENT_NOTICE=false (or remove the line), then rebuild/restart.
 */
export function PaymentNotice() {
  const enabled = process.env.NEXT_PUBLIC_PAYMENT_NOTICE === "true";
  const due = process.env.NEXT_PUBLIC_PAYMENT_NOTICE_DUE || "25 Oktober 2026";

  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Reappears on each new login/session; stays hidden only within the current tab session once closed.
    try {
      setDismissed(sessionStorage.getItem("payment_notice_dismissed") === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!enabled || dismissed) return null;

  const close = () => {
    try {
      sessionStorage.setItem("payment_notice_dismissed", "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <svg
        className="mt-0.5 h-5 w-5 shrink-0"
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

      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <p className="font-semibold">Pemberitahuan Pembayaran</p>
        <p className="mt-0.5">
          Mohon dengan hormat agar pembayaran untuk sistem ini dapat diselesaikan
          paling lambat <span className="font-semibold">{due}</span>. Apabila
          melewati tanggal tersebut, layanan sistem akan kami hentikan sementara
          hingga pembayaran diterima. Terima kasih atas perhatian dan kerja samanya.
        </p>
      </div>

      <button
        type="button"
        onClick={close}
        aria-label="Tutup pemberitahuan"
        className="shrink-0 rounded p-1 text-amber-700 transition hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-500/20"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
