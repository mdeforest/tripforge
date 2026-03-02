import { useState, useEffect, useRef } from "react";

// ============================================================
// TRIPFORGE — Interactive Design Prototype
// Aesthetic: Warm cartographic adventure — rich terracotta,
// aged parchment, forest ink. Like a beautiful travel journal
// meets a modern app.
// ============================================================

const COLORS = {
  rust: "#B85C30",
  rustLight: "#D4743E",
  rustDark: "#8B3E1C",
  parchment: "#F5EDD9",
  parchmentDark: "#EAD9BC",
  parchmentDeep: "#D9C49A",
  ink: "#1C1208",
  inkLight: "#3D2B14",
  inkMid: "#6B4C2A",
  forest: "#2E5E35",
  forestLight: "#4A8A54",
  sage: "#8FAF7E",
  sky: "#4A7C9E",
  cream: "#FAF6EE",
  white: "#FFFFFF",
  muted: "#9A8570",
};

const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${COLORS.cream}; font-family: 'DM Sans', sans-serif; color: ${COLORS.ink}; }
  
  .cormorant { font-family: 'Cormorant Garamond', serif; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  
  .fade-up { animation: fadeUp 0.5s ease forwards; }
  .fade-in { animation: fadeIn 0.3s ease forwards; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${COLORS.parchment}; }
  ::-webkit-scrollbar-thumb { background: ${COLORS.parchmentDeep}; border-radius: 2px; }
`;

// ============================================================
// MOCK DATA
// ============================================================

const mockTrip = {
  name: "Tuscany & Amalfi",
  destination: "Italy",
  dates: "Jun 14 – Jun 24, 2025",
  days: [
    {
      day: 1, label: "Arrival in Florence", date: "Jun 14",
      stops: [
        { id: 1, type: "transport", time: "2:00 PM", name: "Arrive at FLR Airport", address: "Florence Airport, Italy", notes: "Pick up rental car. Avis counter in arrivals." },
        { id: 2, type: "hotel", time: "4:00 PM", name: "Hotel Lungarno", address: "Borgo San Jacopo, 14, Florence", notes: "Check-in. Room booked with Arno river view." },
        { id: 3, type: "restaurant", time: "8:00 PM", name: "Buca Mario", address: "Piazza degli Ottaviani 16r, Florence", notes: "Oldest restaurant in Florence. Try the ribollita." },
      ]
    },
    {
      day: 2, label: "Florence Museums", date: "Jun 15",
      stops: [
        { id: 4, type: "activity", time: "9:00 AM", name: "Uffizi Gallery", address: "Piazzale degli Uffizi, 6, Florence", notes: "Tickets pre-booked. Allow 3 hours minimum." },
        { id: 5, type: "restaurant", time: "1:00 PM", name: "Trattoria Mario", address: "Via Rosina, 2, Florence", notes: "Cash only. Arrive early — shared tables." },
        { id: 6, type: "activity", time: "3:30 PM", name: "Ponte Vecchio & Oltrarno", address: "Ponte Vecchio, Florence", notes: "Golden hour walk across the bridge." },
      ]
    },
    {
      day: 3, label: "Siena Day Trip", date: "Jun 16",
      stops: [
        { id: 7, type: "transport", time: "9:30 AM", name: "Drive to Siena", address: "Siena, Italy", notes: "~1.5 hrs via SR2. Park at Stadio Artemio Franchi." },
        { id: 8, type: "activity", time: "11:00 AM", name: "Piazza del Campo", address: "Piazza del Campo, Siena", notes: "The shell-shaped medieval piazza. Grab a coffee at Caffè Fonte Gaia." },
        { id: 9, type: "activity", time: "12:30 PM", name: "Siena Cathedral", address: "Piazza del Duomo, 8, Siena", notes: "Stunning black-and-white marble. Museum pass included." },
      ]
    },
  ],
  packingList: [
    { id: 1, category: "Documents", label: "Passport", checked: true },
    { id: 2, category: "Documents", label: "Travel insurance card", checked: true },
    { id: 3, category: "Documents", label: "Hotel confirmations printed", checked: false },
    { id: 4, category: "Clothing", label: "Lightweight linen shirts (×4)", checked: false },
    { id: 5, category: "Clothing", label: "Walking shoes (broken in)", checked: true },
    { id: 6, category: "Clothing", label: "Smart dinner outfit", checked: false },
    { id: 7, category: "Tech", label: "EU power adapter", checked: true },
    { id: 8, category: "Tech", label: "Portable charger", checked: false },
    { id: 9, category: "Tech", label: "Noise-cancelling headphones", checked: false },
    { id: 10, category: "Toiletries", label: "Sunscreen SPF 50", checked: false },
    { id: 11, category: "Toiletries", label: "Prescription medications", checked: true },
    { id: 12, category: "Misc", label: "Travel journal + pen", checked: false },
    { id: 13, category: "Misc", label: "Pocket Italian phrasebook", checked: false },
  ]
};

const chatHistory = [
  { role: "assistant", content: "Ciao! I know your Tuscany & Amalfi itinerary inside out. What can I help you with?" },
];

// ============================================================
// SHARED COMPONENTS
// ============================================================

function Icon({ type, size = 16, color }) {
  const icons = {
    hotel: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8">
        <path d="M3 22V8l9-6 9 6v14H3z"/><path d="M9 22V14h6v8"/>
      </svg>
    ),
    restaurant: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
      </svg>
    ),
    activity: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    transport: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8">
        <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="9" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>
      </svg>
    ),
    map: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
      </svg>
    ),
    chat: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    check: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2.2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    list: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
    arrow_left: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    ),
    arrow_right: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    ),
    plus: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    ),
    upload: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8">
        <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
      </svg>
    ),
    pin: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color || "currentColor"} stroke="none">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    ),
    plane: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color || "currentColor"} stroke="none">
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>
    ),
    sparkle: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8">
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
        <path d="M19 17l.75 2.25L22 20l-2.25.75L19 23l-.75-2.25L16 20l2.25-.75L19 17z"/>
      </svg>
    ),
  };
  return icons[type] || null;
}

const stopColors = {
  hotel: { bg: "#FFF3E0", icon: COLORS.rust },
  restaurant: { bg: "#FBE9E7", icon: "#C62828" },
  activity: { bg: "#E8F5E9", icon: COLORS.forest },
  transport: { bg: "#E3F2FD", icon: COLORS.sky },
  other: { bg: COLORS.parchment, icon: COLORS.muted },
};

// ============================================================
// SCREENS
// ============================================================

function LandingScreen({ onNavigate }) {
  return (
    <div style={{
      minHeight: "100%",
      background: COLORS.ink,
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Texture overlay */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `radial-gradient(ellipse at 20% 50%, ${COLORS.rustDark}33 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, ${COLORS.forest}22 0%, transparent 50%)`,
        pointerEvents: "none",
      }}/>

      {/* Map grid lines */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.06,
        backgroundImage: `linear-gradient(${COLORS.parchment} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.parchment} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }}/>

      {/* Nav */}
      <div style={{ padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon type="plane" size={20} color={COLORS.rust} />
          <span className="cormorant" style={{ fontSize: 22, fontWeight: 700, color: COLORS.parchment, letterSpacing: "0.02em" }}>TripForge</span>
        </div>
        <button
          onClick={() => onNavigate("dashboard")}
          style={{
            background: COLORS.rust, color: COLORS.cream, border: "none",
            padding: "9px 20px", borderRadius: 8, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
          }}
        >
          Sign in
        </button>
      </div>

      {/* Hero */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 32px", position: "relative" }}>
        <div className="cormorant fade-up" style={{ fontSize: 13, letterSpacing: "0.2em", color: COLORS.rust, textTransform: "uppercase", marginBottom: 20 }}>
          Your itinerary. Your companion.
        </div>
        <h1 className="cormorant" style={{
          fontSize: "clamp(52px, 8vw, 88px)", fontWeight: 700, color: COLORS.parchment,
          textAlign: "center", lineHeight: 1.05, marginBottom: 28,
          animation: "fadeUp 0.6s 0.1s ease both",
        }}>
          Travel like<br /><em style={{ color: COLORS.rust }}>you planned it.</em>
        </h1>
        <p style={{
          color: COLORS.muted, fontSize: 17, textAlign: "center", maxWidth: 480,
          lineHeight: 1.7, marginBottom: 48, fontWeight: 300,
          animation: "fadeUp 0.6s 0.2s ease both",
        }}>
          Upload any itinerary document. Get a beautiful, AI-powered travel companion — maps, chat assistant, packing list, and offline access.
        </p>
        <div style={{ display: "flex", gap: 12, animation: "fadeUp 0.6s 0.3s ease both" }}>
          <button
            onClick={() => onNavigate("upload")}
            style={{
              background: COLORS.rust, color: COLORS.cream, border: "none",
              padding: "14px 32px", borderRadius: 10, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 500,
              boxShadow: `0 8px 32px ${COLORS.rust}44`,
            }}
          >
            Upload your itinerary →
          </button>
          <button
            onClick={() => onNavigate("trip")}
            style={{
              background: "transparent", color: COLORS.parchment,
              border: `1px solid ${COLORS.inkMid}`,
              padding: "14px 32px", borderRadius: 10, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 400,
            }}
          >
            See a demo trip
          </button>
        </div>
      </div>

      {/* Preview card */}
      <div style={{ padding: "0 32px 64px", display: "flex", justifyContent: "center" }}>
        <div style={{
          background: `${COLORS.inkLight}88`, backdropFilter: "blur(12px)",
          border: `1px solid ${COLORS.inkMid}`,
          borderRadius: 20, padding: "20px 28px", maxWidth: 520, width: "100%",
          animation: "fadeUp 0.6s 0.4s ease both",
        }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["PDF", "Word Doc", "Paste text", "Google Docs"].map(f => (
              <span key={f} style={{
                background: `${COLORS.rust}22`, color: COLORS.rustLight,
                padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500,
              }}>{f}</span>
            ))}
          </div>
          <div style={{ color: COLORS.parchment, fontSize: 14, fontWeight: 300, lineHeight: 1.6, opacity: 0.8 }}>
            "10-day Tuscany & Amalfi itinerary. Arriving Florence June 14, hotels in Siena and Positano..."
          </div>
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.forestLight, animation: "pulse 1.5s infinite" }}/>
            <span style={{ color: COLORS.sage, fontSize: 13 }}>AI parsing your itinerary...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardScreen({ onNavigate }) {
  const trips = [
    { id: 1, name: "Tuscany & Amalfi", destination: "Italy", dates: "Jun 14 – 24, 2025", days: 10, cover: "🇮🇹" },
    { id: 2, name: "Kyoto in Autumn", destination: "Japan", dates: "Oct 3 – 12, 2025", days: 9, cover: "🇯🇵" },
  ];

  return (
    <div style={{ minHeight: "100%", background: COLORS.cream }}>
      {/* Header */}
      <div style={{
        background: COLORS.ink, padding: "20px 28px",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon type="plane" size={18} color={COLORS.rust} />
          <span className="cormorant" style={{ fontSize: 20, fontWeight: 700, color: COLORS.parchment }}>TripForge</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: COLORS.rust, display: "flex", alignItems: "center", justifyContent: "center",
            color: COLORS.cream, fontSize: 14, fontWeight: 600,
          }}>A</div>
        </div>
      </div>

      <div style={{ padding: "32px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
          <div>
            <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 4 }}>Good afternoon</p>
            <h2 className="cormorant" style={{ fontSize: 34, fontWeight: 700, color: COLORS.ink }}>Your Trips</h2>
          </div>
          <button
            onClick={() => onNavigate("upload")}
            style={{
              background: COLORS.rust, color: COLORS.cream, border: "none",
              padding: "10px 18px", borderRadius: 10, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Icon type="plus" size={15} color={COLORS.cream} />
            New Trip
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {trips.map((trip, i) => (
            <div
              key={trip.id}
              onClick={() => onNavigate("trip")}
              style={{
                background: COLORS.white, borderRadius: 16, overflow: "hidden",
                border: `1px solid ${COLORS.parchmentDark}`,
                cursor: "pointer", display: "flex",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                animation: `fadeUp 0.4s ${i * 0.1}s ease both`,
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)"; }}
            >
              <div style={{
                width: 100, background: COLORS.parchment,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 42, flexShrink: 0,
              }}>
                {trip.cover}
              </div>
              <div style={{ padding: "20px 24px", flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 className="cormorant" style={{ fontSize: 22, fontWeight: 700, color: COLORS.ink, marginBottom: 4 }}>{trip.name}</h3>
                    <p style={{ color: COLORS.muted, fontSize: 13 }}>{trip.destination} · {trip.dates}</p>
                  </div>
                  <span style={{
                    background: COLORS.parchment, color: COLORS.inkMid,
                    padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                  }}>{trip.days} days</span>
                </div>
                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                  {["Itinerary", "Map", "Chat", "Checklist"].map(t => (
                    <span key={t} style={{
                      background: COLORS.parchment, color: COLORS.inkMid,
                      padding: "3px 10px", borderRadius: 6, fontSize: 12,
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UploadScreen({ onNavigate }) {
  const [mode, setMode] = useState("file");
  const [dragging, setDragging] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [parsing, setParsing] = useState(false);

  const handleUpload = () => {
    setUploaded(true);
    setTimeout(() => {
      setParsing(true);
      setTimeout(() => onNavigate("review"), 2500);
    }, 400);
  };

  return (
    <div style={{ minHeight: "100%", background: COLORS.cream }}>
      <div style={{ background: COLORS.ink, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => onNavigate("dashboard")} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.parchment, display: "flex", alignItems: "center" }}>
          <Icon type="arrow_left" size={20} color={COLORS.parchment} />
        </button>
        <span className="cormorant" style={{ fontSize: 20, fontWeight: 600, color: COLORS.parchment }}>New Trip</span>
      </div>

      <div style={{ padding: "36px 28px" }}>
        <div style={{ marginBottom: 32 }}>
          <h2 className="cormorant" style={{ fontSize: 30, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>Upload your itinerary</h2>
          <p style={{ color: COLORS.muted, fontSize: 15, lineHeight: 1.6 }}>TripForge's AI will read it and build your travel companion.</p>
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, background: COLORS.parchment, padding: 4, borderRadius: 10 }}>
          {[{ id: "file", label: "File upload" }, { id: "text", label: "Paste text" }, { id: "gdocs", label: "Google Docs" }].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              flex: 1, padding: "9px 0", border: "none", cursor: "pointer",
              borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
              background: mode === m.id ? COLORS.white : "transparent",
              color: mode === m.id ? COLORS.ink : COLORS.muted,
              boxShadow: mode === m.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.2s",
            }}>{m.label}</button>
          ))}
        </div>

        {mode === "file" && !parsing && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleUpload(); }}
            onClick={handleUpload}
            style={{
              border: `2px dashed ${dragging ? COLORS.rust : uploaded ? COLORS.forest : COLORS.parchmentDeep}`,
              borderRadius: 16, padding: "60px 32px",
              display: "flex", flexDirection: "column", alignItems: "center",
              cursor: "pointer", transition: "all 0.2s",
              background: dragging ? `${COLORS.rust}08` : uploaded ? `${COLORS.forest}08` : COLORS.white,
              animation: "fadeIn 0.3s ease",
            }}
          >
            {uploaded ? (
              <>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${COLORS.forest}22`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Icon type="check" size={26} color={COLORS.forest} />
                </div>
                <p style={{ fontWeight: 600, color: COLORS.forest, marginBottom: 4 }}>tuscany-trip.pdf uploaded</p>
                <p style={{ color: COLORS.muted, fontSize: 13 }}>Starting AI parse...</p>
              </>
            ) : (
              <>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: COLORS.parchment, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Icon type="upload" size={26} color={COLORS.rust} />
                </div>
                <p style={{ fontWeight: 600, color: COLORS.ink, marginBottom: 8 }}>Drop your itinerary here</p>
                <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>PDF, Word doc — up to 10MB</p>
                <span style={{
                  background: COLORS.rust, color: COLORS.cream,
                  padding: "9px 22px", borderRadius: 8, fontSize: 14, fontWeight: 500,
                }}>Browse files</span>
              </>
            )}
          </div>
        )}

        {mode === "text" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <textarea
              placeholder="Paste your itinerary text here...&#10;&#10;Day 1 – Florence&#10;2:00 PM – Arrive at FLR Airport&#10;4:00 PM – Check in to Hotel Lungarno..."
              style={{
                width: "100%", height: 220, padding: "16px", borderRadius: 12,
                border: `1px solid ${COLORS.parchmentDeep}`, background: COLORS.white,
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.7,
                color: COLORS.ink, resize: "vertical",
                outline: "none",
              }}
            />
            <button
              onClick={() => { setParsing(true); setTimeout(() => onNavigate("review"), 2500); }}
              style={{
                marginTop: 16, background: COLORS.rust, color: COLORS.cream,
                border: "none", padding: "13px 28px", borderRadius: 10,
                fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 500,
                cursor: "pointer", width: "100%",
              }}
            >Parse with AI →</button>
          </div>
        )}

        {mode === "gdocs" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <input
              placeholder="https://docs.google.com/document/d/..."
              style={{
                width: "100%", padding: "14px 16px", borderRadius: 10,
                border: `1px solid ${COLORS.parchmentDeep}`, background: COLORS.white,
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: COLORS.ink,
                outline: "none", marginBottom: 12,
              }}
            />
            <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
              Make sure your doc is set to "Anyone with the link can view."
            </p>
            <button
              onClick={() => { setParsing(true); setTimeout(() => onNavigate("review"), 2500); }}
              style={{
                background: COLORS.rust, color: COLORS.cream,
                border: "none", padding: "13px 28px", borderRadius: 10,
                fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 500,
                cursor: "pointer", width: "100%",
              }}
            >Import & Parse →</button>
          </div>
        )}

        {parsing && (
          <div style={{ textAlign: "center", padding: "48px 0", animation: "fadeIn 0.4s ease" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", margin: "0 auto 24px",
              background: `linear-gradient(135deg, ${COLORS.rust}, ${COLORS.rustDark})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "pulse 1.5s infinite",
            }}>
              <Icon type="sparkle" size={30} color={COLORS.cream} />
            </div>
            <h3 className="cormorant" style={{ fontSize: 24, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>Reading your itinerary...</h3>
            <p style={{ color: COLORS.muted, fontSize: 15 }}>AI is parsing your trip. This takes about 20 seconds.</p>
            <div style={{ marginTop: 28, height: 4, background: COLORS.parchment, borderRadius: 2, overflow: "hidden", maxWidth: 240, margin: "28px auto 0" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: `linear-gradient(90deg, ${COLORS.rust}, ${COLORS.rustLight}, ${COLORS.rust})`,
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s infinite",
                width: "70%",
              }}/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewScreen({ onNavigate }) {
  return (
    <div style={{ minHeight: "100%", background: COLORS.cream }}>
      <div style={{ background: COLORS.ink, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => onNavigate("upload")} style={{ background: "none", border: "none", cursor: "pointer" }}>
          <Icon type="arrow_left" size={20} color={COLORS.parchment} />
        </button>
        <span className="cormorant" style={{ fontSize: 20, fontWeight: 600, color: COLORS.parchment }}>Review Your Trip</span>
      </div>

      <div style={{ padding: "28px 24px" }}>
        <div style={{
          background: `${COLORS.forest}12`, border: `1px solid ${COLORS.forest}30`,
          borderRadius: 12, padding: "14px 18px", marginBottom: 28,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <Icon type="check" size={16} color={COLORS.forest} />
          <span style={{ color: COLORS.forest, fontSize: 14 }}>AI successfully parsed your itinerary — 3 days, 9 stops found.</span>
        </div>

        <h2 className="cormorant" style={{ fontSize: 30, fontWeight: 700, color: COLORS.ink, marginBottom: 4 }}>Tuscany & Amalfi</h2>
        <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 28 }}>Italy · Jun 14 – Jun 24, 2025 · 10 days</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mockTrip.days.map((day, i) => (
            <div key={day.day} style={{
              background: COLORS.white, borderRadius: 14,
              border: `1px solid ${COLORS.parchmentDark}`,
              overflow: "hidden",
              animation: `fadeUp 0.4s ${i * 0.1}s ease both`,
            }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${COLORS.parchment}`, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, color: COLORS.ink, fontSize: 15 }}>Day {day.day} — {day.label}</span>
                <span style={{ color: COLORS.muted, fontSize: 13 }}>{day.date}</span>
              </div>
              <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                {day.stops.map(stop => (
                  <div key={stop.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: stopColors[stop.type]?.bg || COLORS.parchment,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <Icon type={stop.type} size={14} color={stopColors[stop.type]?.icon} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 14, color: COLORS.ink }}>{stop.name}</span>
                      {stop.time && <span style={{ color: COLORS.muted, fontSize: 12, marginLeft: 8 }}>{stop.time}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => onNavigate("trip")}
          style={{
            marginTop: 28, background: COLORS.rust, color: COLORS.cream,
            border: "none", padding: "15px 28px", borderRadius: 12,
            fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 500,
            cursor: "pointer", width: "100%",
            boxShadow: `0 4px 20px ${COLORS.rust}40`,
          }}
        >
          Build my travel companion →
        </button>
      </div>
    </div>
  );
}

function TripScreen({ onNavigate }) {
  const [tab, setTab] = useState("itinerary");
  const [activeDay, setActiveDay] = useState(0);
  const [expandedStop, setExpandedStop] = useState(null);
  const [checklist, setChecklist] = useState(mockTrip.packingList);
  const [chatMessages, setChatMessages] = useState(chatHistory);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef(null);

  const day = mockTrip.days[activeDay];

  const toggleCheck = (id) => {
    setChecklist(cl => cl.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: "user", content: chatInput };
    setChatMessages(m => [...m, userMsg]);
    setChatInput("");
    setChatLoading(true);
    setTimeout(() => {
      const replies = [
        "On Day 2 (June 15), you're visiting the Uffizi Gallery at 9 AM — book at least 3 hours. After, head to Trattoria Mario for lunch (cash only!). The evening is a golden hour walk on Ponte Vecchio.",
        "The drive from Florence to Siena is about 1.5 hours via the SR2 route. I'd recommend leaving by 9:30 AM as planned to have a full morning at Piazza del Campo.",
        "For your trip to Italy, I'd suggest packing comfortable walking shoes (essential — the cobblestones are beautiful but uneven), a light linen layer for evenings, and a small crossbody bag.",
      ];
      setChatMessages(m => [...m, { role: "assistant", content: replies[Math.floor(Math.random() * replies.length)] }]);
      setChatLoading(false);
    }, 1800);
  };

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages, chatLoading]);

  const categories = [...new Set(checklist.map(i => i.category))];
  const checkedCount = checklist.filter(i => i.checked).length;

  const tabs = [
    { id: "itinerary", label: "Itinerary", icon: "list" },
    { id: "map", label: "Map", icon: "map" },
    { id: "chat", label: "Ask AI", icon: "chat" },
    { id: "checklist", label: "Packing", icon: "check" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: COLORS.cream }}>
      {/* Trip header */}
      <div style={{ background: COLORS.ink, padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 2 }}>
          <button onClick={() => onNavigate("dashboard")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
            <Icon type="arrow_left" size={18} color={COLORS.parchment} />
          </button>
          <div>
            <h2 className="cormorant" style={{ fontSize: 20, fontWeight: 700, color: COLORS.parchment, lineHeight: 1 }}>{mockTrip.name}</h2>
            <p style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>{mockTrip.destination} · {mockTrip.dates}</p>
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "auto", position: "relative" }}>

        {/* ITINERARY TAB */}
        {tab === "itinerary" && (
          <div style={{ animation: "fadeIn 0.2s ease" }}>
            {/* Day selector */}
            <div style={{ padding: "16px 20px 0", overflowX: "auto", display: "flex", gap: 8, scrollbarWidth: "none" }}>
              {mockTrip.days.map((d, i) => (
                <button key={i} onClick={() => { setActiveDay(i); setExpandedStop(null); }} style={{
                  flexShrink: 0, padding: "8px 16px", borderRadius: 20, border: "none",
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
                  background: activeDay === i ? COLORS.rust : COLORS.white,
                  color: activeDay === i ? COLORS.cream : COLORS.inkMid,
                  border: `1px solid ${activeDay === i ? COLORS.rust : COLORS.parchmentDark}`,
                  transition: "all 0.2s",
                }}>
                  Day {d.day}<br/>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{d.date}</span>
                </button>
              ))}
            </div>

            <div style={{ padding: "16px 20px" }}>
              <h3 className="cormorant" style={{ fontSize: 24, fontWeight: 700, color: COLORS.ink, marginBottom: 20 }}>
                {day.label}
              </h3>

              {/* Timeline */}
              <div style={{ position: "relative" }}>
                {/* Vertical line */}
                <div style={{
                  position: "absolute", left: 20, top: 8, bottom: 8, width: 2,
                  background: COLORS.parchmentDark,
                }}/>

                {day.stops.map((stop, i) => {
                  const sc = stopColors[stop.type] || stopColors.other;
                  const expanded = expandedStop === stop.id;
                  return (
                    <div key={stop.id} style={{ display: "flex", gap: 16, marginBottom: 16, position: "relative" }}>
                      {/* Icon */}
                      <div style={{
                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                        background: sc.bg, display: "flex", alignItems: "center", justifyContent: "center",
                        border: `2px solid ${COLORS.cream}`, position: "relative", zIndex: 1,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                      }}>
                        <Icon type={stop.type} size={18} color={sc.icon} />
                      </div>

                      {/* Card */}
                      <div
                        onClick={() => setExpandedStop(expanded ? null : stop.id)}
                        style={{
                          flex: 1, background: COLORS.white, borderRadius: 14, padding: "14px 16px",
                          border: `1px solid ${expanded ? COLORS.rust + "40" : COLORS.parchmentDark}`,
                          cursor: "pointer", transition: "all 0.2s",
                          boxShadow: expanded ? `0 4px 20px ${COLORS.rust}15` : "0 1px 6px rgba(0,0,0,0.04)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <p style={{ fontWeight: 600, color: COLORS.ink, fontSize: 15, marginBottom: 2 }}>{stop.name}</p>
                            {stop.time && <p style={{ color: COLORS.muted, fontSize: 12 }}>{stop.time}</p>}
                          </div>
                          <Icon type={expanded ? "arrow_left" : "arrow_right"} size={16} color={COLORS.muted} />
                        </div>
                        {expanded && (
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.parchment}`, animation: "fadeIn 0.2s ease" }}>
                            {stop.address && (
                              <p style={{ color: COLORS.inkMid, fontSize: 13, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                <Icon type="pin" size={14} color={COLORS.rust} />
                                {stop.address}
                              </p>
                            )}
                            {stop.notes && <p style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{stop.notes}</p>}
                            {stop.address && (
                              <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(stop.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                style={{
                                  display: "inline-block", background: COLORS.rust, color: COLORS.cream,
                                  padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                                  textDecoration: "none",
                                }}
                              >
                                Get directions →
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* MAP TAB */}
        {tab === "map" && (
          <div style={{ animation: "fadeIn 0.2s ease" }}>
            {/* Map placeholder */}
            <div style={{
              height: 280, background: `linear-gradient(135deg, #B8C9B5 0%, #A8BCAA 40%, #92A895 100%)`,
              position: "relative", overflow: "hidden",
            }}>
              {/* Grid roads */}
              <div style={{ position: "absolute", inset: 0, opacity: 0.4,
                backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}/>
              {/* Route line */}
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                <path d="M 80 200 Q 160 140 220 160 Q 300 180 360 120" stroke={COLORS.rust} strokeWidth="3" fill="none" strokeDasharray="6 4" opacity="0.8"/>
              </svg>
              {/* Pins */}
              {[{ x: 80, y: 200, label: "1" }, { x: 220, y: 160, label: "2" }, { x: 360, y: 120, label: "3" }].map(p => (
                <div key={p.label} style={{
                  position: "absolute", left: p.x - 14, top: p.y - 34,
                  display: "flex", flexDirection: "column", alignItems: "center",
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)",
                    background: COLORS.rust, display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
                  }}>
                    <span style={{ transform: "rotate(45deg)", color: COLORS.cream, fontSize: 12, fontWeight: 700 }}>{p.label}</span>
                  </div>
                </div>
              ))}
              <div style={{
                position: "absolute", bottom: 12, right: 12, background: "rgba(255,255,255,0.9)",
                borderRadius: 8, padding: "4px 10px", fontSize: 11, color: COLORS.inkMid,
              }}>© Mapbox</div>
            </div>

            <div style={{ padding: "20px" }}>
              <h3 className="cormorant" style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>Day {day.day} Stops</h3>
              {day.stops.filter(s => s.address).map((stop, i) => (
                <div key={stop.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 0", borderBottom: `1px solid ${COLORS.parchment}`,
                  animation: `fadeUp 0.3s ${i * 0.08}s ease both`,
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    background: COLORS.rust, display: "flex", alignItems: "center", justifyContent: "center",
                    color: COLORS.cream, fontSize: 13, fontWeight: 700,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: COLORS.ink }}>{stop.name}</p>
                    <p style={{ color: COLORS.muted, fontSize: 12 }}>{stop.address}</p>
                  </div>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(stop.address)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      background: COLORS.parchment, color: COLORS.rust, padding: "6px 12px",
                      borderRadius: 8, fontSize: 12, fontWeight: 500, textDecoration: "none", flexShrink: 0,
                    }}
                  >Directions</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHAT TAB */}
        {tab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", animation: "fadeIn 0.2s ease" }}>
            <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 14, animation: "fadeUp 0.3s ease",
                }}>
                  {msg.role === "assistant" && (
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", flexShrink: 0, marginRight: 10,
                      background: COLORS.ink, display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-end",
                    }}>
                      <Icon type="sparkle" size={15} color={COLORS.rust} />
                    </div>
                  )}
                  <div style={{
                    maxWidth: "75%", padding: "12px 16px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: msg.role === "user" ? COLORS.rust : COLORS.white,
                    color: msg.role === "user" ? COLORS.cream : COLORS.ink,
                    fontSize: 14, lineHeight: 1.7,
                    border: msg.role === "assistant" ? `1px solid ${COLORS.parchmentDark}` : "none",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon type="sparkle" size={15} color={COLORS.rust} />
                  </div>
                  <div style={{
                    background: COLORS.white, border: `1px solid ${COLORS.parchmentDark}`,
                    borderRadius: "18px 18px 18px 4px", padding: "12px 16px",
                    display: "flex", gap: 4, alignItems: "center",
                  }}>
                    {[0, 1, 2].map(j => (
                      <div key={j} style={{
                        width: 7, height: 7, borderRadius: "50%", background: COLORS.muted,
                        animation: `pulse 1.2s ${j * 0.2}s infinite`,
                      }}/>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Suggested questions */}
            {chatMessages.length <= 1 && (
              <div style={{ padding: "0 20px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["What's on Day 2?", "What should I pack?", "Drive time Siena to Florence?"].map(q => (
                  <button key={q} onClick={() => { setChatInput(q); }} style={{
                    background: COLORS.parchment, border: `1px solid ${COLORS.parchmentDeep}`,
                    color: COLORS.inkMid, padding: "7px 12px", borderRadius: 20,
                    fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  }}>{q}</button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${COLORS.parchment}`, background: COLORS.white, display: "flex", gap: 10 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Ask about your trip..."
                style={{
                  flex: 1, padding: "11px 16px", borderRadius: 24, border: `1px solid ${COLORS.parchmentDark}`,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: COLORS.ink, background: COLORS.cream,
                  outline: "none",
                }}
              />
              <button onClick={sendMessage} style={{
                width: 44, height: 44, borderRadius: "50%", border: "none",
                background: COLORS.rust, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon type="arrow_right" size={18} color={COLORS.cream} />
              </button>
            </div>
          </div>
        )}

        {/* CHECKLIST TAB */}
        {tab === "checklist" && (
          <div style={{ padding: "20px", animation: "fadeIn 0.2s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
              <div>
                <h3 className="cormorant" style={{ fontSize: 26, fontWeight: 700, color: COLORS.ink }}>Packing List</h3>
                <p style={{ color: COLORS.muted, fontSize: 13 }}>{checkedCount} of {checklist.length} packed</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{
                  width: 60, height: 60, borderRadius: "50%", position: "relative",
                  background: `conic-gradient(${COLORS.forest} ${checkedCount / checklist.length * 360}deg, ${COLORS.parchment} 0deg)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: 46, height: 46, borderRadius: "50%", background: COLORS.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.forest }}>{Math.round(checkedCount / checklist.length * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {categories.map((cat, ci) => (
              <div key={cat} style={{ marginBottom: 24, animation: `fadeUp 0.4s ${ci * 0.08}s ease both` }}>
                <h4 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: COLORS.muted, marginBottom: 10 }}>{cat}</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {checklist.filter(i => i.category === cat).map(item => (
                    <div
                      key={item.id}
                      onClick={() => toggleCheck(item.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                        background: item.checked ? `${COLORS.forest}08` : COLORS.white,
                        borderRadius: 10, cursor: "pointer",
                        border: `1px solid ${item.checked ? COLORS.forest + "25" : COLORS.parchmentDark}`,
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        border: `2px solid ${item.checked ? COLORS.forest : COLORS.parchmentDeep}`,
                        background: item.checked ? COLORS.forest : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.2s",
                      }}>
                        {item.checked && <Icon type="check" size={13} color={COLORS.cream} />}
                      </div>
                      <span style={{
                        fontSize: 14, color: item.checked ? COLORS.muted : COLORS.ink,
                        textDecoration: item.checked ? "line-through" : "none",
                        transition: "all 0.2s",
                      }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <div style={{
        background: COLORS.white, borderTop: `1px solid ${COLORS.parchment}`,
        display: "flex", padding: "8px 0 12px", flexShrink: 0,
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            border: "none", background: "none", cursor: "pointer",
            color: tab === t.id ? COLORS.rust : COLORS.muted,
            transition: "color 0.2s",
          }}>
            <Icon type={t.icon} size={20} color={tab === t.id ? COLORS.rust : COLORS.muted} />
            <span style={{ fontSize: 11, fontWeight: tab === t.id ? 600 : 400, fontFamily: "'DM Sans', sans-serif" }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StyleGuideScreen({ onNavigate }) {
  return (
    <div style={{ minHeight: "100%", background: COLORS.cream, padding: "28px 24px" }}>
      <button onClick={() => onNavigate("landing")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: COLORS.rust, marginBottom: 24, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
        <Icon type="arrow_left" size={16} color={COLORS.rust} /> Back
      </button>

      <h2 className="cormorant" style={{ fontSize: 32, fontWeight: 700, color: COLORS.ink, marginBottom: 6 }}>Design System</h2>
      <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 32 }}>TripForge visual language — tokens, type, components</p>

      {/* Colors */}
      <h3 style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: COLORS.muted, marginBottom: 14 }}>Color Palette</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 36 }}>
        {[
          { name: "Rust", hex: COLORS.rust, label: "#B85C30" },
          { name: "Rust Light", hex: COLORS.rustLight, label: "#D4743E" },
          { name: "Parchment", hex: COLORS.parchment, label: "#F5EDD9" },
          { name: "Ink", hex: COLORS.ink, label: "#1C1208" },
          { name: "Forest", hex: COLORS.forest, label: "#2E5E35" },
          { name: "Sage", hex: COLORS.sage, label: "#8FAF7E" },
          { name: "Sky", hex: COLORS.sky, label: "#4A7C9E" },
          { name: "Muted", hex: COLORS.muted, label: "#9A8570" },
        ].map(c => (
          <div key={c.name}>
            <div style={{ height: 56, borderRadius: 10, background: c.hex, marginBottom: 6, border: `1px solid rgba(0,0,0,0.1)` }} />
            <p style={{ fontSize: 12, fontWeight: 600, color: COLORS.ink }}>{c.name}</p>
            <p style={{ fontSize: 11, color: COLORS.muted }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Typography */}
      <h3 style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: COLORS.muted, marginBottom: 14 }}>Typography</h3>
      <div style={{ background: COLORS.white, borderRadius: 14, padding: "24px", border: `1px solid ${COLORS.parchmentDark}`, marginBottom: 36 }}>
        <p className="cormorant" style={{ fontSize: 42, fontWeight: 700, color: COLORS.ink, marginBottom: 4 }}>Cormorant Garamond</p>
        <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 20 }}>Display font — Headlines, trip names, section titles</p>
        <p className="cormorant" style={{ fontSize: 22, color: COLORS.ink, fontStyle: "italic", marginBottom: 20 }}>Every journey begins with a single step.</p>
        <div style={{ borderTop: `1px solid ${COLORS.parchment}`, paddingTop: 20 }}>
          <p style={{ fontSize: 16, color: COLORS.ink, marginBottom: 6 }}>DM Sans — Body text, UI labels</p>
          <p style={{ fontSize: 14, color: COLORS.muted, fontWeight: 300, lineHeight: 1.7 }}>
            Clean, humanist sans-serif for all interface text. Light (300) for body copy, Regular (400) for labels, Medium (500) for interactive elements, SemiBold (600) for emphasis.
          </p>
        </div>
      </div>

      {/* Components */}
      <h3 style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: COLORS.muted, marginBottom: 14 }}>Components</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Buttons */}
        <div style={{ background: COLORS.white, borderRadius: 14, padding: "20px", border: `1px solid ${COLORS.parchmentDark}` }}>
          <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>Buttons</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={{ background: COLORS.rust, color: COLORS.cream, border: "none", padding: "10px 22px", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Primary</button>
            <button style={{ background: "transparent", color: COLORS.ink, border: `1px solid ${COLORS.parchmentDeep}`, padding: "10px 22px", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 14, cursor: "pointer" }}>Secondary</button>
            <button style={{ background: COLORS.parchment, color: COLORS.rust, border: "none", padding: "10px 22px", borderRadius: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Ghost</button>
          </div>
        </div>

        {/* Stop type badges */}
        <div style={{ background: COLORS.white, borderRadius: 14, padding: "20px", border: `1px solid ${COLORS.parchmentDark}` }}>
          <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>Stop Type Icons</p>
          <div style={{ display: "flex", gap: 10 }}>
            {Object.entries(stopColors).filter(([k]) => k !== "other").map(([type, sc]) => (
              <div key={type} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: sc.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon type={type} size={18} color={sc.icon} />
                </div>
                <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "capitalize" }}>{type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// NAV BAR (prototype controls)
// ============================================================

const screens = [
  { id: "landing", label: "Landing" },
  { id: "dashboard", label: "Dashboard" },
  { id: "upload", label: "Upload" },
  { id: "review", label: "Review" },
  { id: "trip", label: "Companion" },
  { id: "styleguide", label: "Style Guide" },
];

export default function App() {
  const [screen, setScreen] = useState("landing");

  const renderScreen = () => {
    switch (screen) {
      case "landing": return <LandingScreen onNavigate={setScreen} />;
      case "dashboard": return <DashboardScreen onNavigate={setScreen} />;
      case "upload": return <UploadScreen onNavigate={setScreen} />;
      case "review": return <ReviewScreen onNavigate={setScreen} />;
      case "trip": return <TripScreen onNavigate={setScreen} />;
      case "styleguide": return <StyleGuideScreen onNavigate={setScreen} />;
      default: return null;
    }
  };

  return (
    <>
      <style>{fonts}</style>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "'DM Sans', sans-serif" }}>
        {/* Prototype nav */}
        <div style={{
          background: COLORS.inkLight, borderBottom: `1px solid #2C1810`,
          padding: "8px 16px", display: "flex", gap: 6, alignItems: "center", flexShrink: 0, overflowX: "auto",
        }}>
          <span style={{ color: COLORS.muted, fontSize: 11, fontWeight: 500, marginRight: 4, whiteSpace: "nowrap" }}>PROTOTYPE</span>
          {screens.map(s => (
            <button key={s.id} onClick={() => setScreen(s.id)} style={{
              padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
              background: screen === s.id ? COLORS.rust : "transparent",
              color: screen === s.id ? COLORS.cream : COLORS.muted,
              transition: "all 0.15s",
            }}>{s.label}</button>
          ))}
        </div>

        {/* Screen */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {renderScreen()}
        </div>
      </div>
    </>
  );
}
