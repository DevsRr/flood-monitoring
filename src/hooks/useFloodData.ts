import { useState, useEffect, useCallback } from 'react';
import { onValue, set, update } from 'firebase/database';
import { dbHelpers } from '@/lib/firebase';
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
  location: 'Baranggay Caroyroyan, Pili, Camirines Sur.',
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
  timestamp?: string;
}

interface Esp32HistoryEntry extends Esp32Current {
  source?: 'SENSOR' | 'MANUAL';
  acknowledged?: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  createdBy?: string;
}

interface ComponentEntry {
  name?: string;
  online?: number;
  relay?: number;
  voltage?: number;
}

interface ComponentsNode {
  green?: ComponentEntry;
  orange?: ComponentEntry;
  red?: ComponentEntry;
  siren?: ComponentEntry;
  ultrasonic?: ComponentEntry;
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
    case 'SAFE':
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

// Keys look like "2026-07-02T14-19-14-08-00", which is an ISO timestamp
// (2026-07-02T14:19:14+08:00) with ':' and '+' swapped for '-' so it's a
// valid Firebase key. This reconstructs the original ISO string.
const parseHistoryKey = (key: string): number => {
  const [datePart, timePart] = key.split('T');
  if (!datePart || !timePart) return NaN;

  const segments = timePart.split('-').filter(Boolean);
  if (segments.length < 3) return NaN;

  const [hh, mm, ss, tzHH, tzMM] = segments;
  const timezone = tzHH && tzMM ? `+${tzHH}:${tzMM}` : '';
  const isoString = `${datePart}T${hh}:${mm}:${ss}${timezone}`;
  return Date.parse(isoString);
};

const keyToTimestamp = (key: string, entry?: Esp32HistoryEntry): number => {
  const candidateTime = entry?.timestamp ?? entry?.time ?? entry?.updatedAt;
  if (candidateTime) {
    const parsed = Date.parse(candidateTime.replace(' ', 'T'));
    if (!Number.isNaN(parsed)) return parsed;
  }

  const fromKey = parseHistoryKey(key);
  if (!Number.isNaN(fromKey)) return fromKey;

  // Legacy fallback for older "2026-07-02_14-19-14" style keys
  const [datePart, timePart] = key.split('_');
  if (!datePart || !timePart) return NaN;

  const isoString = `${datePart}T${timePart.replace(/-/g, ':')}`;
  const parsed = Date.parse(isoString);
  return parsed;
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

const isComponentOnline = (component?: ComponentEntry): boolean => component?.online === 1;

const toComponentStatus = (components: ComponentsNode): ComponentStatus => ({
  redLedOnline: isComponentOnline(components.red),
  orangeLedOnline: isComponentOnline(components.orange),
  greenLedOnline: isComponentOnline(components.green),
  ultrasonicOnline: isComponentOnline(components.ultrasonic),
  sirenOn: isComponentOnline(components.siren),
});

export const useFloodData = (listenToSensors = false) => {
  const [station, setStation] = useState<StationData | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [warningReadings, setWarningReadings] = useState<SensorReading[]>([]);
  const [criticalReadings, setCriticalReadings] = useState<SensorReading[]>([]);
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
    sirenOn: false,
  });
  const [sirenOn, setSirenOn] = useState(false);
  const [sirenLastUpdate, setSirenLastUpdate] = useState<Date>(new Date(0));
  const [sensorLastUpdate, setSensorLastUpdate] = useState<Date>(new Date(0));
  const [manualSirenOn, setManualSirenOn] = useState(false);
  const [manualSirenLastUpdate, setManualSirenLastUpdate] = useState<Date>(new Date(0));

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

        const raw = snapshot.val() as Esp32Current;
        const status = mapEsp32Status(raw.status);
        const updateTime = new Date();

