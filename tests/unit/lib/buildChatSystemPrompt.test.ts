import { describe, it, expect } from "vitest";
import { buildChatSystemPrompt } from "@/lib/prompts/chat-system-prompt";
import type { TripDetail } from "@/types/trip";

const TRIP: TripDetail = {
  id: "trip-1",
  name: "Italy Adventure",
  destination: "Rome, Italy",
  start_date: "2026-05-01",
  end_date: "2026-05-07",
  days: [
    {
      id: "d1",
      day_number: 1,
      date: "2026-05-01",
      title: "Arrival in Rome",
      notes: "Long travel day",
      stops: [
        {
          id: "s1",
          name: "Colosseum",
          type: "activity",
          time: "2:00 PM",
          address: "Piazza del Colosseo, 1, Rome",
          lat: 41.89,
          lng: 12.49,
          notes: "Book tickets online",
          order: 1,
          options: [],
        },
        {
          id: "s2",
          name: "Hotel Roma",
          type: "hotel",
          time: "6:00 PM",
          address: "Via Nazionale, 1, Rome",
          lat: 41.9,
          lng: 12.5,
          notes: null,
          order: 2,
          options: [
            {
              name: "Da Enzo al 29",
              type: "restaurant",
              address: "Via dei Vascellari 29, Rome",
              lat: null,
              lng: null,
              notes: "Great pasta",
              order: 1,
            },
          ],
        },
      ],
    },
    {
      id: "d2",
      day_number: 2,
      date: "2026-05-02",
      title: "Vatican Day",
      notes: null,
      stops: [],
    },
  ],
};

describe("buildChatSystemPrompt", () => {
  it("includes the trip name and destination", () => {
    const prompt = buildChatSystemPrompt(TRIP);
    expect(prompt).toContain("Italy Adventure");
    expect(prompt).toContain("Rome, Italy");
  });

  it("includes the date range", () => {
    const prompt = buildChatSystemPrompt(TRIP);
    expect(prompt).toContain("2026-05-01");
    expect(prompt).toContain("2026-05-07");
  });

  it("includes all day titles", () => {
    const prompt = buildChatSystemPrompt(TRIP);
    expect(prompt).toContain("Arrival in Rome");
    expect(prompt).toContain("Vatican Day");
  });

  it("includes stop names and types", () => {
    const prompt = buildChatSystemPrompt(TRIP);
    expect(prompt).toContain("Colosseum");
    expect(prompt).toContain("activity");
    expect(prompt).toContain("Hotel Roma");
    expect(prompt).toContain("hotel");
  });

  it("includes stop addresses and times", () => {
    const prompt = buildChatSystemPrompt(TRIP);
    expect(prompt).toContain("Piazza del Colosseo, 1, Rome");
    expect(prompt).toContain("2:00 PM");
  });

  it("includes stop notes", () => {
    const prompt = buildChatSystemPrompt(TRIP);
    expect(prompt).toContain("Book tickets online");
  });

  it("includes day notes", () => {
    const prompt = buildChatSystemPrompt(TRIP);
    expect(prompt).toContain("Long travel day");
  });

  it("includes option names and addresses", () => {
    const prompt = buildChatSystemPrompt(TRIP);
    expect(prompt).toContain("Da Enzo al 29");
    expect(prompt).toContain("Via dei Vascellari 29, Rome");
    expect(prompt).toContain("Great pasta");
  });

  it("handles a day with no stops gracefully", () => {
    const prompt = buildChatSystemPrompt(TRIP);
    expect(prompt).toContain("No stops scheduled");
  });

  it("handles null dates gracefully", () => {
    const tripNoDates: TripDetail = { ...TRIP, start_date: null, end_date: null };
    const prompt = buildChatSystemPrompt(tripNoDates);
    expect(prompt).toContain("dates not specified");
  });
});
