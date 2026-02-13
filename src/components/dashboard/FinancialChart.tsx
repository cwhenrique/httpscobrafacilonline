import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loan, LoanPayment } from '@/types/database';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface FinancialChartProps {
  loans: Loan[];
  payments: LoanPayment[];
}

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export function FinancialChart({ loans, payments }: FinancialChartProps) {
  const chartData = useMemo(() => {
    const last6Months: { month: string; year: number; monthIndex: number }[] = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      last6Months.push({
        month: MONTH_NAMES[date.getMonth()],
        year: date.getFullYear(),
        monthIndex: date.getMonth(),
      });
    }

    return last6Months.map(({ month, year, monthIndex }) => {
      // Total emprestado no mês
      const monthLoans = loans.filter((loan) => {
        // Use contract_date or start_date instead of created_at for accurate historical reporting
        const loanDate = new Date(loan.contract_date || loan.start_date || loan.created_at);
        return loanDate.getMonth() === monthIndex && loanDate.getFullYear() === year;
      });
      const emprestado = monthLoans.reduce((sum, loan) => sum + loan.principal_amount, 0);

      // Total recebido no mês
      const monthPayments = payments.filter((payment) => {
        const paymentDate = new Date(payment.payment_date);
        return paymentDate.getMonth() === monthIndex && paymentDate.getFullYear() === year;
      });
      const recebido = monthPayments.reduce((sum, payment) => sum + payment.amount, 0);

      return {
        name: `${month}/${year.toString().slice(-2)}`,
        Emprestado: emprestado,
        Recebido: recebido,
      };
    });
  }, [loans, payments]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-lg font-display">Evolução Financeira (Últimos 6 meses)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }} 
                className="text-muted-foreground"
              />
              <YAxis 
                tickFormatter={formatCurrency} 
                tick={{ fontSize: 12 }} 
                className="text-muted-foreground"
                width={70}
              />
              <Tooltip
                formatter={(value: number) => [
                  new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(value),
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Bar 
                dataKey="Emprestado" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="Recebido" 
                fill="hsl(var(--success))" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function InterestChart({ payments }: { payments: LoanPayment[] }) {
  const chartData = useMemo(() => {
    const last6Months: { month: string; year: number; monthIndex: number }[] = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      last6Months.push({
        month: MONTH_NAMES[date.getMonth()],
        year: date.getFullYear(),
        monthIndex: date.getMonth(),
      });
    }

    let accumulated = 0;
    return last6Months.map(({ month, year, monthIndex }) => {
      const monthPayments = payments.filter((payment) => {
        const paymentDate = new Date(payment.payment_date);
        return paymentDate.getMonth() === monthIndex && paymentDate.getFullYear() === year;
      });
      
      const jurosNoMes = monthPayments.reduce((sum, payment) => sum + (payment.interest_paid || 0), 0);
      accumulated += jurosNoMes;

      return {
        name: `${month}/${year.toString().slice(-2)}`,
        'Juros no Mês': jurosNoMes,
        'Juros Acumulado': accumulated,
      };
    });
  }, [payments]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-lg font-display">Tendência de Juros Recebidos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }} 
                className="text-muted-foreground"
              />
              <YAxis 
                tickFormatter={formatCurrency} 
                tick={{ fontSize: 12 }} 
                className="text-muted-foreground"
                width={70}
              />
              <Tooltip
                formatter={(value: number) => [
                  new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(value),
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Line 
                type="monotone"
                dataKey="Juros no Mês" 
                stroke="hsl(var(--warning))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--warning))', r: 4 }}
              />
              <Line 
                type="monotone"
                dataKey="Juros Acumulado" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
