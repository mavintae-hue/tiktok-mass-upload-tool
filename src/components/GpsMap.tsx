"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Color mapping system
const STAFF_COLORS_MAP: Record<string, { hex: string; tw: string }> = {
  blue: { hex: "#3b82f6", tw: "blue" },
  orange: { hex: "#f97316", tw: "orange" },
  purple: { hex: "#8b5cf6", tw: "purple" },
  teal: { hex: "#14b8a6", tw: "teal" },
  amber: { hex: "#f59e0b", tw: "amber" },
  pink: { hex: "#ec4899", tw: "pink" },
  emerald: { hex: "#10b981", tw: "emerald" },
  indigo: { hex: "#6366f1", tw: "indigo" },
  rose: { hex: "#f43f5e", tw: "rose" },
  cyan: { hex: "#06b6d4", tw: "cyan" },
  lime: { hex: "#84cc16", tw: "lime" },
  violet: { hex: "#7c3aed", tw: "violet" },
  fuchsia: { hex: "#d946ef", tw: "fuchsia" },
  sky: { hex: "#0ea5e9", tw: "sky" },
  red: { hex: "#ef4444", tw: "red" },
  slate: { hex: "#64748b", tw: "slate" },
};

function getStaffColor(staffId: string, indexOffset: number) {
  const keys = Object.keys(STAFF_COLORS_MAP);
  const colorKey = keys[indexOffset % keys.length];
  return STAFF_COLORS_MAP[colorKey];
}

interface Staff {
  id: string;
  name: string;
  color?: string;
}

interface Customer {
  id: string;
  name: string;
  customer_code?: string;
  customer_type?: string;
  lat: number;
  lng: number;
  staff_id?: string;
  district?: string;
}

interface GpsLog {
  staff_id: string;
  lat: number;
  lng: number;
  timestamp: string;
  speed?: number;
  battery?: number;
  is_mock?: boolean;
  in_territory?: boolean;
}

interface Territory {
  staff_id: string;
  territory: {
    name: string;
    geojson: any;
  };
}

interface GpsMapProps {
  staffs: Staff[];
  customers: Customer[];
  visitedIds: Set<string>;
  latestLogs: Record<string, GpsLog>;
  historicalLogs: GpsLog[];
  territories: Territory[];
  hideTerritories: boolean;
  hideUnvisited: boolean;
  referenceTime: number; // for playback
  isPlayback: boolean;
  selectedStaffIds: Set<string>;
}

