import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface MonthlyData {
  month: string;
  received: number;
  loaned: number;
  profit: number;
  overdue: number;
}

interface EvolutionChartProps {
  data: MonthlyData[];
}

type MetricKey = 'received' | 'loaned' | 'profit' | 'overdue';

const metricConfig: Record<MetricKey, { label: string; color: string; chartColor: string }> = {
  received: { label: 'Recebido', color: 'bg-emerald-500', chartColor: 'hsl(142, 76%, 36%)' },
  loaned: { label: 'Emprestado', color: 'bg-primary', chartColor: 'hsl(142, 70%, 45%)' },
  profit: { label: 'Lucro', color: 'bg-blue-500', chartColor: 'hsl(200, 80%, 50%)' },
  overdue: { label: 'Atraso', color: 'bg-destructive', chartColor: 'hsl(0, 84%, 60%)' },
};

export function EvolutionChart({ data }: EvolutionChartProps) {
  const [activeMetrics, setActiveMetrics] = useState<Record<MetricKey, boolean>>({
    received: true,
    loaned: true,
    profit: false,
    overdue: true,
  });

  const toggleMetric = (metric: MetricKey) => {
    setActiveMetrics(prev => ({ ...prev, [metric]: !prev[metric] }));
  };

  const activeLines = useMemo(() => {
    return (Object.keys(activeMetrics) as MetricKey[]).filter(key => activeMetrics[key]);
  }, [activeMetrics]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Evolução Mensal
          </CardTitle>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(metricConfig) as MetricKey[]).map((metric) => (
              <Button
                key={metric}
                variant={activeMetrics[metric] ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleMetric(metric)}
                className={cn(
                  "text-xs h-7 px-2",
                  activeMetrics[metric] && metricConfig[metric].color
                )}
              >
                {metricConfig[metric].label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 10 }} 
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} 
              tick={{ fontSize: 10 }} 
              width={45}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {activeLines.map((metric) => (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                name={metricConfig[metric].label}
                stroke={metricConfig[metric].chartColor}
                strokeWidth={2}
                dot={{ r: 3, fill: metricConfig[metric].chartColor }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
