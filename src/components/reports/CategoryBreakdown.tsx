import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Banknote, Package, FileText, Car } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface CategoryData {
  name: string;
  total: number;
  received: number;
  overdue: number;
  icon: React.ElementType;
  color: string;
}

interface CategoryBreakdownProps {
  loans: { total: number; received: number; overdue: number };
  products: { total: number; received: number; overdue: number };
  contracts: { total: number; received: number; overdue: number };
  vehicles: { total: number; received: number; overdue: number };
}

export function CategoryBreakdown({ loans, products, contracts, vehicles }: CategoryBreakdownProps) {
  const categories: CategoryData[] = [
    { name: 'Empréstimos', ...loans, icon: Banknote, color: 'bg-primary' },
    { name: 'Produtos', ...products, icon: Package, color: 'bg-blue-500' },
    { name: 'Contratos', ...contracts, icon: FileText, color: 'bg-purple-500' },
    { name: 'Veículos', ...vehicles, icon: Car, color: 'bg-amber-500' },
  ].filter(cat => cat.total > 0);

  const grandTotal = categories.reduce((sum, cat) => sum + cat.total, 0);

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg">Distribuição por Categoria</CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0 space-y-3">
        {categories.map((category) => {
          const Icon = category.icon;
          const percentage = grandTotal > 0 ? (category.total / grandTotal) * 100 : 0;
          const receiptRate = category.total > 0 ? (category.received / category.total) * 100 : 0;

          return (
            <div key={category.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("p-1.5 rounded-lg", category.color, "bg-opacity-10")}>
                    <Icon className={cn("w-3 h-3 sm:w-4 sm:h-4", category.color.replace('bg-', 'text-'))} />
                  </div>
                  <span className="text-xs sm:text-sm font-medium">{category.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs sm:text-sm font-bold">{formatCurrency(category.total)}</p>
                  <p className="text-[10px] text-muted-foreground">{percentage.toFixed(0)}% do total</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Progress value={receiptRate} className="h-1.5 flex-1" />
                <span className="text-[10px] text-muted-foreground w-10 text-right">
                  {receiptRate.toFixed(0)}%
                </span>
              </div>

              <div className="flex gap-4 text-[10px] text-muted-foreground">
                <span>Recebido: <span className="text-emerald-500 font-medium">{formatCurrency(category.received)}</span></span>
                {category.overdue > 0 && (
                  <span>Atraso: <span className="text-destructive font-medium">{formatCurrency(category.overdue)}</span></span>
                )}
              </div>
            </div>
          );
        })}

        {categories.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-4">
            Nenhum dado disponível
          </p>
        )}
      </CardContent>
    </Card>
  );
}
