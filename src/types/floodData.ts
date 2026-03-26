export interface SensorReading {
  id: string;
  timestamp: number;
  waterLevel: number;
  location: string;
  sensorId: string;
  status: 'normal' | 'warning' | 'critical' | 'offline';
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
  timestamp: number;
  stationId: string;
  stationName: string;
  type: 'flood_warning';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  acknowledged: boolean;
}

export interface DashboardStats {
  totalStations: number;
  activeStations: number;
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
