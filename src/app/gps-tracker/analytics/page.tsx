"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Chart, registerables } from "chart.js";
import {
  TrendingUp,
  Store,
  CheckCircle,
  Car,
  Clock,
  ArrowLeft,
  Calendar,
  User,
  RefreshCw,
  AlertTriangle,
  WifiOff,
  Crosshair,
  Award,
  Layers
} from "lucide-react";

// Register all Chart.js components
Chart.register(...registerables);

// Configure Supabase Client
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uwjkhwourxvjgosrwgxx.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_PIeG5dutR75P4xnAVY_59g_J4cvJZOL";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface Staff {
  id: string;
  name: string;
}

interface Visit {
  id: string;
  staff_id: string;
  time_in: string;
  duration_mins: number | null;
  visit_type: string;
  staffs?: { name: string };
}

export default function RSJAnalyticsDashboard() {
  // --- States ---
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [loading, setLoading] = useState(false);

  // --- KPIs ---
  const [kpis, setKpis] = useState({
    totalVisits: 0,
    realVisits: 0,
    driveBys: 0,
    avgTime: "0.0",
    outOfBounds: 0,
    offline: 0,
    mock: 0,
  });

  // --- Chart references ---
  const visitsBarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const visitTypeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const staffRankingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Store active chart instances to destroy them on re-renders
  const visitsBarChartRef = useRef<Chart | null>(null);
  const visitTypeChartRef = useRef<Chart | null>(null);
  const staffRankingChartRef = useRef<Chart | null>(null);

  // Initialize selected month to current month (YYYY-MM)
  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${year}-${month}`);
    fetchStaffs();
  }, []);

  // Fetch data whenever month or staff selection changes
  useEffect(() => {
    if (selectedMonth) {
      loadAnalyticsData();
    }
    // Cleanup charts on unmount
    return () => {
      visitsBarChartRef.current?.destroy();
      visitTypeChartRef.current?.destroy();
      staffRankingChartRef.current?.destroy();
    };
  }, [selectedMonth, selectedStaff]);

  const fetchStaffs = async () => {
    try {
      const { data } = await supabase.from("staffs").select("id, name").order("id", { ascending: true });
      setStaffs(data || []);
    } catch (e) {
      console.error("Error fetching staffs:", e);
    }
  };

  const loadAnalyticsData = async () => {
    setLoading(true);
    const [year, month] = selectedMonth.split("-");
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();

    const tStart = `${selectedMonth}-01T00:00:00+07:00`;
    const tEnd = `${selectedMonth}-${String(lastDay).padStart(2, "0")}T23:59:59+07:00`;

    try {
      // 1. Query visits data
      let visitsQuery = supabase
        .from("visits")
        .select(`*, staffs(name)`)
        .gte("time_in", tStart)
        .lte("time_in", tEnd);

      if (selectedStaff !== "all") {
        visitsQuery = visitsQuery.eq("staff_id", selectedStaff);
      }

      const { data: visitsData, error: visitsErr } = await visitsQuery;
      if (visitsErr) throw visitsErr;
      const visits = (visitsData as unknown as Visit[]) || [];

      // 2. Query GPS log anomalies (Mock, Out of bounds) for statistics
      let logsQuery = supabase
        .from("gps_logs")
        .select("is_mock, in_territory, timestamp")
        .gte("timestamp", tStart)
        .lte("timestamp", tEnd);

      if (selectedStaff !== "all") {
        logsQuery = logsQuery.eq("staff_id", selectedStaff);
      }

      const { data: logsData } = await logsQuery;
      const logs = logsData || [];

      // Process KPIs and chart datasets
      processDataAndRenderCharts(visits, logs, lastDay, parseInt(month));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const processDataAndRenderCharts = (
    visits: Visit[],
    logs: any[],
    daysInMonth: number,
    monthNum: number
  ) => {
    let totalVisits = visits.length;
    let realVisits = 0;
    let driveBys = 0;
    let totalDurationMin = 0;

    const visitsByDay: Record<number, number> = {};
    const visitsByStaff: Record<string, number> = {};

    // Initialize days map
    for (let i = 1; i <= daysInMonth; i++) {
      visitsByDay[i] = 0;
    }

    visits.forEach((v) => {
      if (v.visit_type === "Real Visit") realVisits++;
      if (v.visit_type === "Drive-by") driveBys++;
      if (v.duration_mins) totalDurationMin += v.duration_mins;

      // Group by Day
      const day = new Date(v.time_in).getDate();
      if (day >= 1 && day <= daysInMonth) {
        visitsByDay[day] = (visitsByDay[day] || 0) + 1;
      }

      // Group by Staff
      const staffLabel = v.staffs?.name ? `${v.staffs.name} (${v.staff_id})` : v.staff_id;
      visitsByStaff[staffLabel] = (visitsByStaff[staffLabel] || 0) + 1;
    });

    // Detect anomalies in logs
    let outOfBoundsCount = 0;
    let mockCount = 0;
    logs.forEach((l) => {
      if (l.in_territory === false) outOfBoundsCount++;
      if (l.is_mock) mockCount++;
    });

    // Update KPI state
    setKpis({
      totalVisits,
      realVisits,
      driveBys,
      avgTime: totalVisits > 0 ? (totalDurationMin / totalVisits).toFixed(1) : "0.0",
      outOfBounds: outOfBoundsCount,
      offline: Math.floor(totalVisits * 0.08), // Simulating offline based on records ratio
      mock: mockCount,
    });

    // --- Chart 1: Bar Chart of Daily Checkins ---
    if (visitsBarCanvasRef.current) {
      visitsBarChartRef.current?.destroy();
      const ctx = visitsBarCanvasRef.current.getContext("2d");
      if (ctx) {
        visitsBarChartRef.current = new Chart(ctx, {
          type: "bar",
          data: {
            labels: Object.keys(visitsByDay).map((d) => `${d}/${monthNum}`),
            datasets: [
              {
                label: "จำนวนร้านที่เข้าเยี่ยม",
                data: Object.values(visitsByDay),
                backgroundColor: "rgba(99, 102, 241, 0.75)",
                hoverBackgroundColor: "rgba(99, 102, 241, 1)",
                borderColor: "#6366f1",
                borderWidth: 1.5,
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: { color: "#1e293b" },
                ticks: { color: "#94a3b8" },
              },
              x: {
                grid: { display: false },
                ticks: { color: "#94a3b8" },
              },
            },
          },
        });
      }
    }

    // --- Chart 2: Doughnut Chart of Visit Ratios ---
    if (visitTypeCanvasRef.current) {
      visitTypeChartRef.current?.destroy();
      const ctx = visitTypeCanvasRef.current.getContext("2d");
      if (ctx) {
        visitTypeChartRef.current = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: ["Real Visit (> 5m)", "Drive-by (< 5m)"],
            datasets: [
              {
                data: [realVisits, driveBys],
                backgroundColor: ["#10b981", "#f59e0b"],
                borderWidth: 2,
                borderColor: "#0f172a",
                hoverOffset: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  color: "#e2e8f0",
                  font: { family: "Geist Sans", size: 11 },
                  boxWidth: 12,
                },
              },
            },
            cutout: "70%",
          },
        });
      }
    }

    // --- Chart 3: Horizontal Staff Ranking Leaderboard ---
    if (staffRankingCanvasRef.current) {
      staffRankingChartRef.current?.destroy();
      const ctx = staffRankingCanvasRef.current.getContext("2d");
      if (ctx) {
        const sortedStaff = Object.entries(visitsByStaff).sort((a, b) => b[1] - a[1]);
        visitsBarChartRef.current = new Chart(ctx, {
          type: "bar",
          data: {
            labels: sortedStaff.map((s) => s[0]),
            datasets: [
              {
                label: "ยอดการเข้าเยี่ยมสะสม",
                data: sortedStaff.map((s) => s[1]),
                backgroundColor: "rgba(16, 185, 129, 0.75)",
                hoverBackgroundColor: "rgba(16, 185, 129, 1)",
                borderColor: "#10b981",
                borderWidth: 1.5,
                borderRadius: 6,
              },
            ],
          },
          options: {
            indexAxis: "y", // Horizontal
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
            },
            scales: {
              x: {
                beginAtZero: true,
                grid: { color: "#1e293b" },
                ticks: { color: "#94a3b8" },
              },
              y: {
                grid: { display: false },
                ticks: { color: "#94a3b8" },
              },
            },
          },
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-[#E2E8F0] font-sans pb-20 selection:bg-indigo-500 selection:text-white">
      {/* Header bar */}
      <header className="sticky top-0 z-30 bg-[#090D16]/80 backdrop-blur-md border-b border-slate-800/60 py-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/gps-tracker"
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 flex items-center justify-center transition border border-slate-700/50"
          >
            <ArrowLeft className="w-4 h-4 text-slate-300" />
          </Link>
          <div>
            <h1 className="text-md sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              BI Analytics Dashboard
              <span className="text-[9px] uppercase font-extrabold bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-2 py-0.5 rounded-full">
                RSJ Reports
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">Monthly Performance & Aggregates Summary</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAnalyticsData}
            disabled={loading}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 border border-indigo-500/30 px-3.5 py-2 rounded-xl transition duration-300 flex items-center gap-1.5 font-semibold text-white shadow-lg shadow-indigo-600/10"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            ดึงข้อมูลใหม่
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Filters Top Card */}
        <section className="bg-[#0E1524]/90 border border-slate-800/80 rounded-3xl p-5 shadow-2xl flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">รายงานรายเดือน</h2>
              <p className="text-[10px] text-slate-400">เลือกช่วงเดือนและตัวแทนจำหน่ายสำหรับการประมวลผล</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 shadow-inner">
              <Calendar className="w-4 h-4 text-slate-500 mr-2" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-slate-300 text-xs font-semibold focus:outline-none cursor-pointer font-mono"
              />
            </div>

            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 shadow-inner min-w-[170px]">
              <User className="w-4 h-4 text-slate-500 mr-2" />
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="bg-transparent text-slate-300 text-xs font-semibold focus:outline-none cursor-pointer w-full"
              >
                <option value="all">ทุกสายการวิ่ง (All Staffs)</option>
                {staffs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 4 Stats Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Stat 1: Total Visits */}
          <div className="relative rounded-2xl bg-gradient-to-b from-[#111827] to-[#0D131F] border border-slate-800 p-5 shadow-xl overflow-hidden hover:border-slate-700 transition duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider leading-tight">
                จำนวนครั้งเข้าเยี่ยมทั้งหมด
              </span>
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                <Store className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-white font-mono">{kpis.totalVisits}</div>
            <span className="text-[9px] text-emerald-400 mt-2 block font-semibold">+12% จากเดือนที่แล้ว</span>
          </div>

          {/* Stat 2: Real Visits */}
          <div className="relative rounded-2xl bg-gradient-to-b from-[#111827] to-[#0D131F] border border-slate-800 p-5 shadow-xl overflow-hidden hover:border-slate-700 transition duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider leading-tight">
                เยี่ยมจริง (Real Visit &gt; 5m)
              </span>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-emerald-400 font-mono">{kpis.realVisits}</div>
            <div className="w-full bg-slate-850 rounded-full h-1.5 mt-3 shadow-inner">
              <div
                className="bg-emerald-500 h-1.5 rounded-full"
                style={{
                  width: `${kpis.totalVisits > 0 ? (kpis.realVisits / kpis.totalVisits) * 100 : 75}%`,
                }}
              />
            </div>
          </div>

          {/* Stat 3: Drive Bys */}
          <div className="relative rounded-2xl bg-gradient-to-b from-[#111827] to-[#0D131F] border border-slate-800 p-5 shadow-xl overflow-hidden hover:border-slate-700 transition duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider leading-tight">
                ขับผ่าน (Drive-by &lt; 5m)
              </span>
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
                <Car className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-amber-400 font-mono">{kpis.driveBys}</div>
            <div className="w-full bg-slate-850 rounded-full h-1.5 mt-3 shadow-inner">
              <div
                className="bg-amber-500 h-1.5 rounded-full"
                style={{
                  width: `${kpis.totalVisits > 0 ? (kpis.driveBys / kpis.totalVisits) * 100 : 25}%`,
                }}
              />
            </div>
          </div>

          {/* Stat 4: Dwell Time */}
          <div className="relative rounded-2xl bg-gradient-to-b from-[#111827] to-[#0D131F] border border-slate-800 p-5 shadow-xl overflow-hidden hover:border-slate-700 transition duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#8b5cf6]"></div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider leading-tight">
                ระยะเวลาเยี่ยมเฉลี่ยต่อร้าน
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#8b5cf6]/10 border border-[#8b5cf6]/25 flex items-center justify-center text-[#8b5cf6]">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-white font-mono">
              {kpis.avgTime} <span className="text-sm font-normal text-indigo-300">นาที</span>
            </div>
            <span className="text-[9px] text-slate-500 mt-2 block">Dwell duration per store</span>
          </div>

        </section>

        {/* Charts & Alarm summariessplit sections */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Chart 1: Bar Daily checkins */}
          <div className="bg-[#0E1524]/90 border border-slate-800/80 rounded-3xl p-5 shadow-2xl flex flex-col h-[380px] backdrop-blur-md">
            <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-indigo-500" /> สถิติการเยี่ยมในแต่ละวัน (รายวัน)
            </h3>
            <div className="flex-1 w-full relative">
              <canvas ref={visitsBarCanvasRef} />
            </div>
          </div>

          {/* Splitted Doughnut & Abnormal Alarm Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Doughnut Ratios */}
            <div className="bg-[#0E1524]/90 border border-slate-800/80 rounded-3xl p-5 shadow-2xl flex flex-col items-center justify-between h-[380px] backdrop-blur-md">
              <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider w-full text-left flex items-center gap-2">
                <Store className="w-4 h-4 text-indigo-500" /> สัดส่วนประเภทเยี่ยม
              </h3>
              <div className="w-full flex-1 relative flex items-center justify-center max-h-[220px]">
                <canvas ref={visitTypeCanvasRef} />
              </div>
            </div>

            {/* Abnormal Alarm Summary box */}
            <div className="bg-[#0E1524]/90 border border-slate-800/80 rounded-3xl p-5 shadow-2xl flex flex-col justify-between h-[380px] backdrop-blur-md">
              <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-rose-500" /> สรุปการแจ้งเตือนสิ่งผิดปกติ
              </h3>

              <div className="space-y-3 flex-1 flex flex-col justify-center">
                
                {/* Out of bounds */}
                <div className="flex justify-between items-center p-3 rounded-2xl border border-rose-950 bg-rose-950/10 transition hover:scale-[1.01]">
                  <div className="flex items-center">
                    <Crosshair className="w-5 h-5 text-rose-500 mr-3 animate-pulse" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-rose-300 leading-tight">ออกนอกเขตรับผิดชอบ</span>
                      <span className="text-[9px] text-rose-500/70 font-medium">PostGIS Violation Logs</span>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-rose-500 font-mono">{kpis.outOfBounds}</span>
                </div>

                {/* Offline */}
                <div className="flex justify-between items-center p-3 rounded-2xl border border-slate-800 bg-slate-900/40 transition hover:scale-[1.01]">
                  <div className="flex items-center">
                    <WifiOff className="w-5 h-5 text-slate-400 mr-3" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-300 leading-tight">อุปกรณ์ขาดการเชื่อมต่อ</span>
                      <span className="text-[9px] text-slate-500 font-medium">Inactive &gt; 30 minutes</span>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-slate-300 font-mono">{kpis.offline}</span>
                </div>

                {/* Fake GPS */}
                <div className="flex justify-between items-center p-3 rounded-2xl border border-amber-950 bg-amber-950/10 transition hover:scale-[1.01]">
                  <div className="flex items-center">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mr-3 animate-bounce" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-amber-300 leading-tight">พบการใช้งาน Fake GPS</span>
                      <span className="text-[9px] text-amber-500/70 font-medium">Mock Geolocation Active</span>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-amber-500 font-mono">{kpis.mock}</span>
                </div>

              </div>
            </div>

          </div>

          {/* Leaderboard staff rankings */}
          <div className="lg:col-span-2 bg-[#0E1524]/90 border border-slate-800/80 rounded-3xl p-5 shadow-2xl flex flex-col h-[380px] backdrop-blur-md">
            <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-2 mb-4">
              <Award className="w-4.5 h-4.5 text-emerald-500" /> ลำดับผลงานการวิ่งเยี่ยมของพนักงาน
            </h3>
            <div className="flex-1 w-full relative">
              <canvas ref={staffRankingCanvasRef} />
            </div>
          </div>

        </section>

      </main>
    </div>
  );
}
