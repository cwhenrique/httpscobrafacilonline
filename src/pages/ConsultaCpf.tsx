import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, ExternalLink, Clock, FileText, Shield, Users } from 'lucide-react';

function FeatureItem({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-cyan-500/10">
      <Icon className="w-6 h-6 text-cyan-400" />
      <span className="text-sm text-cyan-100 text-center">{text}</span>
    </div>
  );
}

export default function ConsultaCpf() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Consultar CPF de Clientes</h1>
          <p className="text-muted-foreground">
            Encontre informações cadastrais de qualquer pessoa pelo CPF
          </p>
        </div>
        
        <Card className="bg-gradient-to-br from-cyan-950 to-gray-900 border-cyan-500/30">
          <CardContent className="p-8">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="p-4 rounded-full bg-cyan-500/20">
                <Search className="w-12 h-12 text-cyan-400" />
              </div>
              
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h2 className="text-3xl font-bold text-white">ConsultaFácil</h2>
                  <Badge className="bg-cyan-500 text-white">NOVO</Badge>
                </div>
                <p className="text-cyan-100 text-lg max-w-md">
                  Precisa encontrar uma pessoa? Consulte CPFs em segundos com dados cadastrais completos.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl">
                <FeatureItem icon={Clock} text="Menos de 2 segundos" />
                <FeatureItem icon={Users} text="Consulta em lote" />
                <FeatureItem icon={FileText} text="Exportação PDF" />
                <FeatureItem icon={Shield} text="Conformidade LGPD" />
              </div>

              <a 
                href="https://sign-and-search.lovable.app" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button size="lg" className="gap-2 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-lg px-8">
                  Acessar ConsultaFácil
                  <ExternalLink className="w-5 h-5" />
                </Button>
              </a>
              
              <p className="text-cyan-200/60 text-sm">
                +10.000 consultas realizadas
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
