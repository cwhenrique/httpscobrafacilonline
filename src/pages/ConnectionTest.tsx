import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, Wifi, WifiOff, RefreshCw, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface TestResult {
  name: string;
  status: "pending" | "success" | "error";
  message: string;
  duration?: number;
}

const ConnectionTest = () => {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [overallStatus, setOverallStatus] = useState<"idle" | "running" | "success" | "partial" | "error">("idle");

  const updateTest = (name: string, update: Partial<TestResult>) => {
    setTests(prev => prev.map(t => t.name === name ? { ...t, ...update } : t));
  };

  const runTests = async () => {
    setIsRunning(true);
    setOverallStatus("running");
    
    const initialTests: TestResult[] = [
      { name: "Conexão com Internet", status: "pending", message: "Verificando..." },
      { name: "DNS Resolution", status: "pending", message: "Verificando..." },
      { name: "Banco de Dados", status: "pending", message: "Verificando..." },
      { name: "Autenticação", status: "pending", message: "Verificando..." },
    ];
    setTests(initialTests);

    // Test 1: Basic internet connectivity
    const internetStart = Date.now();
    try {
      const response = await fetch("https://www.google.com/favicon.ico", { 
        mode: "no-cors",
        cache: "no-store"
      });
      updateTest("Conexão com Internet", { 
        status: "success", 
        message: "Conectado à internet",
        duration: Date.now() - internetStart
      });
    } catch {
      updateTest("Conexão com Internet", { 
        status: "error", 
        message: "Sem conexão com a internet",
        duration: Date.now() - internetStart
      });
    }

    // Test 2: DNS resolution for Supabase
    const dnsStart = Date.now();
    try {
      const response = await fetch("https://yulegybknvtanqkipsbj.supabase.co/rest/v1/", { 
        method: "HEAD",
        headers: {
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1bGVneWJrbnZ0YW5xa2lwc2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NzE4MDEsImV4cCI6MjA4MDM0NzgwMX0.q7IbfI0rF5yuI8NpTHTNbVzcypFVOxavfo0VZLjJdyc"
        }
      });
      updateTest("DNS Resolution", { 
        status: "success", 
        message: "Servidor encontrado",
        duration: Date.now() - dnsStart
      });
    } catch {
      updateTest("DNS Resolution", { 
        status: "error", 
        message: "Não foi possível resolver o DNS do servidor. Tente trocar o DNS para 8.8.8.8 (Google) ou 1.1.1.1 (Cloudflare)",
        duration: Date.now() - dnsStart
      });
    }

    // Test 3: Database connection
    const dbStart = Date.now();
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      if (error) throw error;
      updateTest("Banco de Dados", { 
        status: "success", 
        message: "Conexão com banco de dados OK",
        duration: Date.now() - dbStart
      });
    } catch (err: any) {
      updateTest("Banco de Dados", { 
        status: "error", 
        message: err?.message || "Falha na conexão com banco de dados",
        duration: Date.now() - dbStart
      });
    }

    // Test 4: Auth service
    const authStart = Date.now();
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      updateTest("Autenticação", { 
        status: "success", 
        message: data.session ? "Autenticado" : "Serviço de autenticação OK",
        duration: Date.now() - authStart
      });
    } catch (err: any) {
      updateTest("Autenticação", { 
        status: "error", 
        message: err?.message || "Falha no serviço de autenticação",
        duration: Date.now() - authStart
      });
    }

    // Calculate overall status
    setTimeout(() => {
      setTests(prev => {
        const successCount = prev.filter(t => t.status === "success").length;
        const errorCount = prev.filter(t => t.status === "error").length;
        
        if (errorCount === 0) {
          setOverallStatus("success");
        } else if (successCount > 0) {
          setOverallStatus("partial");
        } else {
          setOverallStatus("error");
        }
        
        return prev;
      });
      setIsRunning(false);
    }, 500);
  };

  useEffect(() => {
    runTests();
  }, []);

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "pending":
        return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getOverallIcon = () => {
    switch (overallStatus) {
      case "idle":
      case "running":
        return <Loader2 className="h-12 w-12 animate-spin text-primary" />;
      case "success":
        return <Wifi className="h-12 w-12 text-green-500" />;
      case "partial":
        return <Wifi className="h-12 w-12 text-yellow-500" />;
      case "error":
        return <WifiOff className="h-12 w-12 text-destructive" />;
    }
  };

  const getOverallMessage = () => {
    switch (overallStatus) {
      case "idle":
        return "Preparando testes...";
      case "running":
        return "Executando testes de conexão...";
      case "success":
        return "Todos os testes passaram! Sua conexão está funcionando normalmente.";
      case "partial":
        return "Alguns testes falharam. Veja os detalhes abaixo.";
      case "error":
        return "Não foi possível conectar. Verifique sua rede.";
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getOverallIcon()}
          </div>
          <CardTitle className="text-xl">Teste de Conexão</CardTitle>
          <CardDescription>{getOverallMessage()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tests.map((test) => (
            <div 
              key={test.name} 
              className="flex items-start justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(test.status)}
                <div>
                  <p className="font-medium text-sm">{test.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{test.message}</p>
                </div>
              </div>
              {test.duration !== undefined && (
                <Badge variant="outline" className="text-xs">
                  {test.duration}ms
                </Badge>
              )}
            </div>
          ))}

          {overallStatus !== "success" && overallStatus !== "running" && (
            <div className="mt-6 p-4 rounded-lg bg-muted/50 text-sm space-y-2">
              <p className="font-medium">Possíveis soluções:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                <li>Reinicie seu roteador/modem</li>
                <li>Troque o DNS para Google (8.8.8.8) ou Cloudflare (1.1.1.1)</li>
                <li>Desative temporariamente VPN ou firewall</li>
                <li>Tente acessar usando dados móveis (4G/5G)</li>
                <li>Limpe o cache do navegador</li>
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={runTests} 
              disabled={isRunning}
              className="flex-1"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Testar Novamente
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConnectionTest;