export default function GpsMap({
  staffs,
  customers,
  visitedIds,
  latestLogs,
  historicalLogs,
  territories,
  hideTerritories,
  hideUnvisited,
  referenceTime,
  isPlayback,
  selectedStaffIds,
}: GpsMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Layer groups
  const staffLayerGroup = useRef<L.LayerGroup | null>(null);
  const customerLayerGroup = useRef<L.LayerGroup | null>(null);
  const pathLayerGroup = useRef<L.LayerGroup | null>(null);
  const territoryLayerGroup = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create Leaflet Map instance
    const initialLat = 14.723;
    const initialLng = 100.783;
    const leafletMap = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([initialLat, initialLng], 12);

    L.control.zoom({ position: "bottomright" }).addTo(leafletMap);

    // Dark Premium map layer that fits the dark-mode aesthetic
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }
    ).addTo(leafletMap);

    mapRef.current = leafletMap;

    // Initialize layer groups
    staffLayerGroup.current = L.layerGroup().addTo(leafletMap);
    customerLayerGroup.current = L.layerGroup().addTo(leafletMap);
    pathLayerGroup.current = L.layerGroup().addTo(leafletMap);
    territoryLayerGroup.current = L.layerGroup().addTo(leafletMap);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map contents whenever props change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 1. Clear previous layers
    staffLayerGroup.current?.clearLayers();
    customerLayerGroup.current?.clearLayers();
    pathLayerGroup.current?.clearLayers();
    territoryLayerGroup.current?.clearLayers();

    const bounds: L.LatLngTuple[] = [];

    // Helper to get staff details
    const getStaffDetails = (sid: string) => {
      const idx = staffs.findIndex((s) => s.id === sid);
      const staff = staffs[idx];
      const color = getStaffColor(sid, idx >= 0 ? idx : 0);
      return { staff, color };
    };

    // 2. Draw Geofence Territories
    if (!hideTerritories && territoryLayerGroup.current) {
      territories.forEach((t) => {
        if (!selectedStaffIds.has(t.staff_id)) return;
        if (!t.territory || !t.territory.geojson) return;

        let geojsonObj = t.territory.geojson;
        if (typeof geojsonObj === "string") {
          try {
            geojsonObj = JSON.parse(geojsonObj);
          } catch (e) {
            return;
          }
        }

        const { color } = getStaffDetails(t.staff_id);

        L.geoJSON(geojsonObj, {
          style: {
            color: color.hex,
            weight: 2,
            opacity: 0.7,
            fillColor: color.hex,
            fillOpacity: 0.04,
            dashArray: "5, 8",
          },
        })
          .bindPopup(
            `<div class="font-sans text-center text-xs"><b>พื้นที่โซน ${t.staff_id} (${t.territory.name})</b></div>`
          )
          .addTo(territoryLayerGroup.current!);
      });
    }

    // 3. Draw Customers / Stores
    if (customerLayerGroup.current) {
      customers.forEach((cust) => {
        const sid = cust.staff_id || "_none";
        if (cust.staff_id && !selectedStaffIds.has(cust.staff_id)) return;

        const isVisited = visitedIds.has(cust.id);
        if (hideUnvisited && !isVisited) return;

        const { color } = getStaffDetails(sid);

        // Customize marker based on whether it has been visited today
        const radius = isVisited ? 6 : 4;
        const fillColor = isVisited ? "#10b981" : color.hex;
        const strokeColor = isVisited ? "#047857" : "#FFFFFF";
        const weight = isVisited ? 2.5 : 1;

        const popupContent = `
          <div class="font-sans min-w-[170px] text-xs">
            <div class="flex items-center gap-1.5 mb-1">
              ${cust.staff_id ? `<span class="bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 px-1.5 py-0.5 rounded text-[9px] font-bold">${cust.staff_id}</span>` : ""}
              <b class="text-[12px] text-slate-800 leading-tight">${cust.name}</b>
            </div>
            ${cust.customer_code ? `<div class="text-[10px] text-slate-500 font-mono">Code: ${cust.customer_code}</div>` : ""}
            ${cust.customer_type ? `<div class="text-[10px] text-slate-400">Type: ${cust.customer_type}</div>` : ""}
            ${cust.district ? `<div class="text-[10px] text-slate-400">Zone: ${cust.district}</div>` : ""}
            ${
              isVisited
                ? '<div class="mt-1.5 text-emerald-600 font-bold text-[10px] flex items-center gap-1">✓ เยี่ยมแล้ววันนี้</div>'
                : '<div class="mt-1.5 text-slate-400 font-medium text-[10px]">⏰ ยังไม่ได้เยี่ยม</div>'
            }
          </div>
        `;

        L.circleMarker([cust.lat, cust.lng], {
          radius,
          fillColor,
          color: strokeColor,
          weight,
          fillOpacity: 0.85,
        })
          .bindPopup(popupContent)
          .addTo(customerLayerGroup.current!);
      });
    }

    // 4. Draw Staff Markers (Cars)
    if (staffLayerGroup.current) {
      Object.entries(latestLogs).forEach(([sid, log]) => {
        if (!selectedStaffIds.has(sid)) return;
        if (!log.lat || !log.lng) return;

        const { staff, color } = getStaffDetails(sid);
        const name = staff?.name || sid;

        // Custom sophisticated div icon for vehicle
        const logTimeMs = new Date(log.timestamp).getTime();
        const timeDiffMs = referenceTime - logTimeMs;

        let status = "online";
        if (timeDiffMs > 25 * 60 * 1000) {
          status = "offline";
        } else if (timeDiffMs > 5 * 60 * 1000) {
          status = "idle";
        }

        const isMock = log.is_mock;
        const isOutOfBounds = log.in_territory === false;

        let statusBg = `bg-${color.tw}-500`;
        let iconColor = `text-${color.tw}-400`;
        if (status === "offline") {
          statusBg = "bg-slate-600";
          iconColor = "text-slate-500";
        } else if (status === "idle") {
          statusBg = "bg-amber-500";
          iconColor = "text-amber-400";
        }
        if (isOutOfBounds && status !== "offline") {
          statusBg = "bg-rose-600";
          iconColor = "text-rose-500 animate-pulse";
        }

        const boundsGlow = (isOutOfBounds && status !== "offline") ? "drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse" : "";
        const mockBadge = isMock ? '<div class="absolute -top-6 bg-red-500 text-white text-[8px] font-bold px-1 py-0.5 rounded animate-bounce">MOCK</div>' : "";

        const customIcon = L.divIcon({
          html: `
            <div class="relative flex flex-col items-center justify-center ${boundsGlow} transition-transform duration-300 hover:scale-110">
              ${mockBadge}
              <div class="${statusBg} text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow border border-white/30 whitespace-nowrap z-10 font-mono">
                ${sid}
              </div>
              <svg class="${iconColor} w-8 h-8 drop-shadow-md -mt-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.27-3.82c.14-.4.52-.68.95-.68h9.56c.43 0 .81.28.95.68L19 11H5z"/>
              </svg>
            </div>
          `,
          className: "",
          iconSize: [40, 50],
          iconAnchor: [20, 45],
          popupAnchor: [0, -40],
        });

        // Set bounds to auto-fit
        bounds.push([log.lat, log.lng]);

        const speed = log.speed ?? 0;
        const battery = log.battery ?? 100;
        const localTimeStr = new Date(log.timestamp).toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const popupContent = `
          <div class="font-sans text-xs text-center min-w-[170px]">
            <div class="flex items-center justify-center gap-1.5 mb-1.5">
              <span class="bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-mono font-bold">${sid}</span>
              <b class="text-slate-800">${name}</b>
            </div>
            <div class="text-[10px] text-slate-500 mb-2">อัปเดต: ${localTimeStr} น.</div>
            <div class="grid grid-cols-3 gap-1 bg-slate-50 p-1.5 rounded border border-slate-200 text-[9px] font-medium font-mono text-slate-600">
              <div class="flex flex-col items-center">
                <span>🔋 แบต</span>
                <span class="font-bold text-slate-800">${battery}%</span>
              </div>
              <div class="flex flex-col items-center">
                <span>🚗 ความเร็ว</span>
                <span class="font-bold text-slate-800">${speed} km/h</span>
              </div>
              <div class="flex flex-col items-center">
                <span>🛰️ สถานะ</span>
                <span class="font-bold uppercase ${status === "online" ? "text-emerald-600" : "text-amber-500"}">${status}</span>
              </div>
            </div>
            ${isMock ? `<div class="mt-1.5 text-red-500 font-bold font-mono text-[9px] bg-red-50 border border-red-200 py-0.5 px-1.5 rounded animate-pulse">🛰️ MOCK LOCATION ACTIVE</div>` : ""}
            ${isOutOfBounds ? `<div class="mt-1.5 text-rose-500 font-bold font-mono text-[9px] bg-rose-50 border border-rose-200 py-0.5 px-1.5 rounded animate-pulse">⚠️ OUT OF BOUNDS AREA</div>` : ""}
          </div>
        `;

        L.marker([log.lat, log.lng], { icon: customIcon })
          .bindPopup(popupContent)
          .addTo(staffLayerGroup.current!);
      });
    }

    // 5. Draw Historical Path Polyline (if applicable)
    if (pathLayerGroup.current && historicalLogs.length > 0) {
      const logsByStaff: Record<string, GpsLog[]> = {};
      historicalLogs.forEach((log) => {
        if (!selectedStaffIds.has(log.staff_id)) return;
        if (!logsByStaff[log.staff_id]) logsByStaff[log.staff_id] = [];
        logsByStaff[log.staff_id].push(log);
      });

      Object.entries(logsByStaff).forEach(([sid, logs]) => {
        if (logs.length < 2) return;
        
        // Sort logs ascending by timestamp
        logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const coords: L.LatLngTuple[] = logs.map((l) => [l.lat, l.lng]);
        const { color } = getStaffDetails(sid);

        // Draw animated polyline
        L.polyline(coords, {
          color: color.hex,
          weight: 3.5,
          opacity: 0.85,
          dashArray: "8, 6",
          lineJoin: "round",
        }).addTo(pathLayerGroup.current!);

        // Add start (green) and end (red) dots
        L.circleMarker(coords[0], {
          radius: 5,
          color: "#10b981",
          fillColor: "#34d399",
          fillOpacity: 1,
          weight: 1.5,
        })
          .bindTooltip(`${sid}: เริ่มต้นเส้นทาง`, { permanent: false })
          .addTo(pathLayerGroup.current!);

        L.circleMarker(coords[coords.length - 1], {
          radius: 5,
          color: "#ef4444",
          fillColor: "#f87171",
          fillOpacity: 1,
          weight: 1.5,
        })
          .bindTooltip(`${sid}: พิกัดสุดท้าย`, { permanent: false })
          .addTo(pathLayerGroup.current!);
      });
    }

    // Auto-center map if there are any coordinates and map centering isn't locked
    if (bounds.length > 0 && !isPlayback) {
      map.fitBounds(bounds, { maxZoom: 15, padding: [40, 40] });
    }
  }, [
    staffs,
    customers,
    visitedIds,
    latestLogs,
    historicalLogs,
    territories,
    hideTerritories,
    hideUnvisited,
    referenceTime,
    isPlayback,
    selectedStaffIds,
  ]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full rounded-2xl bg-slate-950 border border-slate-800 shadow-inner" />
      {/* Zoom indicators or micro-helpers can sit here */}
    </div>
  );
}
