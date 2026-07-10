import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Search, 
  Cpu, 
  Circle, 
  Activity,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Battery
} from 'lucide-react';
import type { ComponentHistoryRecord } from '@/types/floodData';

interface ComponentHistoryPageProps {
  componentKey: string;
  componentName: string;
  isOnline: boolean;
  history: ComponentHistoryRecord[];
  onBack: () => void;
}

export const ComponentHistoryPage = ({
  componentKey,
  componentName,
  isOnline,
  history,
  onBack,
}: ComponentHistoryPageProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter history based on search and status selection
  const filteredHistory = useMemo(() => {
    return history.filter((record) => {
      const matchesSearch = record.timestamp.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            record.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' ||
                            (statusFilter === 'online' && record.online === 1) ||
                            (statusFilter === 'offline' && record.online === 0);

      return matchesSearch && matchesStatus;
    });
  }, [history, searchTerm, statusFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / itemsPerPage));
  const paginatedHistory = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredHistory, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getStatusBadge = (online: number) => {
    return online === 1 ? (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-medium tracking-wide">
        ONLINE
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-medium tracking-wide">
        OFFLINE
      </Badge>
    );
  };

  // Stats calculation
  const onlineCount = history.filter((r) => r.online === 1).length;
  const offlineCount = history.filter((r) => r.online === 0).length;
  const reliability = history.length > 0 
    ? ((onlineCount / history.length) * 100).toFixed(1) 
    : '100.0';

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={onBack}
            className="h-9 w-9 rounded-lg hover:bg-muted hover:scale-105 transition-all duration-200 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{componentName} Log</h1>
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Realtime monitoring & connection history log</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Current State:</span>
          {getStatusBadge(isOnline ? 1 : 0)}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border bg-gradient-to-br from-background to-muted/40 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <span className="text-xs font-medium text-muted-foreground">Log Reliability</span>
            <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-500">
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-bold">{reliability}%</div>
            <p className="text-[10px] text-muted-foreground mt-1">Ratio of online records to offline records</p>
          </CardContent>
        </Card>

        <Card className="border bg-gradient-to-br from-background to-muted/40 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <span className="text-xs font-medium text-muted-foreground">Online Transitions</span>
            <div className="p-1 rounded-md bg-blue-500/10 text-blue-500">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-bold">{onlineCount} events</div>
            <p className="text-[10px] text-muted-foreground mt-1">Number of times component status registered online</p>
          </CardContent>
        </Card>

        <Card className="border bg-gradient-to-br from-background to-muted/40 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <span className="text-xs font-medium text-muted-foreground">Offline Failures</span>
            <div className="p-1 rounded-md bg-rose-500/10 text-rose-500">
              <Battery className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-bold">{offlineCount} events</div>
            <p className="text-[10px] text-muted-foreground mt-1">Total recorded connection drops or inactive states</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border shadow-sm">
        <CardHeader className="p-4 sm:p-6 pb-4 border-b">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-blue-500" />
              Event Timeline
            </CardTitle>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              {/* Search input */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search date & time..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 text-xs h-8 focus-visible:ring-1"
                />
              </div>

              {/* Status Filter buttons */}
              <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setStatusFilter('all');
                    setCurrentPage(1);
                  }}
                  className="text-[10px] h-7 px-2"
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === 'online' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setStatusFilter('online');
                    setCurrentPage(1);
                  }}
                  className="text-[10px] h-7 px-2"
                >
                  Online
                </Button>
                <Button
                  variant={statusFilter === 'offline' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setStatusFilter('offline');
                    setCurrentPage(1);
                  }}
                  className="text-[10px] h-7 px-2"
                >
                  Offline
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-12">#</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date & Time</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  {componentKey !== 'ultrasonic' && (
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Voltage</th>
                  )}
                  {componentKey !== 'ultrasonic' && (
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Relay Code</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedHistory.length > 0 ? (
                  paginatedHistory.map((record, index) => {
                    const rowNum = (currentPage - 1) * itemsPerPage + index + 1;
                    return (
                      <tr 
                        key={record.id} 
                        className="hover:bg-muted/30 transition-colors duration-150"
                      >
                        <td className="px-4 py-3 text-muted-foreground font-mono">{rowNum}</td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {record.timestamp}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(record.online)}
                        </td>
                        {componentKey !== 'ultrasonic' && (
                          <td className="px-4 py-3 font-mono text-[11px] text-foreground">
                            {record.voltage.toFixed(2)} V
                          </td>
                        )}
                        {componentKey !== 'ultrasonic' && (
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                              record.relay === 1 
                                ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' 
                                : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                            }`}>
                              {record.relay === 1 ? '1 - ACTIVE' : '0 - INACTIVE'}
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={componentKey === 'ultrasonic' ? 3 : 5} className="px-4 py-8 text-center text-muted-foreground">
                      No logs matching the filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-4">
              <span className="text-xs text-muted-foreground">
                Showing {Math.min(filteredHistory.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(filteredHistory.length, currentPage * itemsPerPage)} of {filteredHistory.length} logs
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 hover:bg-muted"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs font-medium px-2.5 py-1 rounded bg-muted/60">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 hover:bg-muted"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
