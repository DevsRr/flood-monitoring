import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { ChartDataPoint } from '@/types/floodData';
import type { TimeRange } from '@/hooks/useFloodData';

interface MainChartProps {
  data: ChartDataPoint[];
  onTimeRangeChange?: (range: TimeRange) => void;
  currentRange?: TimeRange;
}

type ChartType = 'area' | 'line';

const WARN_LEVEL = 15.24;  
const CRIT_LEVEL = 22.86;  

const timeRanges: { value: TimeRange; label: string }[] = [
  { value: '1h',  label: '1H'  },
  { value: '6h',  label: '6H'  },
  { value: '24h', label: '24H' },
  { value: '1w',  label: '1W'  },
  { value: '1m',  label: '1M'  },
  { value: '1y',  label: '1Y'  },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg p-2 sm:p-3 shadow-lg text-xs sm:text-sm min-w-[140px]">
        <p className="font-semibold text-foreground mb-1"> {label}</p>
        <p style={{ color: '#3b82f6' }}>
          💧 Water Level: <strong>{payload[0].value} cm</strong>
        </p>
      </div>
    );
  }
  return null;
};

export const MainChart = ({ data, onTimeRangeChange, currentRange = '24h' }: MainChartProps) => {
  const [chartType, setChartType] = useState<ChartType>('area');

  const validData = useMemo(
    () => data.filter(d => typeof d.waterLevel === 'number'),
    [data]
  );

  const chartMargin = { top: 10, right: 60, left: 10, bottom: 70 };

  const CustomXTick = ({ x, y, payload }: any) => {
    const value: string = payload?.value ?? '';
    const timeMatch = value.match(/(\d{1,2}:\d{2})$/);
    const timePart = timeMatch ? timeMatch[1] : '';
    const datePart = timePart ? value.slice(0, value.lastIndexOf(timePart)).replace(/,?\s*$/, '').trim() : value;
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={12} textAnchor="middle" fill="#6b7280" fontSize={9} fontWeight={500}>
          {datePart}
        </text>
        {timePart && (
          <text x={0} y={0} dy={24} textAnchor="middle" fill="#9ca3af" fontSize={9}>
            {timePart}
          </text>
        )}
      </g>
    );
  };

  const xAxis = (
    <XAxis
      dataKey="timestamp"
      tick={<CustomXTick />}
      interval="preserveStartEnd"
      minTickGap={60}
      height={50}
    />
  );

  const yAxis = (
    <YAxis
      tick={{ fontSize: 10, fill: '#6b7280' }}
      domain={['auto', 'auto']}
      width={50}
      tickFormatter={(v: number) => `${v.toFixed(1)}cm`}
    />
  );

  const refLines = (
    <>
      <ReferenceLine
        y={WARN_LEVEL}
        stroke="#f59e0b"
        strokeDasharray="4 3"
        label={{ value: '⚠ Warn', position: 'insideTopRight', fontSize: 10, fill: '#f59e0b' }}
      />
      <ReferenceLine
        y={CRIT_LEVEL}
        stroke="#ef4444"
        strokeDasharray="4 3"
        label={{ value: '🔴 Crit', position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }}
      />
    </>
  );

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4">
        <CardTitle className="text-base sm:text-lg font-semibold">Water Level Monitor</CardTitle>
        <div className="flex flex-wrap items-center gap-2">

          {/* Time Range */}
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5 overflow-x-auto max-w-full">
            {timeRanges.map((range) => (
              <Button
                key={range.value}
                variant={currentRange === range.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onTimeRangeChange?.(range.value)}
                className="text-[10px] sm:text-xs h-6 sm:h-7 px-1.5 sm:px-2 min-w-[28px] sm:min-w-[36px]"
              >
                {range.label}
              </Button>
            ))}
          </div>

          {/* Chart Type */}
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            <Button
              variant={chartType === 'area' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartType('area')}
              className="text-[10px] sm:text-xs h-6 sm:h-7 px-2 sm:px-3"
            >
              Area
            </Button>
            <Button
              variant={chartType === 'line' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartType('line')}
              className="text-[10px] sm:text-xs h-6 sm:h-7 px-2 sm:px-3"
            >
              Line
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-2 sm:p-4 pt-0">
        <div className="h-[300px] sm:h-[360px] md:h-[420px] w-full">
          {validData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={validData} margin={chartMargin}>
                  <defs>
                    <linearGradient id="colorWaterMain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  {xAxis}
                  {yAxis}
                  <Tooltip content={<CustomTooltip />} />
                  {refLines}
                  <Area
                    type="monotone"
                    dataKey="waterLevel"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorWaterMain)"
                    strokeWidth={2}
                    isAnimationActive={false}
                    dot={{ fill: '#3b82f6', r: 3, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              ) : (
                <LineChart data={validData} margin={chartMargin}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  {xAxis}
                  {yAxis}
                  <Tooltip content={<CustomTooltip />} />
                  {refLines}
                  <Line
                    type="monotone"
                    dataKey="waterLevel"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    isAnimationActive={false}
                    dot={{ fill: '#3b82f6', r: 3, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              <p>No data available</p>
            </div>
          )}
        </div>

        <div className="mt-1 flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground px-1">
          <span>Points: {validData.length}</span>
          <span>Updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default MainChart;