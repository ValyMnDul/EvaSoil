"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, SensorReading } from "@/lib/supabase";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Droplets,
  Thermometer,
  Sun,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  Download,
  Settings,
} from "lucide-react";
import { format, subHours, subDays } from "date-fns";
import { motion } from "framer-motion";
import SettingsModal from "@/components/SettingsModal";

type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d";

export default function Dashboard() {
  const [data, setData] = useState<SensorReading[]>([]);
  const [latest, setLatest] = useState<SensorReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("6h");
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState({
    moistureAvg: 0,
    moistureTrend: 0,
    tempAvg: 0,
    tempTrend: 0,
    lightAvg: 0,
    lightTrend: 0,
    totalReadings: 0,
    moistureMin: 0,
    moistureMax: 0,
    tempMin: 0,
    tempMax: 0,
    lightMin: 0,
    lightMax: 0,
  });

  // Calculate statistics for dashboard
  function calculateStats(readings: SensorReading[]) {
    if (readings.length < 2) return;

    const moistureValues = readings.map((r) => r.moisture);
    const tempValues = readings.map((r) => r.temperature);
    const lightValues = readings.map((r) => r.light_lux);

    const moistureAvg =
      moistureValues.reduce((a, b) => a + b, 0) / moistureValues.length;
    const tempAvg =
      tempValues.reduce((a, b) => a + b, 0) / tempValues.length;
    const lightAvg =
      lightValues.reduce((a, b) => a + b, 0) / lightValues.length;

    const recentMoisture = moistureValues.slice(-10);
    const oldMoisture = moistureValues.slice(-20, -10);
    const moistureTrend =
      (recentMoisture.reduce((a, b) => a + b, 0) /
        recentMoisture.length || 0) -
      (oldMoisture.reduce((a, b) => a + b, 0) / oldMoisture.length || 0);

    const recentTemp = tempValues.slice(-10);
    const oldTemp = tempValues.slice(-20, -10);
    const tempTrend =
      (recentTemp.reduce((a, b) => a + b, 0) / recentTemp.length || 0) -
      (oldTemp.reduce((a, b) => a + b, 0) / oldTemp.length || 0);

    const recentLight = lightValues.slice(-10);
    const oldLight = lightValues.slice(-20, -10);
    const lightTrend =
      (recentLight.reduce((a, b) => a + b, 0) /
        recentLight.length || 0) -
      (oldLight.reduce((a, b) => a + b, 0) / oldLight.length || 0);

    setStats({
      moistureAvg,
      moistureTrend,
      tempAvg,
      tempTrend,
      lightAvg,
      lightTrend,
      totalReadings: readings.length,
      moistureMin: Math.min(...moistureValues),
      moistureMax: Math.max(...moistureValues),
      tempMin: Math.min(...tempValues),
      tempMax: Math.max(...tempValues),
      lightMin: Math.min(...lightValues),
      lightMax: Math.max(...lightValues),
    });
  }

  

  const fetchData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    let fromDate: Date;

    switch (timeRange) {
      case "1h":
        fromDate = subHours(now, 1);
        break;
      case "6h":
        fromDate = subHours(now, 6);
        break;
      case "24h":
        fromDate = subHours(now, 24);
        break;
      case "7d":
        fromDate = subDays(now, 7);
        break;
      case "30d":
        fromDate = subDays(now, 30);
        break;
    }

    const { data: readings, error } = await supabase
      .from("sensor_readings")
      .select("*")
      .gte("created_at", fromDate.toISOString())
      .order("created_at", { ascending: true });

    if (!error && readings) {
      setData(readings);
      if (readings.length > 0) {
        setLatest(readings[readings.length - 1]);
        calculateStats(readings);
      }
    }
    setLoading(false);
  }, [timeRange]);

  // Realtime subscription (runs once)
  useEffect(() => {
    const subscription = supabase
      .channel("sensor_readings")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sensor_readings",
        },
        (payload) => {
          const newReading = payload.new as SensorReading;
          setData((prev) => [...prev, newReading].slice(-1000));
          setLatest(newReading);
        }
      )
      .subscribe();

    const settings = localStorage.getItem("evasoil_settings");
    if (settings) {
      const parsed = JSON.parse(settings);
      console.log("Loaded settings:", parsed);
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Initial and on-change data fetch
  useEffect(() => {
    let isMounted = true;
    const id = setTimeout(() => {
      if (isMounted) {
        fetchData();
      }
    }, 0);
    return () => {
      isMounted = false;
      clearTimeout(id);
    };
  }, [fetchData]);

  

  const exportData = () => {
    const csv = [
      "Timestamp,Device ID,Moisture %,Temperature °C,Light lux",
      ...data.map(
        (r) =>
          `${r.created_at},${r.device_id},${r.moisture},${r.temperature},${r.light_lux}`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evasoil-export-${Date.now()}.csv`;
    a.click();
  };

  const clearHistory = async () => {
    try {
      const response = await fetch(
        "/api/sensor-data?action=clear_all",
        {
          method: "DELETE",
        }
      );
      const result = await response.json();
      if (result.success) {
        setData([]);
        setLatest(null);
        alert("✅ History cleared successfully!");
      }
    } catch (error) {
      alert("❌ Error clearing history");
      console.error(error);
    }
  };

  const chartData = data.map((r) => ({
    time: format(new Date(r.created_at), "HH:mm"),
    moisture: r.moisture,
    temp: r.temperature,
    light: r.light_lux,
  }));

  const getStatusColor = (
    value: number,
    type: "moisture" | "temp" | "light"
  ) => {
    if (type === "moisture") {
      if (value > 60) return "text-green-500";
      if (value > 40) return "text-blue-500";
      if (value > 20) return "text-orange-500";
      return "text-red-500";
    }
    if (type === "temp") {
      if (value > 28) return "text-red-500";
      if (value > 22) return "text-green-500";
      if (value > 15) return "text-blue-500";
      return "text-cyan-500";
    }
    if (value > 1000) return "text-yellow-500";
    if (value > 500) return "text-orange-500";
    if (value > 200) return "text-blue-500";
    return "text-gray-500";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-16 h-16 text-indigo-600 animate-pulse mx-auto mb-4" />
          <p className="text-xl text-gray-700 font-medium">
            Loading EvaSoil...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-1600 mx-auto p-4 sm:p-6 lg:p-8">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                🌱 EvaSoil
              </h1>
              <p className="text-gray-600 text-lg">
                Smart Plant Monitoring System
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {(["1h", "6h", "24h", "7d", "30d"] as TimeRange[]).map(
                (range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      timeRange === range
                        ? "bg-indigo-600 text-white shadow-lg"
                        : "bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {range.toUpperCase()}
                  </button>
                )
              )}
              <button
                onClick={exportData}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all flex items-center gap-2"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-all flex items-center gap-2"
              >
                <Settings size={18} />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </div>
          </div>
        </motion.header>

        {latest && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
              <StatCard
                icon={<Droplets />}
                title="Soil Moisture"
                value={`${latest.moisture.toFixed(1)}%`}
                color="blue"
                trend={stats.moistureTrend}
                average={stats.moistureAvg}
                min={stats.moistureMin}
                max={stats.moistureMax}
                status={getStatusColor(latest.moisture, "moisture")}
              />
              <StatCard
                icon={<Thermometer />}
                title="Temperature"
                value={`${latest.temperature.toFixed(1)}°C`}
                color="red"
                trend={stats.tempTrend}
                average={stats.tempAvg}
                min={stats.tempMin}
                max={stats.tempMax}
                status={getStatusColor(latest.temperature, "temp")}
              />
              <StatCard
                icon={<Sun />}
                title="Light Level"
                value={`${Math.round(latest.light_lux)} lx`}
                color="yellow"
                trend={stats.lightTrend}
                average={stats.lightAvg}
                min={stats.lightMin}
                max={stats.lightMax}
                status={getStatusColor(latest.light_lux, "light")}
              />
              <StatCard
                icon={<Clock />}
                title="Last Update"
                value={format(new Date(latest.created_at), "HH:mm:ss")}
                color="purple"
                subtitle={`${stats.totalReadings} readings`}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
              <ChartCard title="Soil Moisture" icon={<Droplets />}>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="colorMoisture"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3b82f6"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="time" stroke="#64748b" />
                    <YAxis domain={[0, 100]} stroke="#64748b" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="moisture"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#colorMoisture)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Temperature" icon={<Thermometer />}>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="colorTemp"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#ef4444"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#ef4444"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="time" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="temp"
                      stroke="#ef4444"
                      strokeWidth={2}
                      fill="url(#colorTemp)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Light Level" icon={<Sun />}>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="colorLight"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#f59e0b"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#f59e0b"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="time" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="light"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="url(#colorLight)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <ChartCard
              title="Combined Analytics Dashboard"
              icon={<Activity />}
            >
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="time" stroke="#64748b" />
                  <YAxis yAxisId="left" stroke="#64748b" />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#64748b"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="moisture"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Moisture %"
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="temp"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Temperature °C"
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="light"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name="Light lx"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {latest.moisture < 30 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-8 bg-linear-to-r from-orange-50 to-red-50 border-l-4 border-orange-500 p-6 rounded-r-xl shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-orange-100 rounded-full">
                    <Droplets className="text-orange-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-orange-900 text-lg mb-1">
                      ⚠️ Low Moisture Alert
                    </h3>
                    <p className="text-orange-800">
                      Your plant needs water! Current level:{" "}
                      <strong>{latest.moisture.toFixed(1)}%</strong>
                    </p>
                    <p className="text-sm text-orange-700 mt-2">
                      Recommended action: Water your plant within the next
                      hour
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {latest.light_lux < 100 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 bg-linear-to-r from-gray-50 to-slate-50 border-l-4 border-gray-500 p-6 rounded-r-xl shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gray-100 rounded-full">
                    <Sun className="text-gray-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      🌙 Low Light Alert
                    </h3>
                    <p className="text-gray-800">
                      Light level is low:{" "}
                      <strong>{Math.round(latest.light_lux)} lx</strong>
                    </p>
                    <p className="text-sm text-gray-700 mt-2">
                      Consider moving your plant to a brighter location
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}

        {!latest && !loading && (
          <div className="text-center py-20">
            <Activity className="w-20 h-20 text-gray-400 mx-auto mb-4" />
            <p className="text-xl text-gray-500">
              Waiting for sensor data...
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Make sure your ESP32 is connected
            </p>
          </div>
        )}
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onClearHistory={clearHistory}
        onExportData={exportData}
        deviceId={latest?.device_id || "Unknown"}
      />
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  color,
  trend,
  average,
  min,
  max,
  status,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  color: "blue" | "red" | "purple" | "green" | "yellow";
  trend?: number;
  average?: number;
  min?: number;
  max?: number;
  status?: string;
  subtitle?: string;
}) {
  const colorClasses = {
    blue: "from-blue-500 to-cyan-500",
    red: "from-red-500 to-orange-500",
    purple: "from-purple-500 to-pink-500",
    green: "from-green-500 to-emerald-500",
    yellow: "from-yellow-500 to-orange-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 card-hover"
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className={`p-3 rounded-xl bg-linear-to-br ${colorClasses[color]} text-white`}
        >
          {icon}
        </div>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              trend > 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {trend > 0 ? (
              <TrendingUp size={16} />
            ) : (
              <TrendingDown size={16} />
            )}
            <span>{Math.abs(trend).toFixed(1)}</span>
          </div>
        )}
      </div>
      <h3 className="text-gray-600 text-sm font-medium mb-2">{title}</h3>
      <div className="flex items-end justify-between">
        <p className="text-3xl sm:text-4xl font-bold text-gray-900">
          {value}
        </p>
        {status && <span className={`text-sm font-medium ${status}`}>●</span>}
      </div>
      {average !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex justify-between text-xs text-gray-500">
            <span>
              Avg: <strong>{average.toFixed(1)}</strong>
            </span>
            {min !== undefined && max !== undefined && (
              <span>
                {min.toFixed(1)} - {max.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      )}
      {subtitle && (
        <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
      )}
    </motion.div>
  );
}

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
          {icon}
        </div>
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}