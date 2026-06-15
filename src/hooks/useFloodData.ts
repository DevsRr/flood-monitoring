import { useState, useEffect, useCallback } from 'react';
import { onValue, push, update } from 'firebase/database';
import { database, dbHelpers, ref } from '@/lib/firebase';
import type {
  Alert,
  ChartDataPoint,
  ComponentStatus,
  DashboardStats,
  SensorReading,
  StationData,
} from '@/types/floodData';

const STATION_CONFIG = {
  id: 'flood-monitor',
  name: 'Main Monitoring Station',
  location: 'River Bank Monitoring Point',
  lat: 14.5995,
  lng: 120.9842,
};

type NormalizedStatus = 'normal' | 'moderate' | 'warning' | 'critical' | 'offline';

interface Esp32Current {
  waterlevel?: number;
  waterLevel?: number;
  status?: string;
  time?: string;
  updatedAt?: string;
}

interface Esp32HistoryEntry extends Esp32Current {
  source?: 'SENSOR' | 'MANUAL';
  acknowledged?: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  createdBy?: string;
}

export type TimeRange = '1h' | '6h' | '24h' | '1w' | '1m' | '1y';

const timeRangeToHours: Record<TimeRange, number> = {
  '1h': 1,
  '6h': 6,
  '24h': 24,
  '1w': 168,
  '1m': 720,
  '1y': 8760,
};

const mapEsp32Status = (esp32Status?: string): NormalizedStatus => {
  switch (esp32Status?.toUpperCase()) {
    case 'LOW':
    case 'NORMAL':
      return 'normal';
    case 'MEDIUM':
    case 'MODERATE':
      return 'moderate';
    case 'HIGH':
    case 'WARNING':
      return 'warning';
    case 'CRITICAL':
      return 'critical';
    default:
      return 'offline';
  }
};

