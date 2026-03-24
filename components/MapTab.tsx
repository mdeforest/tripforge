"use client";

import { useEffect, useRef } from "react";
import { DaySelector } from "@/components/DaySelector";
import type { DayDetail, StopDetail, StopOption } from "@/types/trip";

// CSS is imported statically — Next.js handles node_modules CSS fine.
// The JS is loaded dynamically inside useEffect to avoid SSR issues.
import "mapbox-gl/dist/mapbox-gl.css";

export interface MapViewport {
  center: [number, number];
  zoom: number;
  /** The day_number this viewport was captured for. */
  forDay: number;
}

interface MapTabProps {
  days: DayDetail[];
  selectedDay: number;
  onSelectDay: (day: number) => void;
  /** Viewport saved from a previous visit — restored when the day matches. */
  savedViewport?: MapViewport | null;
  /** Called on every map moveend so the parent can persist the viewport. */
  onViewportChange?: (viewport: MapViewport) => void;
  /** Called when the user clicks "Edit location" in a popup. */
  onEditStop?: (stopId: string) => void;
}

interface OptionPin {
  opt: StopOption;
  stopName: string;
  /** 1-based pin number of the parent stop, used for the label and colour. */
  stopNumber: number;
}

/**
 * Map tab: day selector + Mapbox GL JS map with numbered pins for stops
 * and sky-blue pins for stop options that have geocoded coordinates.
 * Fully controlled — selected day state is owned by TripCompanionClient so it
 * persists when the user switches between tabs.
 */
