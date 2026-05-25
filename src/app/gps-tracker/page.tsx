"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import {
  Users,
  Store,
  Navigation,
  AlertTriangle,
  Clock,
  Fuel,
  Calendar,
  FileSpreadsheet,
  Download,
  Filter,
  Eye,
  EyeOff,
  Activity,
  Plus,
  Play,
  Pause,
  ChevronRight,
  TrendingUp,
  MapPin,
  WifiOff,
  Database,
  ArrowLeft
} from "lucide-react";

// Dynamically load the Leaflet map (SSR safe)
const GpsMap = dynamic(() => import("@/components/GpsMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-xs text-indigo-400 font-medium tracking-wider uppercase">Loading Premium Maps...</span>
    </div>
  ),
});

// Configure Supabase Client
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uwjkhwourxvjgosrwgxx.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_PIeG5dutR75P4xnAVY_59g_J4cvJZOL";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface Staff {
  id: string;
  name: string;
  color?: string;
  territory?: string;
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
  id?: string;
  staff_id: string;
  lat: number;
  lng: number;
  timestamp: string;
  speed?: number;
  battery?: number;
  is_mock?: boolean;
  in_territory?: boolean;
}

interface Visit {
  id: string;
  staff_id: string;
  customer_id: string;
  time_in: string;
  time_out: string | null;
  duration_mins: number | null;
  visit_type: string;
  customer_name?: string;
  staffs?: { name: string };
  customers?: Customer;
}

interface Territory {
  id: string;
  name: string;
  geom: any;
  geojson: any;
}

interface StaffTerritory {
  staff_id: string;
  territory: {
    name: string;
    geojson: any;
  };
}

interface RealtimeAlert {
  id: string;
  type: "mock" | "out" | "update" | "offline";
  message: string;
  time: string;
  staffId: string;
}

