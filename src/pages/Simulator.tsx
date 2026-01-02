import DashboardLayout from '@/components/layout/DashboardLayout';
import { LoanSimulator } from '@/components/LoanSimulator';

export default function Simulator() {
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Simulador de Empréstimo</h1>
          <p className="text-muted-foreground">Simule empréstimos antes de criar</p>
        </div>

        <LoanSimulator />
      </div>
    </DashboardLayout>
  );
}