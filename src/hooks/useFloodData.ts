import { useState, useEffect, useCallback } from 'react';
import { onValue, off } from 'firebase/database';
import { database, dbHelpers } from '@/lib/firebase';
import type { SensorReading, StationData, Alert, DashboardStats, ChartDataPoint } from '@/types/floodData';

// Single station configuration
const STATION_CONFIG = {
  id: 'flood-monitor',
  name: 'Main Monitoring Station',
  location: 'Barangay Caroyroyan, Pili, Camarines Sur',
  lat: 14.5995,
  lng: 120.9842,
};

// ESP32 status labels → webapp status
const mapEsp32Status = (esp32Status: string): 'normal' | 'warning' | 'critical' | 'offline' => {
  switch (esp32Status?.toUpperCase()) {
    case 'LOW':      return 'normal';
    case 'MODERATE': return 'normal';
    case 'HIGH':     return 'warning';
    case 'CRITICAL': return 'critical';
    default:         return 'offline';
  }
};

// ESP32 raw shapes
interface Esp32Current {
  waterlevel: number; // cm
  status: string;     // "LOW" | "MODERATE" | "HIGH" | "CRITICAL"
}

interface Esp32HistoryEntry {
  waterlevel: number;
  status: string;
  time?: string; // "2026-03-24 20:23:36" — use this if present
}

// Key format: "2026-03-24_20-23-36" (YYYY-MM-DD_HH-MM-SS)
// Also supports old format: "2026-02-20_20:00"
const keyToTimestamp = (key: string, entry?: Esp32HistoryEntry): number => {
  // Prefer the time field if available — most accurate
  if (entry?.time) {
    const parsed = Date.parse(entry.time.replace(' ', 'T'));
    if (!isNaN(parsed)) return parsed;
  }
  // Fall back to parsing the key
  const [datePart, timePart] = key.split('_');
  if (!datePart || !timePart) return Date.now();
  // Replace dashes in time part with colons: "20-23-36" → "20:23:36"
  const isoString = `${datePart}T${timePart.replace(/-/g, ':')}`;
  const parsed = Date.parse(isoString);
  return isNaN(parsed) ? Date.now() : parsed;
};

const toSensorReading = (
  raw: Esp32Current | Esp32HistoryEntry,
  timestamp: number
): SensorReading => ({
  id: `${STATION_CONFIG.id}-${timestamp}`,
  timestamp,
  waterLevel: parseFloat(raw.waterlevel.toFixed(2)), // raw cm
  location: STATION_CONFIG.location,
  sensorId: STATION_CONFIG.id,
  status: mapEsp32Status(raw.status),
});

const generateAlert = (reading: SensorReading): Alert | null => {
  if (reading.status === 'critical') {
    return {
      id: `alert-${reading.id}`,
      timestamp: reading.timestamp,
      stationId: reading.sensorId,
      stationName: STATION_CONFIG.name,
      type: 'flood_warning',
      message: `Critical water level: ${reading.waterLevel}cm — Immediate action required`,
      severity: 'critical',
      acknowledged: false,
    };
  }
  if (reading.status === 'warning') {
    return {
      id: `alert-${reading.id}`,
      timestamp: reading.timestamp,
      stationId: reading.sensorId,
      stationName: STATION_CONFIG.name,
      type: 'flood_warning',
      message: `High water level warning: ${reading.waterLevel}cm`,
      severity: 'high',
      acknowledged: false,
    };
  }
  return null;
};

export type TimeRange = '1h' | '6h' | '24h' | '1w' | '1m' | '1y';

const timeRangeToHours: Record<TimeRange, number> = {
  '1h':  1,
  '6h':  6,
  '24h': 24,
  '1w':  168,
  '1m':  720,
  '1y':  8760,
};

