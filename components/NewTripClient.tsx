"use client";

import { useState } from "react";
import { UploadForm } from "@/components/UploadForm";
import { ReviewTrip } from "@/components/ReviewTrip";
import type { ParsedItinerary } from "@/types/itinerary";

interface ParsedResult {
  parsedData: ParsedItinerary;
  rawText: string;
}

/**
 * Client component that manages the two-step new-trip flow:
 *   1. "upload" — UploadForm (paste text / upload file / Google Docs URL)
 *   2. "review" — ReviewTrip (confirm or go back)
 */
export function NewTripClient() {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [parsed, setParsed] = useState<ParsedResult | null>(null);

  function handleParsed(data: ParsedResult) {
    setParsed(data);
    setStep("review");
  }

  function handleBack() {
    setStep("upload");
  }

  if (step === "review" && parsed) {
    return (
      <ReviewTrip
        parsedData={parsed.parsedData}
        rawText={parsed.rawText}
        onBack={handleBack}
      />
    );
  }

  return <UploadForm onParsed={handleParsed} />;
}
