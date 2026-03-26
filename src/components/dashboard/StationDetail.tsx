import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { 
  MapPin, 
  Activity, 
  Droplets, 
  TrendingUp,
  TrendingDown,
  Minus,
  History
} from 'lucide-react';
import type { StationData, ChartDataPoint } from '@/types/floodData';

interface StationDetailProps {
  station: StationData;
  history: ChartDataPoint[];
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'normal':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'warning':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'critical':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'offline':
      return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    default:
      return 'bg-slate-500/10 text-slate-600';
  }
};

const getTrend = (current: number, previous?: number) => {
  if (previous === undefined) return { icon: Minus, color: 'text-slate-500' };
  if (current > previous) return { icon: TrendingUp, color: 'text-red-500' };
  if (current < previous) return { icon: TrendingDown, color: 'text-emerald-500' };
  return { icon: Minus, color: 'text-slate-500' };
};

export const StationDetail = ({ station, history }: StationDetailProps) => {
  const reading = station.currentReading;
  const prevReading = station.history[station.history.length - 2] || reading;
  const trend = getTrend(reading.waterLevel, prevReading.waterLevel);
  const waterLevels = history.map(h => h.waterLevel);
  const avgWaterLevel = waterLevels.length > 0 
    ? (waterLevels.reduce((a, b) => a + b, 0) / waterLevels.length).toFixed(2)
    : '--';
  const maxWaterLevel = waterLevels.length > 0
    ? Math.max(...waterLevels).toFixed(2)
    : '--';
  const minWaterLevel = waterLevels.length > 0
    ? Math.min(...waterLevels).toFixed(2)
    : '--';

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-2 sm:p-3 shadow-lg text-xs sm:text-sm">
          <p className="font-semibold mb-1">{label}</p>
          <p style={{ color: '#3b82f6' }}>
            Water Level: {payload[0].value} cm
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full">
      <CardHeader className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-400 p-1.5 sm:p-2 rounded-lg shrink-0">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm sm:text-base font-semibold truncate">{station.name}</CardTitle>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{station.location}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${getStatusColor(reading.status)} text-[10px] sm:text-xs`}>
              <Activity className="h-3 w-3 mr-1" />
              {reading.status.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="bg-muted text-[10px] sm:text-xs">
              <History className="h-3 w-3 mr-1" />
              {station.history.length}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        {/* Current Reading Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className={`p-3 rounded-lg border bg-card ${reading.status === 'critical' ? 'ring-2 ring-red-500/50' : reading.status === 'warning' ? 'ring-2 ring-amber-500/50' : ''}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="bg-blue-500/10 text-blue-500 p-1.5 rounded-md">
                <Droplets className="h-4 w-4" />
              </div>
              <trend.icon className={`h-4 w-4 ${trend.color}`} />
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Current Level</p>
            <p className="text-lg sm:text-xl font-bold">{reading.waterLevel.toFixed(2)}cm</p>
          </div>
          
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-1">
              <div className="bg-cyan-500/10 text-cyan-500 p-1.5 rounded-md">
                <Droplets className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Average</p>
            <p className="text-lg sm:text-xl font-bold">{avgWaterLevel}cm</p>
          </div>
          
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-1">
              <div className="bg-indigo-500/10 text-indigo-500 p-1.5 rounded-md">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Maximum</p>
            <p className="text-lg sm:text-xl font-bold">{maxWaterLevel}cm</p>
          </div>
          
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-1">
              <div className="bg-emerald-500/10 text-emerald-500 p-1.5 rounded-md">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Minimum</p>
            <p className="text-lg sm:text-xl font-bold">{minWaterLevel}cm</p>
          </div>
        </div>

        {/* Water Level Chart */}
        <div className="h-[200px] sm:h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorWaterDetail" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="timestamp" 
                tick={{ fontSize: 9 }} 
                interval="preserveStartEnd"
                minTickGap={20}
                angle={-45}
                textAnchor="end"
                height={40}
              />
              <YAxis 
                tick={{ fontSize: 9 }} 
                domain={['auto', 'auto']}
                width={30}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={15.24} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Warn', position: 'right', fontSize: 9 }} />
              <ReferenceLine y={22.86} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Crit', position: 'right', fontSize: 9 }} />
              <Area
                type="monotone"
                dataKey="waterLevel"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorWaterDetail)"
                strokeWidth={2}
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 sm:mt-4 text-[10px] sm:text-xs text-muted-foreground text-center">
          Last updated: {new Date(reading.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </CardContent>
    </Card>
  );
};

export default StationDetail;