// Distance helper
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function RSJTrackerDashboard() {
  // --- States ---
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [territories, setTerritories] = useState<StaffTerritory[]>([]);
  const [latestLogs, setLatestLogs] = useState<Record<string, GpsLog>>({});
  const [historicalLogs, setHistoricalLogs] = useState<GpsLog[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [alerts, setAlerts] = useState<RealtimeAlert[]>([]);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());

  // --- Filter states ---
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [hideTerritories, setHideTerritories] = useState(false);
  const [hideUnvisited, setHideUnvisited] = useState(false);

  // --- Dates ---
  const [historyStart, setHistoryStart] = useState("");
  const [historyEnd, setHistoryEnd] = useState("");
  const [reportStart, setReportStart] = useState("");
  const [reportEnd, setReportEnd] = useState("");
  const [selectedReportStaff, setSelectedReportStaff] = useState("");

  // --- Timeline Playback ---
  const [isPlayback, setIsPlayback] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [maxPlaybackMins, setMaxPlaybackMins] = useState(1440);
  const [playbackInterval, setPlaybackInterval] = useState<NodeJS.Timeout | null>(null);

  // --- Distance KPIs ---
  const [todayDistance, setTodayDistance] = useState("0.0");
  const [monthDistance, setMonthDistance] = useState("0.0");

  // --- Modal & Loaders ---
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [excelData, setExcelData] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState("");

  // Set default dates to Today (Thailand timezone)
  useEffect(() => {
    const today = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" }).split(" ")[0];
    setHistoryStart(today);
    setHistoryEnd(today);
    setReportStart(today);
    setReportEnd(today);
  }, []);

  // Fetch initial base tables
  useEffect(() => {
    fetchBaseData();
  }, []);

  // Sync / load map logs and details when dates or selections change
  useEffect(() => {
    if (historyStart && historyEnd) {
      loadHistoryAndLatest();
    }
  }, [historyStart, historyEnd, staffs]);

  // Load table data when parameters change
  useEffect(() => {
    if (reportStart && reportEnd) {
      loadVisitsTable();
    }
  }, [reportStart, reportEnd, selectedReportStaff]);

  // Real-time Supabase database listener
  useEffect(() => {
    const channel = supabase
      .channel("gps_logs_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gps_logs" },
        (payload) => {
          const newLog = payload.new as GpsLog;
          
          // Add staff dynamically if missing
          setStaffs((prev) => {
            if (!prev.some((s) => s.id === newLog.staff_id)) {
              return [...prev, { id: newLog.staff_id, name: newLog.staff_id }].sort((a, b) =>
                a.id.localeCompare(b.id)
              );
            }
            return prev;
          });

          // Update latest log cache
          setLatestLogs((prev) => ({
            ...prev,
            [newLog.staff_id]: newLog,
          }));

          // Trigger Alert
          const time = new Date(newLog.timestamp).toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          if (newLog.is_mock) {
            addAlert("mock", `ตรวจพบ Fake GPS: สายวิ่ง ${newLog.staff_id}`, time, newLog.staff_id);
          } else if (newLog.in_territory === false) {
            addAlert("out", `สายวิ่ง ${newLog.staff_id} ออกนอกพื้นที่ดูแล!`, time, newLog.staff_id);
          } else {
            addAlert("update", `อัปเดตตำแหน่ง: สายวิ่ง ${newLog.staff_id} (${newLog.speed || 0} km/h)`, time, newLog.staff_id);
          }

          // Re-calculate mileage stats
          calculateTodayMileage();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- Handlers & API Calls ---

  const fetchBaseData = async () => {
    setLoadingText("กำลังเชื่อมต่อฐานข้อมูล...");
    try {
      // 1. Fetch Staffs
      const { data: staffData } = await supabase.from("staffs").select("*").order("id", { ascending: true });
      const loadedStaffs = staffData || [];

      // Auto discover unregistered staff from recent logs
      const { data: recentLogs } = await supabase
        .from("gps_logs")
        .select("staff_id")
        .order("timestamp", { ascending: false })
        .limit(200);

      const combinedStaffs = [...loadedStaffs];
      if (recentLogs) {
        const uniqueIds = [...new Set(recentLogs.map((l) => l.staff_id))].filter(Boolean);
        uniqueIds.forEach((id) => {
          if (!combinedStaffs.some((s) => s.id === id)) {
            combinedStaffs.push({ id, name: id });
          }
        });
      }
      combinedStaffs.sort((a, b) => a.id.localeCompare(b.id));

      setStaffs(combinedStaffs);
      setSelectedStaffIds(new Set(combinedStaffs.map((s) => s.id)));

      // 2. Fetch Customers
      const { data: customerData } = await supabase
        .from("customers")
        .select("id, name, customer_code, customer_type, staff_id, lat, lng, district")
        .not("lat", "is", null)
        .not("lng", "is", null);
      setCustomers(customerData || []);

      // 3. Fetch Territories mappings
      const { data: territoryData } = await supabase.from("staff_territories").select(`
        staff_id,
        territory:territories (
          name,
          geojson
        )
      `);
      setTerritories((territoryData as unknown as StaffTerritory[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingText("");
    }
  };

  const loadHistoryAndLatest = async () => {
    if (staffs.length === 0) return;
    setLoadingText("กำลังโหลดพิกัดล่าสุด...");

    const tStart = `${historyStart}T00:00:00+07:00`;
    const tEnd = `${historyEnd}T23:59:59+07:00`;

    try {
      // 1. Get latest logs for each staff member
      const latestMap: Record<string, GpsLog> = {};
      await Promise.all(
        staffs.map(async (staff) => {
          const { data } = await supabase
            .from("gps_logs")
            .select("*")
            .eq("staff_id", staff.id)
            .order("timestamp", { ascending: false })
            .limit(1);
          if (data && data.length > 0) {
            latestMap[staff.id] = data[0];
          }
        })
      );
      setLatestLogs(latestMap);

      // 2. Fetch all historical logs in date range
      let allLogs: GpsLog[] = [];
      let startRange = 0;
      const size = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("gps_logs")
          .select("staff_id, lat, lng, timestamp, speed, battery, is_mock, in_territory")
          .gte("timestamp", tStart)
          .lte("timestamp", tEnd)
          .order("timestamp", { ascending: true })
          .range(startRange, startRange + size - 1);

        if (error || !data) break;
        allLogs = allLogs.concat(data);
        if (data.length < size) break;
        startRange += size;
      }
      setHistoricalLogs(allLogs);

      // Set playback timeline range
      const diffMs = new Date(tEnd).getTime() - new Date(tStart).getTime();
      setMaxPlaybackMins(Math.max(1440, Math.floor(diffMs / 1000 / 60)));

      calculateTodayMileage(allLogs);
      calculateMonthlyMileage();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingText("");
    }
  };

  const loadVisitsTable = async () => {
    setLoadingText("กำลังกรองข้อมูลการเยี่ยม...");
    try {
      let query = supabase
        .from("visits")
        .select(`
          *,
          staffs ( name, id ),
          customers ( name, customer_code, customer_type, district, staff_id, lat, lng )
        `)
        .order("time_in", { ascending: false });

      if (reportStart) query = query.gte("time_in", `${reportStart}T00:00:00+07:00`);
      if (reportEnd) query = query.lte("time_in", `${reportEnd}T23:59:59+07:00`);
      if (selectedReportStaff) query = query.eq("staff_id", selectedReportStaff);

      const { data, error } = await query;
      if (error) throw error;

      const loadedVisits = (data as unknown as Visit[]) || [];
      setVisits(loadedVisits);

      // Extract unique visited store coordinates to highlight on map
      const visitedSet = new Set<string>();
      loadedVisits.forEach((v) => {
        if (v.customer_id) visitedSet.add(v.customer_id);
      });
      setVisitedIds(visitedSet);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingText("");
    }
  };

  const calculateTodayMileage = (logsList = historicalLogs) => {
    if (logsList.length === 0) {
      setTodayDistance("0.0");
      return;
    }

    const distByStaff: Record<string, { prev: [number, number] | null; total: number }> = {};
    logsList.forEach((log) => {
      if (!selectedStaffIds.has(log.staff_id)) return;
      if (!distByStaff[log.staff_id]) distByStaff[log.staff_id] = { prev: null, total: 0 };

      const entry = distByStaff[log.staff_id];
      if (entry.prev) {
        entry.total += haversineKm(entry.prev[0], entry.prev[1], log.lat, log.lng);
      }
      entry.prev = [log.lat, log.lng];
    });

    const sum = Object.values(distByStaff).reduce((acc, current) => acc + current.total, 0);
    setTodayDistance(sum.toFixed(1));
  };

  const calculateMonthlyMileage = async () => {
    // Current month boundaries
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();

    const tStart = `${year}-${month}-01T00:00:00+07:00`;
    const tEnd = `${year}-${month}-${String(lastDay).padStart(2, "0")}T23:59:59+07:00`;

    try {
      let logs: GpsLog[] = [];
      let start = 0;
      const size = 1000;
      while (true) {
        const { data } = await supabase
          .from("gps_logs")
          .select("staff_id, lat, lng, timestamp")
          .gte("timestamp", tStart)
          .lte("timestamp", tEnd)
          .range(start, start + size - 1);
        if (!data) break;
        logs = logs.concat(data);
        if (data.length < size) break;
        start += size;
      }

      const distMap: Record<string, { prev: [number, number] | null; total: number }> = {};
      logs.forEach((log) => {
        if (!selectedStaffIds.has(log.staff_id)) return;
        if (!distMap[log.staff_id]) distMap[log.staff_id] = { prev: null, total: 0 };
        const entry = distMap[log.staff_id];
        if (entry.prev) {
          entry.total += haversineKm(entry.prev[0], entry.prev[1], log.lat, log.lng);
        }
        entry.prev = [log.lat, log.lng];
      });

      const total = Object.values(distMap).reduce((acc, curr) => acc + curr.total, 0);
      setMonthDistance(total.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
    } catch (e) {
      console.error(e);
    }
  };

  const addAlert = (type: RealtimeAlert["type"], message: string, time: string, staffId: string) => {
    const newAlert: RealtimeAlert = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      message,
      time,
      staffId,
    };
    setAlerts((prev) => [newAlert, ...prev].slice(0, 50));
  };

  // Toggle single staff checkbox
  const handleStaffFilterToggle = (staffId: string) => {
    setSelectedStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(staffId)) {
        next.delete(staffId);
      } else {
        next.add(staffId);
      }
      return next;
    });
  };

  const handleAllFiltersToggle = (checkAll: boolean) => {
    if (checkAll) {
      setSelectedStaffIds(new Set(staffs.map((s) => s.id)));
    } else {
      setSelectedStaffIds(new Set());
    }
  };

  // --- Historical Playback Scrubbing logic ---
  const scrubTimeHistory = (minsOffset: number) => {
    setPlaybackTime(minsOffset);
    if (historicalLogs.length === 0) return;

    const baseTime = new Date(`${historyStart}T00:00:00+07:00`).getTime();
    const targetTimeMs = baseTime + minsOffset * 60000;

    const scrubLogsMap: Record<string, GpsLog> = {};
    historicalLogs.forEach((log) => {
      const logTime = new Date(log.timestamp).getTime();
      if (logTime <= targetTimeMs) {
        scrubLogsMap[log.staff_id] = log;
      }
    });

    setLatestLogs(scrubLogsMap);
  };

  // Playback timer controls
  const togglePlayback = () => {
    if (isPlayback) {
      if (playbackInterval) {
        clearInterval(playbackInterval);
        setPlaybackInterval(null);
      }
      setIsPlayback(false);
    } else {
      setIsPlayback(true);
      const interval = setInterval(() => {
        setPlaybackTime((prev) => {
          const next = prev + 15; // move 15 minutes per tick
          if (next >= maxPlaybackMins) {
            clearInterval(interval);
            setIsPlayback(false);
            return maxPlaybackMins;
          }
          scrubTimeHistory(next);
          return next;
        });
      }, 800);
      setPlaybackInterval(interval);
    }
  };

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (playbackInterval) clearInterval(playbackInterval);
    };
  }, [playbackInterval]);

  // Reset to live mode
  const resetLiveView = () => {
    setIsPlayback(false);
    if (playbackInterval) {
      clearInterval(playbackInterval);
      setPlaybackInterval(null);
    }
    setPlaybackTime(maxPlaybackMins);
    loadHistoryAndLatest();
  };

  // --- Excel CSV drag-and-drop & parsing ---
  const handleExcelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(worksheet);
      setExcelData(json);
      setUploadStatus({ type: "info", message: `อ่านข้อมูลร้านค้าได้ ${json.length} รายการ` });
    };
    reader.readAsArrayBuffer(file);
  };

  const uploadCustomersData = async () => {
    if (!excelData || excelData.length === 0) {
      setUploadStatus({ type: "error", message: "ไม่พบข้อมูลสำหรับอัปโหลด กรุณาตรวจสอบไฟล์อีกครั้ง" });
      return;
    }

    setIsUploading(true);
    setUploadStatus({ type: "info", message: "กำลังประมวลผลโครงสร้างพิกัด..." });

    try {
      const normalizedPayload = excelData.map((rawRow: any) => {
        const row: Record<string, any> = {};
        Object.keys(rawRow).forEach((k) => {
          const cleanKey = k.replace(/["']/g, "").trim().toLowerCase();
          row[cleanKey] = rawRow[k];
        });

        // Resolve Thai headers
        let name =
          row["ชื่อ"] ||
          row["ชื่อลูกค้า"] ||
          row["ชื่อร้าน"] ||
          row["customer_name"] ||
          row["customer name"] ||
          row["name"] ||
          null;
        let customer_code =
          row["ลูกค้า"] ||
          row["รหัสลูกค้า"] ||
          row["รหัส"] ||
          row["customer_code"] ||
          row["customer code"] ||
          row["code"] ||
          null;

        if (name && /^[0-9]+$/.test(String(name).trim()) && !customer_code) {
          customer_code = String(name).trim();
          name = null;

          for (const k in row) {
            const val = String(row[k]).trim();
            if (
              val &&
              !/^[0-9.\-]+$/.test(val) &&
              val !== row["staff_id"] &&
              val !== row["สายวิ่ง"] &&
              val !== row["ชื่อประเภทย่อยของลูกค้า"] &&
              k !== "staff_id" &&
              k !== "สายวิ่ง"
            ) {
              name = val;
              break;
            }
          }
        }

        const lat = parseFloat(row["lat"] || row["latitude"] || row["ละติจูด"]);
        const lng = parseFloat(row["lng"] || row["lon"] || row["longitude"] || row["ลองจิจูด"]);

        return {
          name,
          customer_code: customer_code ? String(customer_code) : null,
          lat,
          lng,
          staff_id: row["staff_id"] || row["สายวิ่ง"] || null,
          customer_type: row["customer_type"] || row["ประเภท"] || row["ชื่อประเภทย่อยของลูกค้า"] || null,
          district: row["district"] || row["อำเภอ"] || row["อำเภอทางภูมิศ"] || null,
        };
      });

      const validRows = normalizedPayload.filter((r) => r.name && !isNaN(r.lat) && !isNaN(r.lng));
      if (validRows.length === 0) {
        throw new Error("โครงสร้างไฟล์ไม่ตรงเป้าหมาย หรือ ไม่มีพิกัดละติจูด/ลองจิจูดที่ถูกต้อง");
      }

      // Deduplicate on conflict
      const dedupMap = new Map();
      validRows.forEach((r) => {
        const key = r.customer_code || r.name;
        dedupMap.set(key, r);
      });
      const payload = [...dedupMap.values()];

      const batchSize = 300;
      for (let i = 0; i < payload.length; i += batchSize) {
        const chunk = payload.slice(i, i + batchSize);
        setUploadStatus({
          type: "info",
          message: `กำลังอัปโหลดบันทึกร้านค้า... ${Math.min(i + batchSize, payload.length)} จาก ${payload.length}`,
        });
        const { error } = await supabase.from("customers").upsert(chunk, { onConflict: "customer_code" });
        if (error) throw error;
      }

      setUploadStatus({ type: "success", message: `นำเข้าพิกัดร้านค้าสำเร็จ ${payload.length} รายการ!` });
      fetchBaseData();
      setTimeout(() => {
        setUploadModalOpen(false);
        setExcelData(null);
        setFileName("");
        setUploadStatus(null);
      }, 2500);
    } catch (err: any) {
      setUploadStatus({ type: "error", message: `ข้อผิดพลาด: ${err.message || err}` });
    } finally {
      setIsUploading(false);
    }
  };

  // Count UI states
  const totalStaffFiltered = selectedStaffIds.size;
  const activeDriving = Object.entries(latestLogs).filter(
    ([id, log]) => selectedStaffIds.has(id) && (log.speed ?? 0) > 0
  ).length;
  const activeVisitedCount = visitedIds.size;
  const activeOutOfBounds = Object.entries(latestLogs).filter(
    ([id, log]) => selectedStaffIds.has(id) && log.in_territory === false
  ).length;

  return (
    <div className="min-h-screen bg-[#090D16] text-[#E2E8F0] font-sans pb-20 selection:bg-indigo-500 selection:text-white">
      {/* Dynamic Loader */}
      {loadingText && (
        <div className="fixed inset-0 z-50 bg-[#070A12]/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-[280px]">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-bold text-indigo-400 tracking-wide text-center">{loadingText}</span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-[#090D16]/80 backdrop-blur-md border-b border-slate-800/60 py-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 flex items-center justify-center transition border border-slate-700/50"
          >
            <ArrowLeft className="w-4 h-4 text-slate-300" />
          </Link>
          <div>
            <h1 className="text-md sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              Sales Geofence Tracker
              <span className="text-[9px] uppercase font-extrabold bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-2 py-0.5 rounded-full">
                Next.js Premium
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">PostGIS Geofencing Real-time Monitor</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setUploadModalOpen(true)}
            className="text-xs bg-slate-800/60 border border-slate-700 hover:bg-indigo-600/10 hover:border-indigo-500/50 px-3.5 py-2 rounded-xl transition duration-300 flex items-center gap-1.5 font-semibold text-slate-300 hover:text-indigo-400 shadow-lg shadow-black/20"
          >
            <FileSpreadsheet className="w-4 h-4" />
            นำเข้าข้อมูลร้านค้า
          </button>
          <div className="h-6 w-px bg-slate-800"></div>
          <div className="hidden sm:flex items-center gap-2 bg-slate-900/50 border border-slate-850 px-3 py-1.5 rounded-full text-[10px] font-mono tracking-wider text-indigo-400 shadow-inner">
            <Activity className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            Live DB Server Connected
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Metric Cards Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Card 1: Total Staffs */}
          <div className="relative rounded-2xl bg-gradient-to-b from-[#111827] to-[#0D131F] border border-slate-800 p-4 shadow-xl overflow-hidden group hover:border-slate-700 transition duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">พนักงานทั้งหมด</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                <Users className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="text-2xl font-black text-white font-mono">{totalStaffFiltered}</div>
            <span className="text-[9px] text-slate-500 mt-1 block">Active routes tracked</span>
          </div>

          {/* Card 2: Visiting Stores */}
          <div className="relative rounded-2xl bg-gradient-to-b from-[#111827] to-[#0D131F] border border-slate-800 p-4 shadow-xl overflow-hidden group hover:border-slate-700 transition duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">เยี่ยมแล้ววันนี้</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                <Store className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">{activeVisitedCount}</div>
            <span className="text-[9px] text-slate-500 mt-1 block">Unique store check-ins</span>
          </div>

          {/* Card 3: Driving (In Bounds) */}
          <div className="relative rounded-2xl bg-gradient-to-b from-[#111827] to-[#0D131F] border border-slate-800 p-4 shadow-xl overflow-hidden group hover:border-slate-700 transition duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">เดินทางในเขต</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
                <Navigation className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono">{activeDriving}</div>
            <span className="text-[9px] text-slate-500 mt-1 block">Vehicles in motion</span>
          </div>

          {/* Card 4: Out Of Bounds Alerts */}
          <div className="relative rounded-2xl bg-gradient-to-b from-[#111827] to-[#0D131F] border border-[#ef4444]/35 p-4 shadow-xl overflow-hidden group transition duration-300 bg-rose-950/10">
            <div className="absolute top-0 left-0 w-1 h-full bg-rose-500 animate-pulse"></div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] uppercase font-extrabold text-rose-400 tracking-wider">ออกนอกเขตผิดปกติ</span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 animate-pulse">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-500 font-mono">{activeOutOfBounds}</div>
            <span className="text-[9px] text-rose-400/70 mt-1 block">Requires admin action</span>
          </div>

          {/* Card 5: Total Daily Mileage */}
          <div className="relative rounded-2xl bg-gradient-to-b from-[#111827] to-[#0D131F] border border-slate-800 p-4 shadow-xl overflow-hidden group hover:border-slate-700 transition duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">ระยะทางรวมวันนี้</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                <Fuel className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {todayDistance} <span className="text-[10px] font-normal text-slate-400">กม.</span>
            </div>
            <span className="text-[9px] text-slate-500 mt-1 block">Monthly Total: {monthDistance} กม.</span>
          </div>

        </section>

        {/* Map, Scrubbers, and Side Controls Panel */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Map & Scrubber Card - Span 3 */}
          <div className="lg:col-span-3 rounded-3xl border border-slate-800 bg-[#0E1524]/90 p-4 flex flex-col gap-4 shadow-2xl relative overflow-hidden backdrop-blur-md">
            
            <div className="h-[60vh] min-h-[480px] w-full relative rounded-2xl overflow-hidden">
              
              {/* Dynamic Map Component */}
              <GpsMap
                staffs={staffs}
                customers={customers}
                visitedIds={visitedIds}
                latestLogs={latestLogs}
                historicalLogs={historicalLogs}
                territories={territories}
                hideTerritories={hideTerritories}
                hideUnvisited={hideUnvisited}
                referenceTime={
                  isPlayback
                    ? new Date(`${historyStart}T00:00:00+07:00`).getTime() + playbackTime * 60000
                    : Date.now()
                }
                isPlayback={isPlayback}
                selectedStaffIds={selectedStaffIds}
              />
            </div>

            {/* Time playback Scrubber timeline bar */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4 w-full justify-between">
              
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={togglePlayback}
                  disabled={historicalLogs.length === 0}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-white transition disabled:opacity-50 ${
                    isPlayback ? "bg-amber-600 hover:bg-amber-500" : "bg-indigo-600 hover:bg-indigo-500"
                  }`}
                >
                  {isPlayback ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                </button>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-slate-400">ประวัติความเคลื่อนไหว</span>
                  <span className="text-xs font-black text-indigo-400">
                    {isPlayback
                      ? new Date(
                          new Date(`${historyStart}T00:00:00+07:00`).getTime() + playbackTime * 60000
                        ).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น."
                      : "แสดงตำแหน่งล่าสุด (Live)"}
                  </span>
                </div>
              </div>

              {/* Slider Input */}
              <div className="flex-1 w-full flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-bold">00:00</span>
                <input
                  type="range"
                  min="0"
                  max={maxPlaybackMins}
                  value={playbackTime}
                  onChange={(e) => scrubTimeHistory(parseInt(e.target.value))}
                  disabled={historicalLogs.length === 0}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
                />
                <span className="text-[10px] text-slate-500 font-bold">23:59</span>
              </div>

              <div className="flex gap-2 shrink-0 w-full md:w-auto justify-end">
                <button
                  onClick={resetLiveView}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
                >
                  Live View
                </button>
              </div>
            </div>

          </div>

          {/* Left panel Control Panel - Span 1 */}
          <div className="rounded-3xl border border-slate-800 bg-[#0E1524]/90 p-5 shadow-2xl flex flex-col gap-6 backdrop-blur-md">
            
            {/* Dynamic selectors and buttons */}
            <div className="space-y-4">
              <h2 className="text-xs uppercase font-extrabold text-indigo-400 tracking-wider flex items-center gap-2">
                <Filter className="w-3.5 h-3.5" /> เลือกดูและกรองข้อมูล
              </h2>

              {/* Toggles */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/60 cursor-pointer select-none transition">
                  <span className="text-xs font-semibold text-slate-300">ซ่อนขอบเขตดูแล</span>
                  <input
                    type="checkbox"
                    checked={hideTerritories}
                    onChange={(e) => setHideTerritories(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-indigo-500"
                  />
                </label>
                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/60 cursor-pointer select-none transition">
                  <span className="text-xs font-semibold text-slate-300">ซ่อนร้านไม่ได้เยี่ยม</span>
                  <input
                    type="checkbox"
                    checked={hideUnvisited}
                    onChange={(e) => setHideUnvisited(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-indigo-500"
                  />
                </label>
              </div>
            </div>

            {/* Date Pickers */}
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider block">ช่วงเวลาย้อนหลัง</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-400">เริ่มต้น</span>
                  <input
                    type="date"
                    value={historyStart}
                    onChange={(e) => setHistoryStart(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-xs px-2.5 py-2 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-400">สิ้นสุด</span>
                  <input
                    type="date"
                    value={historyEnd}
                    onChange={(e) => setHistoryEnd(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-xs px-2.5 py-2 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <button
                onClick={loadHistoryAndLatest}
                className="w-full py-2 bg-indigo-600/10 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-bold text-indigo-400 transition"
              >
                ดึงประวัติช่วงเวลานี้
              </button>
            </div>

            {/* Staff list checkbox matrix */}
            <div className="flex-1 flex flex-col gap-2 min-h-[220px]">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">เลือกสายการวิ่ง ({staffs.length})</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleAllFiltersToggle(true)}
                    className="text-[9px] text-indigo-400 hover:underline font-bold"
                  >
                    เปิดทั้งหมด
                  </button>
                  <span className="text-slate-700 text-[9px]">•</span>
                  <button
                    onClick={() => handleAllFiltersToggle(false)}
                    className="text-[9px] text-slate-500 hover:underline font-bold"
                  >
                    ปิดทั้งหมด
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[260px] border border-slate-800 rounded-2xl bg-slate-900/40 p-2 pr-1 space-y-1.5">
                {staffs.map((staff) => {
                  const isChecked = selectedStaffIds.has(staff.id);
                  const color = latestLogs[staff.id]?.speed ? "bg-emerald-500" : "bg-slate-600";
                  return (
                    <label
                      key={staff.id}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer select-none transition ${
                        isChecked
                          ? "bg-indigo-500/5 border-indigo-500/40 text-indigo-300"
                          : "border-slate-850 hover:bg-slate-900/40 text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${color}`} />
                        <span className="font-mono font-bold">{staff.id}</span>
                        <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{staff.name}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleStaffFilterToggle(staff.id)}
                        className="w-3.5 h-3.5 cursor-pointer accent-indigo-500 rounded"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

          </div>

        </section>

        {/* Live Alerts & Historical Table Logs Split-Panel */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Live Alerts Log Panel - Span 1 */}
          <div className="rounded-3xl border border-slate-800 bg-[#0E1524]/90 p-5 shadow-2xl flex flex-col h-[480px]">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="text-xs uppercase font-extrabold text-indigo-400 tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400 animate-pulse" /> Live Event Feed
              </h2>
              <span className="text-[9px] uppercase font-mono font-bold bg-[#111827] border border-slate-800 px-2 py-0.5 rounded text-slate-500">
                {alerts.length} events
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 border border-slate-850 bg-slate-900/20 rounded-2xl p-3 shadow-inner">
              {alerts.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-center text-xs text-slate-500 font-medium">
                  <Database className="w-8 h-8 text-slate-700 mb-2 animate-bounce" />
                  Waiting for incoming events...
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-xl border relative overflow-hidden transition-all duration-300 hover:scale-[1.01] ${
                      alert.type === "mock"
                        ? "bg-rose-950/20 border-rose-900/30 text-rose-300"
                        : alert.type === "out"
                        ? "bg-amber-950/20 border-amber-900/30 text-amber-300"
                        : "bg-slate-900/40 border-slate-850 text-slate-300"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1 font-sans">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-slate-950/40 rounded border border-white/5 uppercase">
                        {alert.staffId}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">{alert.time} น.</span>
                    </div>
                    <p className="text-xs leading-relaxed font-semibold mt-1">{alert.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Visits Database Table - Span 3 */}
          <div className="lg:col-span-3 rounded-3xl border border-slate-800 bg-[#0E1524]/90 p-5 shadow-2xl flex flex-col h-[480px]">
            
            {/* Filter and title header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 shrink-0">
              <div>
                <h2 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                  <Store className="w-4.5 h-4.5 text-indigo-500" /> บันทึกการเข้าเยี่ยมร้านค้า
                </h2>
                <p className="text-[10px] text-slate-400">ข้อมูลการเยี่ยมสะสมและระยะเวลานิ่งของพนักงาน</p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="date"
                    value={reportStart}
                    onChange={(e) => setReportStart(e.target.value)}
                    className="bg-transparent border-none focus:outline-none text-slate-300 text-xs cursor-pointer font-mono"
                  />
                  <span className="text-slate-600 text-[10px]">to</span>
                  <input
                    type="date"
                    value={reportEnd}
                    onChange={(e) => setReportEnd(e.target.value)}
                    className="bg-transparent border-none focus:outline-none text-slate-300 text-xs cursor-pointer font-mono"
                  />
                </div>

                <select
                  value={selectedReportStaff}
                  onChange={(e) => setSelectedReportStaff(e.target.value)}
                  className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="">🚗 ทุกสายวิ่ง</option>
                  {staffs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id}
                    </option>
                  ))}
                </select>

                <Link
                  href="/gps-tracker/analytics"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/10 flex items-center gap-1"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  BI Report
                </Link>
              </div>
            </div>

            {/* Actual table body container */}
            <div className="flex-1 overflow-x-auto overflow-y-auto border border-slate-850 rounded-2xl bg-slate-900/20 shadow-inner p-0">
              <table className="w-full text-left text-xs text-slate-400 whitespace-nowrap border-collapse">
                <thead className="sticky top-0 bg-slate-950/85 backdrop-blur-md shadow border-b border-slate-850 text-slate-300 uppercase tracking-wider font-extrabold text-[10px]">
                  <tr>
                    <th className="p-3">สายวิ่ง (พนักงาน)</th>
                    <th className="p-3">ร้านค้าที่เยี่ยม</th>
                    <th className="p-3 text-center">เข้า - ออกร้าน</th>
                    <th className="p-3 text-center">เวลาในร้าน (Dwell)</th>
                    <th className="p-3 text-center">ประเภทการเยี่ยม</th>
                    <th className="p-3 text-center">พิกัดทางภูมิศาสตร์</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {visits.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-500 font-semibold">
                        ไม่พบรายงานการเข้าเยี่ยมในช่วงเวลาที่เลือก
                      </td>
                    </tr>
                  ) : (
                    visits.map((visit) => {
                      const cName = visit.customers?.name || visit.customer_name || `Store #${visit.customer_id}`;
                      const cCode = visit.customers?.customer_code ? ` (${visit.customers.customer_code})` : "";
                      const cType = visit.customers?.customer_type ? ` - ${visit.customers.customer_type}` : "";
                      const durationStr = visit.duration_mins
                        ? visit.duration_mins > 60
                          ? `${Math.floor(visit.duration_mins / 60)} ชม. ${visit.duration_mins % 60} นาที`
                          : `${visit.duration_mins} นาที`
                        : "กำลังเยี่ยม...";

                      const timeIn = new Date(visit.time_in).toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const timeOut = visit.time_out
                        ? new Date(visit.time_out).toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-";

                      return (
                        <tr key={visit.id} className="hover:bg-slate-900/40 transition">
                          <td className="p-3">
                            <div className="flex flex-col">
                              <span className="font-mono font-bold text-white px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/25 rounded w-max">
                                {visit.staff_id}
                              </span>
                              <span className="text-[10px] text-slate-500 mt-1">{visit.staffs?.name || visit.staff_id}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-200">
                                {cName}
                                <span className="font-mono text-[10px] text-slate-400 font-normal">{cCode}</span>
                              </span>
                              <span className="text-[10px] text-slate-500 mt-0.5">
                                {visit.customers?.district || "ไม่มีเขตระบุ"}
                                <span className="text-indigo-400 font-semibold">{cType}</span>
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-center text-indigo-300 font-mono font-semibold">
                            {timeIn} - {timeOut} น.
                          </td>
                          <td className="p-3 text-center font-mono font-semibold text-slate-300">{durationStr}</td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                visit.visit_type === "Real Visit"
                                  ? "bg-emerald-500/10 border border-emerald-500/35 text-emerald-400"
                                  : visit.visit_type === "Drive-by"
                                  ? "bg-amber-500/10 border border-amber-500/35 text-amber-400"
                                  : "bg-slate-800 border border-slate-700 text-slate-400 animate-pulse"
                              }`}
                            >
                              {visit.visit_type}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex flex-col font-mono text-[9px] text-slate-500">
                              <span>Lat: {visit.customers?.lat?.toFixed(5) || "-"}</span>
                              <span>Lng: {visit.customers?.lng?.toFixed(5) || "-"}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </section>

      </main>

      {/* Excel Upload Dialog Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-3xl border border-slate-800 bg-[#0E1524] shadow-2xl p-6 relative flex flex-col gap-6 animate-modal-pop">
            
            <button
              onClick={() => setUploadModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white transition"
            >
              ✕
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shadow-md">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-md font-bold text-white leading-tight">นำเข้าข้อมูลร้านค้า (Customers)</h3>
                <p className="text-[10px] text-slate-400">อัปเดต / เพิ่มพิกัดร้านค้าพนักงานดูแล</p>
              </div>
            </div>

            {/* Drag Zone */}
            <label className="border-2 border-dashed border-slate-800 hover:border-indigo-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-950/40 hover:bg-slate-950/60 transition duration-300">
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleExcelSelect}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shadow-md">
                <Download className="w-5 h-5" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-slate-200">
                  {fileName ? fileName : "คลิกหรือลากไฟล์ Excel / CSV ที่นี่"}
                </p>
                <p className="text-[9px] text-slate-500 mt-1">คอลัมน์ชื่อ, ละติจูด(lat), ลองจิจูด(lng)</p>
              </div>
            </label>

            {/* Status alerts */}
            {uploadStatus && (
              <div
                className={`p-3 rounded-xl border text-xs leading-relaxed flex items-center gap-2 ${
                  uploadStatus.type === "success"
                    ? "bg-emerald-950/30 border-emerald-500/35 text-emerald-400"
                    : uploadStatus.type === "error"
                    ? "bg-rose-950/30 border-rose-500/35 text-rose-400"
                    : "bg-slate-900 border-slate-850 text-sky-400"
                }`}
              >
                <Database className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{uploadStatus.message}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => setUploadModalOpen(false)}
                className="py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-xs transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={uploadCustomersData}
                disabled={isUploading || !excelData}
                className="py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950 disabled:text-slate-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10"
              >
                {isUploading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                นำเข้าสู่ระบบ
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
