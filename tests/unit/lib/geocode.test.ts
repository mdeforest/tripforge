import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { geocodeAddress } from "@/lib/geocode";

const MOCK_RESPONSE = {
  features: [
    {
      geometry: { coordinates: [12.4922, 41.8902] }, // [lng, lat] — Colosseum
    },
  ],
};

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    json: async () => body,
  });
}

describe("geocodeAddress", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.MAPBOX_ACCESS_TOKEN;

  beforeEach(() => {
    process.env.MAPBOX_ACCESS_TOKEN = "pk.test-token";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.MAPBOX_ACCESS_TOKEN = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns lat/lng for a valid address", async () => {
    global.fetch = mockFetch(200, MOCK_RESPONSE);
    const result = await geocodeAddress("Piazza del Colosseo, Rome");
    expect(result).toEqual({ lat: 41.8902, lng: 12.4922 });
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("encodes the address in the URL", async () => {
    global.fetch = mockFetch(200, MOCK_RESPONSE);
    await geocodeAddress("Champs-Élysées, Paris");
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain(encodeURIComponent("Champs-Élysées, Paris"));
    expect(url).toContain("pk.test-token");
  });

  it("returns null for a null address", async () => {
    global.fetch = mockFetch(200, MOCK_RESPONSE);
    const result = await geocodeAddress(null);
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null when MAPBOX_ACCESS_TOKEN is not set", async () => {
    delete process.env.MAPBOX_ACCESS_TOKEN;
    global.fetch = mockFetch(200, MOCK_RESPONSE);
    const result = await geocodeAddress("Rome, Italy");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null when the API returns a non-2xx status", async () => {
    global.fetch = mockFetch(422, {});
    const result = await geocodeAddress("Rome, Italy");
    expect(result).toBeNull();
  });

  it("returns null when the API returns zero features", async () => {
    global.fetch = mockFetch(200, { features: [] });
    const result = await geocodeAddress("zzznowhere");
    expect(result).toBeNull();
  });

  it("returns null when fetch throws (network error)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));
    const result = await geocodeAddress("Rome, Italy");
    expect(result).toBeNull();
  });
});
