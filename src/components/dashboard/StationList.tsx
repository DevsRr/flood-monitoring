import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Droplets, 
  MapPin,
  ChevronRight,
  Activity,
  AlertTriangle,
  AlertOctagon,
  WifiOff
} from 'lucide-react';
import type { StationData } from '@/types/floodData';

interface StationListProps {
  stations: StationData[];
  onSelectStation: (station: StationData) => void;
  selectedStationId?: string;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'normal':
      return <Activity className="h-4 w-4 text-emerald-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'critical':
      return <AlertOctagon className="h-4 w-4 text-red-500" />;
    case 'offline':
      return <WifiOff className="h-4 w-4 text-slate-500" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
};

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

export const StationList = ({ stations, onSelectStation, selectedStationId }: StationListProps) => {
  const [filter, setFilter] = useState<'all' | 'warning' | 'critical'>('all');

  const filteredStations = stations.filter(station => {
    if (filter === 'all') return true;
    return station.currentReading.status === filter;
  });

  return (
    <Card className="h-full">
      <CardHeader className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-sm sm:text-base font-semibold">Stations</CardTitle>
          <div className="flex gap-1">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className="text-[10px] sm:text-xs h-6 sm:h-7 px-2"
            >
              All
            </Button>
            <Button
              variant={filter === 'warning' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('warning')}
              className="text-[10px] sm:text-xs h-6 sm:h-7 px-2"
            >
              Warn
            </Button>
            <Button
              variant={filter === 'critical' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('critical')}
              className="text-[10px] sm:text-xs h-6 sm:h-7 px-2"
            >
              Crit
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px] sm:h-[350px]">
          <div className="space-y-2 p-3 sm:p-4 pt-0">
            {filteredStations.map((station) => (
              <div
                key={station.id}
                onClick={() => onSelectStation(station)}
                className={`
                  p-3 rounded-lg border-2 cursor-pointer transition-all duration-200
                  hover:shadow-md hover:border-primary/50
                  ${selectedStationId === station.id ? 'border-primary bg-primary/5' : 'border-border'}
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-xs sm:text-sm truncate">{station.name}</h4>
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{station.location}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <Badge variant="outline" className={`${getStatusColor(station.currentReading.status)} text-[10px] px-1.5 py-0 h-5`}>
                      <span className="flex items-center gap-0.5">
                        {getStatusIcon(station.currentReading.status)}
                        <span className="hidden sm:inline">{station.currentReading.status.toUpperCase()}</span>
                      </span>
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <Droplets className="h-4 w-4 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Water Level</p>
                    <p className="text-sm font-semibold">{station.currentReading.waterLevel.toFixed(2)}m</p>
                  </div>
                </div>

                <div className="mt-1.5 text-[10px] text-muted-foreground">
                  Updated: {new Date(station.currentReading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default StationList;
