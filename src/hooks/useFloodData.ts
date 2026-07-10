import { useState, useEffect, useCallback, useMemo } from 'react';
import { onValue, set, update, ref, push } from 'firebase/database';
import { dbHelpers, database, DB_PATHS } from '@/lib/firebase';
import type {
  Alert,
  ChartDataPoint,
  ComponentStatus,
  DashboardStats,
  SensorReading,
  StationData,
  ComponentHistoryRecord,
  DiagnosticAlert,
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

const parseCustomTimestamp = (timestampStr: string): number => {
  // 1. Try custom regex parsing for MM/DD/YYYY hh:mm:ss AM/PM or similar
  const match = timestampStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s+(AM|PM))?$/i);
  if (match) {
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    let hour = parseInt(match[4], 10);
    const minute = parseInt(match[5], 10);
    const second = parseInt(match[6], 10);
    const ampm = match[7]?.toUpperCase();

    if (ampm === 'PM' && hour < 12) {
      hour += 12;
    } else if (ampm === 'AM' && hour === 12) {
      hour = 0;
    }
    const d = new Date(year, month - 1, day, hour, minute, second);
    const time = d.getTime();
    if (!Number.isNaN(time)) return time;
  }

  // 2. Try standard parsing with space replaced with T (which fits ISO-like strings)
  let parsed = Date.parse(timestampStr.replace(' ', 'T'));
  if (!Number.isNaN(parsed)) return parsed;

  // 3. Try standard parsing directly
  parsed = Date.parse(timestampStr);
  if (!Number.isNaN(parsed)) return parsed;

  return Date.now();
};