        setLastUpdate(updateTime);
        setIsConnected(true);
        setLoading(false);
        setStats((previous) => ({
          ...previous,
          activeStations: status !== 'offline' ? 1 : 0,
          moderateStations: status === 'moderate' ? 1 : 0,
          warningStations: status === 'warning' ? 1 : 0,
          criticalStations: status === 'critical' ? 1 : 0,
          offlineStations: status === 'offline' ? 1 : 0,
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
    if (!listenToSensors) {
      setComponentStatus({
        redLedOnline: false,
        orangeLedOnline: false,
        greenLedOnline: false,
        ultrasonicOnline: false,
        sirenOn: false,
      });
      setSirenOn(false);
      setSirenLastUpdate(new Date(0));
      setSensorLastUpdate(new Date(0));
      return;
    }

    const componentsRef = dbHelpers.getComponentsRef();

    const unsubscribe = onValue(
      componentsRef,
      (snapshot) => {
        const components = (snapshot.val() ?? {}) as ComponentsNode;
        const nextStatus = toComponentStatus(components);
        const updateTime = new Date();

        setComponentStatus(nextStatus);
        setSensorLastUpdate(updateTime);
        const nextSirenOn = nextStatus.sirenOn;
        setSirenOn(nextSirenOn);
        setSirenLastUpdate(updateTime);
      },
      () => {
        setSensorLastUpdate(new Date(0));
        setSirenLastUpdate(new Date(0));
      }
    );

    return () => unsubscribe();
  }, [listenToSensors]);

  useEffect(() => {
    if (!listenToSensors) {
      setManualSirenOn(false);
      setManualSirenLastUpdate(new Date(0));
      return;
    }

    const manualSirenRef = dbHelpers.getManualSirenRef();

    const unsubscribe = onValue(
      manualSirenRef,
      (snapshot) => {
        const value = snapshot.val();
        setManualSirenOn(value === 1);
        setManualSirenLastUpdate(new Date());
      },
      () => {
        setManualSirenLastUpdate(new Date(0));
      }
    );

    return () => unsubscribe();
  }, [listenToSensors]);

  useEffect(() => {
    const historyRef = dbHelpers.getHistoryRef(500);

    const unsubscribe = onValue(
      historyRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setHistory([]);
          setLoading(false);
          return;
        }

        const raw = snapshot.val() as Record<string, Esp32HistoryEntry>;
        const readings = Object.entries(raw)
          .map(([key, entry]) => {
            const timestamp = keyToTimestamp(key, entry);
            if (Number.isNaN(timestamp)) return null;
            return toSensorReading(entry, timestamp, key);
          })
          .filter((reading): reading is SensorReading => reading !== null)
          .sort((a, b) => a.timestamp - b.timestamp);

        setHistory(readings);
        const latestReading = readings[readings.length - 1];
        setStation((previous) => ({
          ...(previous ?? STATION_CONFIG),
          currentReading: latestReading ?? previous?.currentReading,
          history: readings,
        }));

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

  // Alerts are queried directly by status (WARNING/CRITICAL) via an indexed
  // query, independent of the recency-limited history window above. This
  // guarantees older or seeded flood events still surface even when
  // frequent live SAFE readings would otherwise crowd them out of a
  // "last N records" query.
  useEffect(() => {
    const toReadings = (raw: Record<string, Esp32HistoryEntry> | null): SensorReading[] => {
      if (!raw) return [];
      return Object.entries(raw)
        .map(([key, entry]) => {
          const timestamp = keyToTimestamp(key, entry);
          if (Number.isNaN(timestamp)) return null;
          return toSensorReading(entry, timestamp, key);
        })
        .filter((reading): reading is SensorReading => reading !== null);
    };

    const warningRef = dbHelpers.getHistoryByStatusRef('WARNING', 300);
    const criticalRef = dbHelpers.getHistoryByStatusRef('CRITICAL', 300);

    const unsubWarning = onValue(warningRef, (snapshot) => {
      setWarningReadings(toReadings(snapshot.val()));
    });
    const unsubCritical = onValue(criticalRef, (snapshot) => {
      setCriticalReadings(toReadings(snapshot.val()));
    });

    return () => {
      unsubWarning();
      unsubCritical();
    };
  }, []);

  useEffect(() => {
    const seen = new Set<string>();
    const merged = [...criticalReadings, ...warningReadings]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(generateAlert)
      .filter((alert): alert is Alert => alert !== null)
      .filter((alert) => {
        if (seen.has(alert.id)) return false;
        seen.add(alert.id);
        return true;
      });

    setAlerts(merged);
  }, [warningReadings, criticalReadings]);

  useEffect(() => {
    setChartData(buildChartData(history, currentTimeRange));
  }, [history, currentTimeRange]);

  const acknowledgeAlert = useCallback(async (alertId: string, acknowledgedBy = 'System User') => {
    const alert = alerts.find((currentAlert) => currentAlert.id === alertId);
    if (!alert?.recordKey) return;

    await update(dbHelpers.getHistoryRecordRef(alert.recordKey), {
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy,
    });
  }, [alerts]);

  const updateSirenStatus = useCallback(async (enabled: boolean) => {
    await set(dbHelpers.getManualSirenRef(), enabled ? 1 : 0);
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
    sirenOn,
    sirenLastUpdate,
    sensorLastUpdate,
    manualSirenOn,
    manualSirenLastUpdate,
    currentTimeRange,
    acknowledgeAlert,
    updateSirenStatus,
    setTimeRange,
    getHistoryByTimeRange,
  };
};

export default useFloodData;