const buildChartData = (readings: SensorReading[], range: TimeRange): ChartDataPoint[] => {
  const hours = timeRangeToHours[range];
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const filtered = readings.filter(r => r.timestamp >= cutoff);

  let interval: number;
  let timeFormat: Intl.DateTimeFormatOptions;

  if (hours <= 1) {
    interval = 5 * 60 * 1000;
    timeFormat = { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
  } else if (hours <= 24) {
    interval = 60 * 60 * 1000;
    timeFormat = { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
  } else if (hours <= 168) {
    interval = 6 * 60 * 60 * 1000;
    timeFormat = { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
  } else if (hours <= 720) {
    interval = 24 * 60 * 60 * 1000;
    timeFormat = { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
  } else {
    interval = 7 * 24 * 60 * 60 * 1000;
    timeFormat = { month: 'short', day: '2-digit' };
  }

  const aggregated: ChartDataPoint[] = [];
  for (let t = cutoff; t <= Date.now(); t += interval) {
    const bucket = filtered.filter(r => r.timestamp >= t && r.timestamp < t + interval);
    if (bucket.length > 0) {
      aggregated.push({
        timestamp: new Date(t).toLocaleString('en-US', timeFormat),
        waterLevel: parseFloat(
          (bucket.reduce((s, r) => s + r.waterLevel, 0) / bucket.length).toFixed(2)
        ),
      });
    }
  }
  return aggregated;
};

export const useFloodData = () => {
  const [station, setStation] = useState<StationData | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalStations: 1,
    activeStations: 0,
    warningStations: 0,
    criticalStations: 0,
    offlineStations: 1,
    avgWaterLevel: 0,
    maxWaterLevel: 0,
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isConnected, setIsConnected] = useState(false);
  const [currentTimeRange, setCurrentTimeRange] = useState<TimeRange>('24h');

  // ── Live current reading from /floodmonitoring ──────────────────────────────
  useEffect(() => {
    const currentRef = dbHelpers.getCurrentRef();

    const unsub = onValue(
      currentRef,
      (snapshot) => {
        if (!snapshot.exists()) return;

        const raw = snapshot.val();

        const currentRaw: Esp32Current = {
          waterlevel: raw.waterlevel,
          status: raw.status,
        };

        if (currentRaw.waterlevel == null) return;

        const reading = toSensorReading(currentRaw, Date.now());

        setStation(prev => ({
          ...(prev ?? STATION_CONFIG),
          currentReading: reading,
          history: prev?.history ?? [],
        }));

        setIsConnected(true);
        setLastUpdate(new Date());
        setLoading(false);

        setStats(prev => ({
          ...prev,
          activeStations: reading.status !== 'offline' ? 1 : 0,
          warningStations: reading.status === 'warning' ? 1 : 0,
          criticalStations: reading.status === 'critical' ? 1 : 0,
          offlineStations: reading.status === 'offline' ? 1 : 0,
          avgWaterLevel: reading.waterLevel,
          maxWaterLevel: Math.max(prev.maxWaterLevel, reading.waterLevel),
        }));

        const alert = generateAlert(reading);
        if (alert) {
          setAlerts(prev => {
            // Deduplicate by id only — prevent the exact same reading firing twice
            const alreadyExists = prev.some(a => a.id === alert.id);
            return alreadyExists ? prev : [...prev.slice(-19), alert];
          });
        }
      },
      (error) => {
        console.error('Firebase current reading error:', error);
        setIsConnected(false);
        setLoading(false);
      }
    );

    return () => off(currentRef, 'value', unsub);
  }, []);

  // ── History from /floodmonitoring/history ───────────────────────────────────
  // Keys: "2026-02-20_20:00", values: { waterlevel, status }
  useEffect(() => {
    const historyRef = dbHelpers.getHistoryRef(500);

    const unsub = onValue(
      historyRef,
      (snapshot) => {
        if (!snapshot.exists()) return;

        const raw = snapshot.val() as Record<string, Esp32HistoryEntry>;

        const readings: SensorReading[] = Object.entries(raw)
          .map(([key, entry]) => toSensorReading(entry, keyToTimestamp(key, entry)))
          .sort((a, b) => a.timestamp - b.timestamp); // oldest → newest

        setHistory(readings);
        setStation(prev =>
          prev
            ? { ...prev, history: readings }
            : {
                ...STATION_CONFIG,
                currentReading: readings[readings.length - 1],
                history: readings,
              }
        );
        setChartData(buildChartData(readings, currentTimeRange));

        // Seed alerts from history — last 20 warning/critical readings
        const historyAlerts: Alert[] = readings
          .filter(r => r.status === 'warning' || r.status === 'critical')
          .slice(-20)
          .map(r => generateAlert(r))
          .filter((a): a is Alert => a !== null);
        if (historyAlerts.length > 0) {
          setAlerts(historyAlerts);
        }

        const levels = readings.map(r => r.waterLevel);
        const max = Math.max(...levels);
        const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
        setStats(prev => ({
          ...prev,
          avgWaterLevel: parseFloat(avg.toFixed(2)),
          maxWaterLevel: parseFloat(max.toFixed(2)),
        }));
      },
      (error) => {
        console.error('Firebase history error:', error);
      }
    );

    return () => off(historyRef, 'value', unsub);
  }, [currentTimeRange]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev =>
      prev.map(a => (a.id === alertId ? { ...a, acknowledged: true } : a))
    );
  }, []);

  const setTimeRange = useCallback(
    (range: TimeRange) => {
      setCurrentTimeRange(range);
      setChartData(buildChartData(history, range));
    },
    [history]
  );

  const getHistoryByTimeRange = useCallback(
    (range: TimeRange): ChartDataPoint[] => buildChartData(history, range),
    [history]
  );

  return {
    station,
    history,
    alerts,
    stats,
    chartData,
    loading,
    lastUpdate,
    isConnected,
    currentTimeRange,
    acknowledgeAlert,
    setTimeRange,
    getHistoryByTimeRange,
  };
};

export default useFloodData;