const keyToTimestamp = (key: string, entry?: Esp32HistoryEntry): number => {
  const candidateTime = entry?.timestamp ?? entry?.time ?? entry?.updatedAt;
  if (candidateTime) {
    const parsed = parseCustomTimestamp(candidateTime);
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

  // For short time ranges (<=24h), display the raw live data points with seconds,
  // making it a true live-scrolling real-time chart.
  if (hours <= 24) {
    return [...filtered]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((reading) => ({
        timestamp: new Date(reading.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
        waterLevel: reading.waterLevel,
      }));
  }

  // For longer ranges, aggregate data to avoid clogging the chart.
  let interval: number;
  let timeFormat: Intl.DateTimeFormatOptions;

  if (hours <= 168) {
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

const parseComponentHistory = (historyObj: any, defaultName: string): ComponentHistoryRecord[] => {
  if (!historyObj) return [];
  return Object.entries(historyObj)
    .map(([id, val]: [string, any]) => ({
      id,
      timestamp: val.timestamp ?? '',
      online: typeof val.online === 'number' ? val.online : 0,
      voltage: typeof val.voltage === 'number' ? val.voltage : 0,
      relay: typeof val.relay === 'number' ? val.relay : 0,
      name: val.name ?? defaultName,
    }))
    .sort((a, b) => Date.parse(a.timestamp.replace(' ', 'T')) - Date.parse(b.timestamp.replace(' ', 'T')));
};

const checkAndLogComponentHistory = async (
  key: string,
  name: string,
  currentOnline: number,
  currentVoltage: number,
  currentRelay: number,
  historyList: ComponentHistoryRecord[]
) => {
  const lastRecord = historyList[historyList.length - 1];
  const hasChanged = !lastRecord || 
                     lastRecord.online !== currentOnline || 
                     lastRecord.voltage !== currentVoltage || 
                     lastRecord.relay !== currentRelay;

  if (hasChanged) {
    const newRecordRef = push(ref(database, `${DB_PATHS.COMPONENTS}/${key}/history`));
    await set(newRecordRef, {
      timestamp: new Date().toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }),
      online: currentOnline,
      voltage: currentVoltage,
      relay: currentRelay,
      name,
    });
  }
};

const seedMockComponentHistory = async (key: string, name: string, finalOnline: number) => {
  const mockRecords = [
    { offsetMs: -48 * 60 * 60 * 1000, online: 1, voltage: 5.0, relay: 1 },
    { offsetMs: -47 * 60 * 60 * 1000, online: 0, voltage: 0.0, relay: 0 },
    { offsetMs: -24 * 60 * 60 * 1000, online: 1, voltage: 5.0, relay: 1 },
    { offsetMs: -12 * 60 * 60 * 1000, online: 0, voltage: 0.0, relay: 0 },
    { offsetMs: -1 * 60 * 60 * 1000, online: finalOnline, voltage: finalOnline ? 5.0 : 0.0, relay: finalOnline ? 1 : 0 },
  ];

  const historyRef = ref(database, `${DB_PATHS.COMPONENTS}/${key}/history`);
  for (const record of mockRecords) {
    const time = new Date(Date.now() + record.offsetMs);
    const timestampStr = time.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const newRecordRef = push(historyRef);
    await set(newRecordRef, {
      timestamp: timestampStr,
      online: record.online,
      voltage: record.voltage,
      relay: record.relay,
      name,
    });
  }
};

const isComponentOnline = (component?: ComponentEntry): boolean => component?.online === 1;

const toComponentStatus = (components: ComponentsNode): ComponentStatus => {
  const keys = Object.keys(components) as (keyof ComponentsNode)[];
  const existingKeys = keys.filter(k => components[k] !== undefined && components[k]?.name !== undefined);

  return {
    redLedOnline: isComponentOnline(components.red),
    orangeLedOnline: isComponentOnline(components.orange),
    greenLedOnline: isComponentOnline(components.green),
    ultrasonicOnline: false,
    sirenOn: isComponentOnline(components.siren),
    hasUltrasonic: true,
    totalComponents: existingKeys.includes('ultrasonic') ? existingKeys.length : existingKeys.length + 1,
  };
};

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
    hasUltrasonic: true,
    totalComponents: 5,
  });
  const [sirenOn, setSirenOn] = useState(false);
  const [sirenLastUpdate, setSirenLastUpdate] = useState<Date>(new Date(0));
  const [sensorLastUpdate, setSensorLastUpdate] = useState<Date>(new Date(0));
  const [manualSirenOn, setManualSirenOn] = useState(false);
  const [manualSirenLastUpdate, setManualSirenLastUpdate] = useState<Date>(new Date(0));
  const [componentHistories, setComponentHistories] = useState<Record<string, ComponentHistoryRecord[]>>({
    red: [],
    orange: [],
    green: [],
    siren: [],
    ultrasonic: [],
  });
  const [rawComponents, setRawComponents] = useState<any | null>(null);

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

        const timestamp = keyToTimestamp('current', raw);
        const currentReading = toSensorReading(raw, timestamp, 'current');
        if (currentReading) {
          setHistory((prevHistory) => {
            const exists = prevHistory.some((h) => h.timestamp === currentReading.timestamp);
            if (exists) return prevHistory;
            return [...prevHistory, currentReading].sort((a, b) => a.timestamp - b.timestamp).slice(-100);
          });

          setStation((previous) => {
            const prevHistory = previous?.history ?? [];
            const exists = prevHistory.some((h) => h.timestamp === currentReading.timestamp);
            const nextHistory = exists
              ? prevHistory
              : [...prevHistory, currentReading].sort((a, b) => a.timestamp - b.timestamp).slice(-100);

            return {
              ...(previous ?? STATION_CONFIG),
              currentReading: currentReading,
              history: nextHistory,
            };
          });
        }
      },
      () => {
        setIsConnected(false);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const componentsRef = dbHelpers.getComponentsRef();

    const unsubscribe = onValue(
      componentsRef,
      async (snapshot) => {
        const val = snapshot.val() ?? {};
        const greenHistory = parseComponentHistory(val.green?.history, 'Green LED');
        const orangeHistory = parseComponentHistory(val.orange?.history, 'Orange LED');
        const redHistory = parseComponentHistory(val.red?.history, 'Red LED');
        const sirenHistory = parseComponentHistory(val.siren?.history, 'Siren');

        setComponentHistories((prev) => ({
          ...prev,
          green: greenHistory,
          orange: orangeHistory,
          red: redHistory,
          siren: sirenHistory,
        }));

        // Trigger change detection / seeding
        if (val.green) {
          if (greenHistory.length === 0) {
            await seedMockComponentHistory('green', 'Green LED', val.green.online ?? 0);
          } else {
            await checkAndLogComponentHistory('green', 'Green LED', val.green.online ?? 0, val.green.voltage ?? 0, val.green.relay ?? 0, greenHistory);
          }
        }
        if (val.orange) {
          if (orangeHistory.length === 0) {
            await seedMockComponentHistory('orange', 'Orange LED', val.orange.online ?? 0);
          } else {
            await checkAndLogComponentHistory('orange', 'Orange LED', val.orange.online ?? 0, val.orange.voltage ?? 0, val.orange.relay ?? 0, orangeHistory);
          }
        }
        if (val.red) {
          if (redHistory.length === 0) {
            await seedMockComponentHistory('red', 'Red LED', val.red.online ?? 0);
          } else {
            await checkAndLogComponentHistory('red', 'Red LED', val.red.online ?? 0, val.red.voltage ?? 0, val.red.relay ?? 0, redHistory);
          }
        }
        if (val.siren) {
          if (sirenHistory.length === 0) {
            await seedMockComponentHistory('siren', 'Siren', val.siren.online ?? 0);
          } else {
            await checkAndLogComponentHistory('siren', 'Siren', val.siren.online ?? 0, val.siren.voltage ?? 0, val.siren.relay ?? 0, sirenHistory);
          }
        }

        const components = val as ComponentsNode;
        setRawComponents(components);
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
  }, []);

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
          setStation((previous) => {
            if (previous) {
              return {
                ...previous,
                history: [],
              };
            }
            return null;
          });
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

        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const levels = history.map((reading) => reading.waterLevel);
    if (levels.length > 0) {
      const max = Math.max(...levels);
      const avg = levels.reduce((sum, level) => sum + level, 0) / levels.length;
      setStats((previous) => ({
        ...previous,
        avgWaterLevel: parseFloat(avg.toFixed(2)),
        maxWaterLevel: parseFloat(max.toFixed(2)),
      }));
    } else {
      setStats((previous) => ({
        ...previous,
        avgWaterLevel: 0,
        maxWaterLevel: 0,
      }));
    }
  }, [history]);

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
    await update(ref(database, DB_PATHS.CURRENT_STATE), {
      manualMode: enabled,
      'relays/siren': enabled ? 1 : 0,
    });
  }, []);

  const setTimeRange = useCallback((range: TimeRange) => {
    setCurrentTimeRange(range);
  }, []);

  const getHistoryByTimeRange = useCallback(
    (range: TimeRange): ChartDataPoint[] => buildChartData(history, range),
    [history]
  );

  const currentWaterLevel = station?.currentReading?.waterLevel ?? 0;

  useEffect(() => {
    setComponentStatus((prev) => ({
      ...prev,
      ultrasonicOnline: currentWaterLevel > 0,
    }));
  }, [currentWaterLevel]);

  useEffect(() => {
    const ultrasonicHistory: ComponentHistoryRecord[] = history.map((reading, index) => {
      const isReadingOnline = reading.waterLevel > 0;
      const timeStr = new Date(reading.timestamp).toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      return {
        id: `ultrasonic-${reading.id ?? index}`,
        timestamp: timeStr,
        online: isReadingOnline ? 1 : 0,
        voltage: isReadingOnline ? 5.0 : 0.0,
        relay: 0,
        name: 'Ultrasonic Sensor',
      };
    });

    setComponentHistories((prev) => ({
      ...prev,
      ultrasonic: ultrasonicHistory,
    }));
  }, [history]);

  const diagnosticAlerts = useMemo<DiagnosticAlert[]>(() => {
    if (!rawComponents) return [];

    const alertsList: DiagnosticAlert[] = [];
    const timestampStr = new Date().toISOString();

    const checkComponent = (key: string, name: string, isOnline: boolean, entry?: any) => {
      if (!entry) return;

      if (!isOnline) {
        alertsList.push({
          id: `diag-offline-${key}`,
          componentKey: key,
          name,
          severity: 'medium',
          message: `${name} is currently OFFLINE. Check power supply and signal connection.`,
          timestamp: timestampStr,
        });
      }

      const relay = entry.relay ?? 0;
      const voltage = entry.voltage ?? 0;

      if (relay === 1 && voltage < 1.5) {
        alertsList.push({
          id: `diag-voltage-fault-${key}`,
          componentKey: key,
          name,
          severity: 'critical',
          message: `${name} relay is ACTIVE but output voltage is ${voltage.toFixed(1)}V. Check for blown fuse, wire disconnection, or hardware failure.`,
          timestamp: timestampStr,
        });
      }

      if (relay === 0 && voltage > 1.5) {
        alertsList.push({
          id: `diag-leakage-fault-${key}`,
          componentKey: key,
          name,
          severity: 'high',
          message: `${name} relay is INACTIVE but voltage leakage detected (${voltage.toFixed(1)}V). Check hardware board for short circuit.`,
          timestamp: timestampStr,
        });
      }
    };

    checkComponent('green', 'Green LED', componentStatus.greenLedOnline, rawComponents.green);
    checkComponent('orange', 'Orange LED', componentStatus.orangeLedOnline, rawComponents.orange);
    checkComponent('red', 'Red LED', componentStatus.redLedOnline, rawComponents.red);
    checkComponent('siren', 'Siren', componentStatus.sirenOn, rawComponents.siren);

    if (!componentStatus.ultrasonicOnline) {
      alertsList.push({
        id: 'diag-offline-ultrasonic',
        componentKey: 'ultrasonic',
        name: 'Ultrasonic Sensor',
        severity: 'high',
        message: 'Ultrasonic Sensor is OFFLINE (water level data is 0). Check connection or sensor alignment.',
        timestamp: timestampStr,
      });
    }

    return alertsList;
  }, [rawComponents, componentStatus]);

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
    componentHistories,
    diagnosticAlerts,
  };
};

export default useFloodData;