const getRawWaterLevel = (raw: Esp32Current): number | null => {
  const value = raw.waterLevel ?? raw.waterlevel;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const keyToTimestamp = (key: string, entry?: Esp32HistoryEntry): number => {
  const candidateTime = entry?.time ?? entry?.updatedAt;
  if (candidateTime) {
    const parsed = Date.parse(candidateTime.replace(' ', 'T'));
    if (!Number.isNaN(parsed)) return parsed;
  }

  const [datePart, timePart] = key.split('_');
  if (!datePart || !timePart) return Date.now();

  const isoString = `${datePart}T${timePart.replace(/-/g, ':')}`;
  const parsed = Date.parse(isoString);
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

const toSensorReading = (
  raw: Esp32Current | Esp32HistoryEntry,
  timestamp: number,
  recordKey?: string
): SensorReading | null => {
  const waterLevel = getRawWaterLevel(raw);
  if (waterLevel === null) return null;

  return {
    id: recordKey ?? `${STATION_CONFIG.id}-${timestamp}`,
    recordKey,
    timestamp,
    waterLevel: parseFloat(waterLevel.toFixed(2)),
    location: STATION_CONFIG.location,
    sensorId: STATION_CONFIG.id,
    status: mapEsp32Status(raw.status),
    source: 'source' in raw ? raw.source : 'SENSOR',
    acknowledged: 'acknowledged' in raw ? raw.acknowledged === true : false,
    acknowledgedAt: 'acknowledgedAt' in raw ? raw.acknowledgedAt : undefined,
    acknowledgedBy: 'acknowledgedBy' in raw ? raw.acknowledgedBy : undefined,
  };
};

const generateAlert = (reading: SensorReading): Alert | null => {
  const alertBase = {
    id: `alert-${reading.recordKey ?? reading.id}`,
    recordKey: reading.recordKey,
    timestamp: reading.timestamp,
    stationId: reading.sensorId,
    stationName: STATION_CONFIG.name,
    type: 'flood_warning' as const,
    acknowledged: reading.acknowledged === true,
    acknowledgedAt: reading.acknowledgedAt,
    acknowledgedBy: reading.acknowledgedBy,
    source: reading.source,
  };

  if (reading.status === 'critical') {
    return {
      ...alertBase,
      message: `Critical water level: ${reading.waterLevel}cm - Immediate action required`,
      severity: 'critical',
    };
  }

  if (reading.status === 'warning') {
    return {
      ...alertBase,
      message: reading.source === 'MANUAL'
        ? 'Manual high water alert created by admin'
        : `High water level warning: ${reading.waterLevel}cm`,
      severity: 'high',
    };
  }

  if (reading.status === 'moderate') {
    return {
      ...alertBase,
      message: `Moderate water level: ${reading.waterLevel}cm - Please monitor closely`,
      severity: 'medium',
    };
  }

  return null;
};

const buildChartData = (readings: SensorReading[], range: TimeRange): ChartDataPoint[] => {
  const hours = timeRangeToHours[range];
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const filtered = readings.filter((reading) => reading.timestamp >= cutoff);

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
    timeFormat = { month: 'short', day: '2-digit', minute: '2-digit', hour12: false };
  } else {
    interval = 7 * 24 * 60 * 60 * 1000;
    timeFormat = { month: 'short', day: '2-digit' };
  }

  const aggregated: ChartDataPoint[] = [];
  for (let timestamp = cutoff; timestamp <= Date.now(); timestamp += interval) {
    const bucket = filtered.filter(
      (reading) => reading.timestamp >= timestamp && reading.timestamp < timestamp + interval
    );

    if (bucket.length > 0) {
      aggregated.push({
        timestamp: new Date(timestamp).toLocaleString('en-US', timeFormat),
        waterLevel: parseFloat(
          (bucket.reduce((sum, reading) => sum + reading.waterLevel, 0) / bucket.length).toFixed(2)
        ),
      });
    }
  }

  return aggregated;
};

const getComponentStatus = (
  reading: SensorReading | null,
  isConnected: boolean,
  lastUpdate: Date
): ComponentStatus => {
  const updatedRecently = Date.now() - lastUpdate.getTime() <= 30_000;

  return {
    redLedOnline: reading?.status === 'warning' || reading?.status === 'critical',
    orangeLedOnline: reading?.status === 'moderate',
    greenLedOnline: reading?.status === 'normal',
    ultrasonicOnline: Boolean(reading?.waterLevel !== undefined && isConnected && updatedRecently),
  };
};

export const useFloodData = () => {
  const [station, setStation] = useState<StationData | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalStations: 1,
    activeStations: 0,
    moderateStations: 0,
    warningStations: 0,
    criticalStations: 0,
    offlineStations: 1,
    avgWaterLevel: 0,
    maxWaterLevel: 0,
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date(0));
  const [isConnected, setIsConnected] = useState(false);
  const [currentTimeRange, setCurrentTimeRange] = useState<TimeRange>('24h');
  const [componentStatus, setComponentStatus] = useState<ComponentStatus>({
    redLedOnline: false,
    orangeLedOnline: false,
    greenLedOnline: false,
    ultrasonicOnline: false,
  });

  useEffect(() => {
    const currentRef = dbHelpers.getCurrentRef();

    const unsubscribe = onValue(
      currentRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setIsConnected(false);
          setLoading(false);
          return;
        }

        const raw = snapshot.val();
        const rawCurrent = raw.currentStatus ?? raw.sensors ?? raw;
        const timestamp = Date.now();
        const reading = toSensorReading(rawCurrent, timestamp);

        if (!reading) {
          setLoading(false);
          return;
        }

        const updateTime = new Date();
        setStation((previous) => ({
          ...(previous ?? STATION_CONFIG),
          currentReading: reading,
          history: previous?.history ?? [],
        }));
        setLastUpdate(updateTime);
        setIsConnected(true);
        setLoading(false);
        setComponentStatus(getComponentStatus(reading, true, updateTime));

        setStats((previous) => ({
          ...previous,
          activeStations: reading.status !== 'offline' ? 1 : 0,
          moderateStations: reading.status === 'moderate' ? 1 : 0,
          warningStations: reading.status === 'warning' ? 1 : 0,
          criticalStations: reading.status === 'critical' ? 1 : 0,
          offlineStations: reading.status === 'offline' ? 1 : 0,
          avgWaterLevel: reading.waterLevel,
          maxWaterLevel: Math.max(previous.maxWaterLevel, reading.waterLevel),
        }));
      },
      () => {
        setIsConnected(false);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const historyRef = dbHelpers.getHistoryRef(500);

    const unsubscribe = onValue(
      historyRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setHistory([]);
          setAlerts([]);
          setLoading(false);
          return;
        }

        const raw = snapshot.val() as Record<string, Esp32HistoryEntry>;
        const readings = Object.entries(raw)
          .map(([key, entry]) => toSensorReading(entry, keyToTimestamp(key, entry), key))
          .filter((reading): reading is SensorReading => reading !== null)
          .sort((a, b) => a.timestamp - b.timestamp);

        setHistory(readings);
        setStation((previous) =>
          previous
            ? { ...previous, history: readings }
            : {
                ...STATION_CONFIG,
                currentReading: readings[readings.length - 1],
                history: readings,
              }
        );

        const historyAlerts = readings
          .filter((reading) => ['moderate', 'warning', 'critical'].includes(reading.status))
          .slice(-10)
          .map(generateAlert)
          .filter((alert): alert is Alert => alert !== null);

        setAlerts(historyAlerts);

        const levels = readings.map((reading) => reading.waterLevel);
        if (levels.length > 0) {
          const max = Math.max(...levels);
          const avg = levels.reduce((sum, level) => sum + level, 0) / levels.length;
          setStats((previous) => ({
            ...previous,
            avgWaterLevel: parseFloat(avg.toFixed(2)),
            maxWaterLevel: parseFloat(max.toFixed(2)),
          }));
        }

        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setChartData(buildChartData(history, currentTimeRange));
  }, [history, currentTimeRange]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setComponentStatus((previous) => ({
        ...previous,
        ultrasonicOnline: Boolean(station?.currentReading?.waterLevel !== undefined && isConnected && Date.now() - lastUpdate.getTime() <= 30_000),
      }));
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [isConnected, lastUpdate, station?.currentReading?.waterLevel]);

  const acknowledgeAlert = useCallback(async (alertId: string, acknowledgedBy = 'System User') => {
    const alert = alerts.find((currentAlert) => currentAlert.id === alertId);
    if (!alert?.recordKey) return;

    await update(dbHelpers.getHistoryRecordRef(alert.recordKey), {
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy,
    });
  }, [alerts]);

  const createManualAlert = useCallback(async (createdBy: string) => {
    await push(ref(database, 'floodmonitoring/history'), {
      status: 'HIGH',
      waterLevel: 0,
      source: 'MANUAL',
      createdBy,
      time: new Date().toISOString(),
      acknowledged: false,
    });
  }, []);

  const setTimeRange = useCallback((range: TimeRange) => {
    setCurrentTimeRange(range);
  }, []);

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
    componentStatus,
    currentTimeRange,
    acknowledgeAlert,
    createManualAlert,
    setTimeRange,
    getHistoryByTimeRange,
  };
};

export default useFloodData;