export function MapTab({
  days,
  selectedDay,
  onSelectDay,
  savedViewport,
  onViewportChange,
  onEditStop,
}: MapTabProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  const currentDay = days.find((d) => d.day_number === selectedDay);

  // Active hotel: most recent hotel stop (current day or earlier) with coordinates.
  // Scanning stops as soon as a day with hotel stops is found — even if those stops lack
  // coords — to avoid showing a stale hotel after the user has checked into a new one.
  const activeHotel: StopDetail | null = (() => {
    const sortedDays = [...days]
      .filter((d) => d.day_number <= selectedDay)
      .sort((a, b) => b.day_number - a.day_number);
    for (const day of sortedDays) {
      const hotelStops = day.stops.filter((s) => s.type === "hotel");
      if (hotelStops.length === 0) continue;
      // Found the most recent day with hotel stops — use it if mappable, else stop.
      return hotelStops.find((s) => s.lat != null && s.lng != null) ?? null;
    }
    return null;
  })();

  // All non-hotel stops in day order — used for consistent numbering across pins + options.
  const allNonHotelStops = (currentDay?.stops ?? []).filter((s) => s.type !== "hotel");
  const allStopNumber = new Map(allNonHotelStops.map((s, i) => [s.id, i + 1]));

  // Visible numbered pins: non-hotel stops with unique coords and no options.
  // Stops with options are represented by their option pins instead.
  const stopsWithCoords: StopDetail[] = allNonHotelStops.filter(
    (s) =>
      s.lat != null &&
      s.lng != null &&
      s.options.length === 0 &&
      !(activeHotel && s.lat === activeHotel.lat && s.lng === activeHotel.lng)
  );

  // Option pins from ALL non-hotel stops (including suppressed ones), numbered by
  // their position in the day so labels stay consistent with visible stop pins.
  const optionsWithCoords: OptionPin[] = allNonHotelStops.flatMap((stop) => {
    const stopNumber = allStopNumber.get(stop.id)!;
    return (stop.options ?? [])
      .filter((opt) => opt.lat != null && opt.lng != null)
      .map((opt) => ({ opt, stopName: stop.name, stopNumber }));
  });

  const hasAnyPins = stopsWithCoords.length > 0 || optionsWithCoords.length > 0 || activeHotel != null;

  const handlePopupClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const editBtn = target.closest("[data-edit-stop]") as HTMLElement | null;
    if (editBtn) {
      e.preventDefault();
      onEditStop?.(editBtn.getAttribute("data-edit-stop")!);
    }
  };

  useEffect(() => {
    if (!mapContainer.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return;

    // Clean up any previous map instance before initialising a new one.
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    let cancelled = false;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelled || !mapContainer.current) return;

      // Inject popup CSS overrides once per page load.
      if (!document.getElementById("tf-popup-styles")) {
        const s = document.createElement("style");
        s.id = "tf-popup-styles";
        s.textContent = `
          .mapboxgl-popup-content {
            padding: 14px 16px 16px;
            border-radius: 12px;
            box-shadow: 0 4px 24px rgba(28,18,8,0.14);
            border: 1px solid #EAD9BC;
            background: #FAF6EE;
            min-width: 190px;
          }
          .mapboxgl-popup-close-button {
            font-size: 18px;
            line-height: 1;
            color: #9A8570;
            padding: 4px 8px;
            top: 8px;
            right: 8px;
            border-radius: 6px;
          }
          .mapboxgl-popup-close-button:hover {
            color: #1C1208;
            background: rgba(28,18,8,0.07);
          }
        `;
        document.head.appendChild(s);
      }

      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [0, 20],
        zoom: 1,
      });

      mapRef.current = map;

      if (stopsWithCoords.length > 0 || optionsWithCoords.length > 0 || activeHotel) {
        const bounds = new mapboxgl.LngLatBounds();

        // Colour palette for option pins — one colour per parent stop, cycling.
        const OPTION_COLORS = ["#4A7C9E", "#2E5E35", "#7C4A9E", "#9E7C2E", "#9E4A4A"];

        // Active hotel pin — shown when the current day has no hotel of its own.
        // Uses a grey "H" pin to indicate it's a carried-forward home base.
        if (activeHotel) {
          const lng = activeHotel.lng!;
          const lat = activeHotel.lat!;

          const el = document.createElement("div");
          el.setAttribute("data-testid", `map-pin-hotel-${activeHotel.id}`);
          el.style.cssText = [
            "width:28px",
            "height:28px",
            "border-radius:50%",
            "background:#6B4C2A",
            "color:#fff",
            "font-size:11px",
            "font-weight:700",
            "display:flex",
            "align-items:center",
            "justify-content:center",
            "border:2px solid #fff",
            "box-shadow:0 1px 4px rgba(0,0,0,0.35)",
            "cursor:pointer",
          ].join(";");
          el.textContent = "H";

          const directionsHref = `https://maps.google.com/?q=${encodeURIComponent(
            activeHotel.address ?? activeHotel.name
          )}`;

          const popup = new mapboxgl.Popup({ offset: 16 }).setHTML(
            `<p style="margin:0 0 2px;font-size:10px;color:#9A8570;font-family:sans-serif;text-transform:uppercase;letter-spacing:0.04em">Staying here</p>` +
            `<p style="margin:0 0 ${activeHotel.address ? "4px" : "12px"};padding-right:20px;font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:16px;color:#1C1208;line-height:1.3">${activeHotel.name}</p>` +
            (activeHotel.address ? `<p style="margin:0 0 12px;font-size:11px;color:#9A8570;line-height:1.5">${activeHotel.address}</p>` : "") +
            `<a href="${directionsHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:6px 14px;background:#6B4C2A;color:#fff;border-radius:7px;font-size:12px;font-weight:500;text-decoration:none;font-family:sans-serif">Get Directions</a>` +
            `<br><a data-edit-stop="${activeHotel.id}" href="#" style="display:inline-block;margin-top:6px;font-size:11px;color:#9A8570;font-family:sans-serif;text-decoration:underline">Edit location</a>`
          );

          new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(map);

          bounds.extend([lng, lat]);
        }

        // Numbered rust-coloured pins for main stops.
        stopsWithCoords.forEach((stop, index) => {
          const lng = stop.lng!;
          const lat = stop.lat!;

          const el = document.createElement("div");
          el.setAttribute("data-testid", `map-pin-${stop.id}`);
          el.style.cssText = [
            "width:28px",
            "height:28px",
            "border-radius:50%",
            "background:#B85C30",
            "color:#fff",
            "font-size:12px",
            "font-weight:700",
            "display:flex",
            "align-items:center",
            "justify-content:center",
            "border:2px solid #fff",
            "box-shadow:0 1px 4px rgba(0,0,0,0.35)",
            "cursor:pointer",
          ].join(";");
          el.textContent = String(allStopNumber.get(stop.id) ?? index + 1);

          const directionsHref = `https://maps.google.com/?q=${encodeURIComponent(
            stop.address ?? stop.name
          )}`;

          const popup = new mapboxgl.Popup({ offset: 16 }).setHTML(
            `<p style="margin:0 0 ${stop.address ? "4px" : "12px"};padding-right:20px;font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:16px;color:#1C1208;line-height:1.3">${stop.name}</p>` +
            (stop.address ? `<p style="margin:0 0 12px;font-size:11px;color:#9A8570;line-height:1.5">${stop.address}</p>` : "") +
            `<a href="${directionsHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:6px 14px;background:#B85C30;color:#fff;border-radius:7px;font-size:12px;font-weight:500;text-decoration:none;font-family:sans-serif">Get Directions</a>` +
            `<br><a data-edit-stop="${stop.id}" href="#" style="display:inline-block;margin-top:6px;font-size:11px;color:#9A8570;font-family:sans-serif;text-decoration:underline">Edit location</a>`
          );

          new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(map);

          bounds.extend([lng, lat]);
        });

        // Colour-coded pins for stop options — same size as stop pins, numbered by parent stop.
        optionsWithCoords.forEach(({ opt, stopName, stopNumber }) => {
          const lng = opt.lng!;
          const lat = opt.lat!;
          const color = OPTION_COLORS[(stopNumber - 1 + OPTION_COLORS.length) % OPTION_COLORS.length];

          const el = document.createElement("div");
          el.setAttribute("data-testid", `map-option-pin-${opt.name}`);
          el.style.cssText = [
            "width:28px",
            "height:28px",
            "border-radius:50%",
            `background:${color}`,
            "color:#fff",
            "font-size:12px",
            "font-weight:700",
            "display:flex",
            "align-items:center",
            "justify-content:center",
            "border:2px solid #fff",
            "box-shadow:0 1px 4px rgba(0,0,0,0.35)",
            "cursor:pointer",
          ].join(";");
          el.textContent = String(stopNumber);

          const directionsHref = `https://maps.google.com/?q=${encodeURIComponent(
            opt.address ?? opt.name
          )}`;

          const popup = new mapboxgl.Popup({ offset: 13 }).setHTML(
            `<p style="margin:0 0 2px;font-size:10px;color:#9A8570;font-family:sans-serif;text-transform:uppercase;letter-spacing:0.04em">Option · ${stopName}</p>` +
            `<p style="margin:0 0 ${opt.address ? "4px" : "12px"};padding-right:20px;font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:16px;color:#1C1208;line-height:1.3">${opt.name}</p>` +
            (opt.address ? `<p style="margin:0 0 12px;font-size:11px;color:#9A8570;line-height:1.5">${opt.address}</p>` : "") +
            `<a href="${directionsHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:6px 14px;background:${color};color:#fff;border-radius:7px;font-size:12px;font-weight:500;text-decoration:none;font-family:sans-serif">Get Directions</a>`
          );

          new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(map);

          bounds.extend([lng, lat]);
        });

        // Restore saved viewport if the user is returning to the same day;
        // otherwise fit to all pins.
        if (savedViewport?.forDay === selectedDay) {
          map.jumpTo({ center: savedViewport.center, zoom: savedViewport.zoom });
        } else {
          map.fitBounds(bounds, { padding: 60, maxZoom: 10, animate: false });
        }
      }

      mapContainer.current.addEventListener("click", handlePopupClick);

      // Persist viewport whenever the user pans or zooms.
      map.on("moveend", () => {
        if (!cancelled) {
          onViewportChange?.({
            center: map.getCenter().toArray() as [number, number],
            zoom: map.getZoom(),
            forDay: selectedDay,
          });
        }
      });
    });

    return () => {
      cancelled = true;
      mapContainer.current?.removeEventListener("click", handlePopupClick);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // Re-initialise the map whenever the selected day changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  return (
    <div className="flex flex-col">
      {days.length > 0 && (
        <DaySelector
          days={days}
          selectedDay={selectedDay}
          onSelect={onSelectDay}
        />
      )}

      {hasAnyPins ? (
        <>
          <div
            ref={mapContainer}
            className="w-full"
            style={{ height: "calc(100dvh - 272px)", minHeight: "320px" }}
            aria-label="Trip map"
          />
          {activeHotel != null && (
            <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted border-t border-parchment-dark">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#6B4C2A" }} />
                Hotel
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <p className="text-sm text-muted">No mappable stops for this day.</p>
          <p className="mt-1 text-xs text-muted">
            Stops need a geocoded address to appear on the map.
          </p>
        </div>
      )}
    </div>
  );
}
