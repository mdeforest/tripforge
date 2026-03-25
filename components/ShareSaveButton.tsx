"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ShareSaveButtonProps {
  token: string;
  tripId: string;
  initialState: "owner" | "follower" | "stranger";
}

export function ShareSaveButton({ token, tripId, initialState }: ShareSaveButtonProps) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/share/${token}/follow`, { method: "POST" });
    if (res.ok) {
      router.push(`/trips/${tripId}`);
    } else {
      setSaving(false);
    }
  }

  if (state === "owner") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted text-center">You own this trip.</p>
        <Link
          href={`/trips/${tripId}`}
          className="block w-full rounded-xl bg-rust py-2.5 text-center text-sm font-semibold text-cream hover:bg-rust-dark transition-colors"
        >
          Open trip
        </Link>
      </div>
    );
  }

  if (state === "follower") {
    return (
      <div className="space-y-2">
        <button
          disabled
          className="w-full rounded-xl bg-parchment-dark py-2.5 text-sm font-semibold text-muted cursor-not-allowed"
        >
          Already saved
        </button>
        <Link
          href={`/trips/${tripId}`}
          className="block text-center text-sm font-medium text-rust hover:underline"
        >
          Open trip
        </Link>
      </div>
    );
  }

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      className="w-full rounded-xl bg-rust py-2.5 text-sm font-semibold text-cream hover:bg-rust-dark transition-colors disabled:opacity-60"
    >
      {saving ? "Saving…" : "Save to my trips"}
    </button>
  );
}
