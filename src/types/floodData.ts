export interface SensorReading {
  id: string;
  recordKey?: string;
  timestamp: number;
  waterLevel: number;
  location: string;
  sensorId: string;
  status: 'normal' | 'moderate' | 'warning' | 'critical' | 'offline';
  source?: 'SENSOR' | 'MANUAL';
  acknowledged?: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface StationData {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  currentReading: SensorReading;
  history: SensorReading[];
}

export interface Alert {
  id: string;
  recordKey?: string;
  timestamp: number;
  stationId: string;
  stationName: string;
  type: 'flood_warning';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  source?: 'SENSOR' | 'MANUAL';
}

export interface DashboardStats {
  totalStations: number;
  activeStations: number;
  moderateStations?: number;
  warningStations: number;
  criticalStations: number;
  offlineStations: number;
  avgWaterLevel: number;
  maxWaterLevel: number;
}

export interface ChartDataPoint {
  timestamp: string;
  waterLevel: number;
}

export interface ComponentStatus {
  redLedOnline: boolean;
  orangeLedOnline: boolean;
  greenLedOnline: boolean;
  ultrasonicOnline: boolean;
  sirenOn: boolean;
}

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: 'Admin' | 'User';
  disabled: boolean;
}
