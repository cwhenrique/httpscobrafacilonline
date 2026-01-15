import DashboardLayout from '@/components/layout/DashboardLayout';

export default function ConsultaCpf() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Consultar CPF de Clientes</h1>
          <p className="text-muted-foreground">
            Encontre informações cadastrais de qualquer pessoa pelo CPF
          </p>
        </div>
        
        <div className="w-full h-[calc(100vh-200px)] rounded-xl overflow-hidden border border-border">
          <iframe
            src="https://sign-and-search.lovable.app"
            title="ConsultaFácil - Consulta de CPF"
            className="w-full h-full"
            allow="clipboard-write"
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
