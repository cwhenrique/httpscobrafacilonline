import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Smartphone, Share, Plus, MoreVertical, CheckCircle2, ArrowLeft, TabletSmartphone, Globe, AlertTriangle, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import cobrafacilLogo from "@/assets/cobrafacil-logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Detect device/browser type
const detectEnvironment = () => {
  const ua = navigator.userAgent;
  
  return {
    isIOS: /iPad|iPhone|iPod/.test(ua),
    isXiaomi: /Xiaomi|MIUI|Redmi|POCO/i.test(ua),
    isSamsungBrowser: /SamsungBrowser/i.test(ua),
    isFirefox: /Firefox/i.test(ua) && !/Seamonkey/i.test(ua),
    isWebView: /Instagram|FBAN|FBAV|WhatsApp|Line|Snapchat|Twitter|wv\)/i.test(ua),
    isChrome: /Chrome/i.test(ua) && !/Edge|Edg|OPR|Opera|SamsungBrowser/i.test(ua),
  };
};

const getDefaultTab = (env: ReturnType<typeof detectEnvironment>) => {
  if (env.isIOS) return "ios";
  if (env.isXiaomi) return "xiaomi";
  if (env.isSamsungBrowser) return "samsung";
  if (env.isFirefox) return "firefox";
  return "android";
};

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [environment, setEnvironment] = useState(detectEnvironment());
  const [defaultTab, setDefaultTab] = useState("android");

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect environment
    const env = detectEnvironment();
    setEnvironment(env);
    setDefaultTab(getDefaultTab(env));

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed event
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src={cobrafacilLogo} alt="CobraFácil" className="h-8 w-auto" />
            <span className="font-bold text-xl text-foreground">CobraFácil</span>
          </Link>
          <Link to="/dashboard">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Hero */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4">
              <Smartphone className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Instale o CobraFácil
            </h1>
            <p className="text-lg text-muted-foreground">
              Tenha acesso rápido ao app direto da tela inicial do seu celular
            </p>
          </div>

          {/* WebView Warning */}
          {environment.isWebView && (
            <Card className="border-orange-500/50 bg-orange-500/10">
              <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-6">
                <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-orange-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-foreground">Navegador não compatível</h3>
                  <p className="text-muted-foreground mt-1">
                    Você está usando um navegador interno (WhatsApp, Instagram, Facebook). 
                    Para instalar o app, siga estes passos:
                  </p>
                  <ol className="list-decimal list-inside mt-3 space-y-2 text-sm text-muted-foreground">
                    <li>Toque nos <strong className="text-foreground">três pontos ⋮</strong> no canto superior</li>
                    <li>Selecione <strong className="text-foreground">"Abrir no Chrome"</strong> ou <strong className="text-foreground">"Abrir no navegador"</strong></li>
                    <li>Depois siga as instruções abaixo para instalar</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status Card */}
          {isInstalled ? (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="flex items-center gap-4 py-6">
                <CheckCircle2 className="w-12 h-12 text-primary" />
                <div>
                  <h3 className="font-semibold text-lg text-foreground">App já instalado!</h3>
                  <p className="text-muted-foreground">
                    O CobraFácil está na sua tela inicial. Aproveite!
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Install Button (Android/Desktop) */}
              {deferredPrompt && (
                <Card className="border-primary/50 bg-primary/5">
                  <CardContent className="py-6">
                    <Button
                      onClick={handleInstallClick}
                      size="lg"
                      className="w-full text-lg py-6"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Instalar Agora
                    </Button>
                    <p className="text-center text-sm text-muted-foreground mt-3">
                      Clique no botão acima para instalar instantaneamente
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Instructions Tabs */}
              <Card>
                <CardHeader>
                  <CardTitle>Como instalar no celular</CardTitle>
                  <CardDescription>
                    Selecione seu dispositivo e siga as instruções
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue={defaultTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6 h-auto">
                      <TabsTrigger value="ios" className="gap-1 text-xs sm:text-sm py-2">
                        <TabletSmartphone className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">iPhone/iPad</span>
                        <span className="sm:hidden">iOS</span>
                      </TabsTrigger>
                      <TabsTrigger value="android" className="gap-1 text-xs sm:text-sm py-2">
                        <Globe className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Android</span>
                        <span className="sm:hidden">Android</span>
                      </TabsTrigger>
                      <TabsTrigger value="xiaomi" className="gap-1 text-xs sm:text-sm py-2">
                        <Smartphone className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Xiaomi/Redmi</span>
                        <span className="sm:hidden">Xiaomi</span>
                      </TabsTrigger>
                      <TabsTrigger value="samsung" className="gap-1 text-xs sm:text-sm py-2">
                        <Smartphone className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Samsung</span>
                        <span className="sm:hidden">Samsung</span>
                      </TabsTrigger>
                    </TabsList>

                    {/* iOS Instructions */}
                    <TabsContent value="ios" className="space-y-6">
                      <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong className="text-foreground">Importante:</strong> Use o navegador <strong className="text-foreground">Safari</strong> para instalar no iPhone/iPad.
                        </p>
                      </div>

                      {/* Step 1 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                            1
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Toque no botão Compartilhar
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Na barra inferior do Safari, procure o ícone de compartilhar (um quadrado com uma seta para cima).
                          </p>
                          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Share className="w-6 h-6 text-primary" />
                              </div>
                              <span className="text-xs text-muted-foreground">Compartilhar</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                            2
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Selecione "Adicionar à Tela de Início"
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Role as opções para baixo até encontrar "Adicionar à Tela de Início" com o ícone de +.
                          </p>
                          <div className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                <Plus className="w-5 h-5 text-foreground" />
                              </div>
                              <span className="text-foreground font-medium">Adicionar à Tela de Início</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                            3
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Confirme tocando em "Adicionar"
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Uma tela de confirmação aparecerá. Toque em "Adicionar" no canto superior direito.
                          </p>
                          <div className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <span className="text-muted-foreground">Cancelar</span>
                              <span className="text-primary font-semibold">Adicionar</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center text-success-foreground">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Pronto! App instalado
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            O ícone do CobraFácil aparecerá na sua tela inicial. Toque nele para abrir o app!
                          </p>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Android Instructions */}
                    <TabsContent value="android" className="space-y-6">
                      <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                        <p className="text-sm text-muted-foreground">
                          <strong className="text-foreground">Dica:</strong> Use o navegador <strong className="text-foreground">Chrome</strong> para a melhor experiência no Android.
                        </p>
                      </div>

                      {/* Step 1 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                            1
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Abra o menu do navegador
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Toque nos três pontos verticais no canto superior direito do Chrome.
                          </p>
                          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                <MoreVertical className="w-6 h-6 text-primary" />
                              </div>
                              <span className="text-xs text-muted-foreground">Menu</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                            2
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Toque em "Instalar aplicativo"
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            No menu, procure a opção "Instalar aplicativo" ou "Adicionar à tela inicial".
                          </p>
                          <div className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                              <Download className="w-5 h-5 text-foreground" />
                              <span className="text-foreground font-medium">Instalar aplicativo</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                            3
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Confirme a instalação
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Uma janela de confirmação aparecerá. Toque em "Instalar" para finalizar.
                          </p>
                          <div className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-center justify-end gap-4 p-3 bg-muted/50 rounded-lg">
                              <span className="text-muted-foreground">Cancelar</span>
                              <span className="text-primary font-semibold">Instalar</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center text-success-foreground">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Pronto! App instalado
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            O ícone do CobraFácil aparecerá na sua tela inicial e na gaveta de apps!
                          </p>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Xiaomi/MIUI Instructions */}
                    <TabsContent value="xiaomi" className="space-y-6">
                      <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/30">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-foreground mb-1">
                              Atenção: Xiaomi/MIUI requer passos especiais
                            </p>
                            <p className="text-sm text-muted-foreground">
                              O navegador Mi Browser não suporta instalação de apps. Use o <strong className="text-foreground">Chrome</strong> para instalar.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Step 0 - Use Chrome */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold">
                            0
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Abra este site no Chrome
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Se você está no Mi Browser, toque nos <strong className="text-foreground">três pontos ⋮</strong> e selecione <strong className="text-foreground">"Abrir no Chrome"</strong> ou <strong className="text-foreground">"Abrir em outro app"</strong>.
                          </p>
                          <div className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                              <ExternalLink className="w-5 h-5 text-foreground" />
                              <span className="text-foreground font-medium">Abrir no Chrome</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 1 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                            1
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            No Chrome, abra o menu
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Toque nos <strong className="text-foreground">três pontos ⋮</strong> no canto superior direito.
                          </p>
                          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                <MoreVertical className="w-6 h-6 text-primary" />
                              </div>
                              <span className="text-xs text-muted-foreground">Menu Chrome</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                            2
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Procure "Instalar" ou "Adicionar à tela inicial"
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Role o menu e procure uma destas opções:
                          </p>
                          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                              <Download className="w-5 h-5 text-foreground" />
                              <span className="text-foreground font-medium">Instalar aplicativo</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                              <Plus className="w-5 h-5 text-foreground" />
                              <span className="text-foreground font-medium">Adicionar à tela inicial</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Alternative Step */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold">
                            ?
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Opção não aparece?
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Em alguns modelos Xiaomi, a opção pode estar oculta. Tente:
                          </p>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                            <li>Menu ⋮ → <strong className="text-foreground">"Adicionar ao..."</strong> → <strong className="text-foreground">"Tela inicial"</strong></li>
                            <li>Ou menu ⋮ → <strong className="text-foreground">"Criar atalho"</strong> → Marque <strong className="text-foreground">"Abrir como janela"</strong></li>
                            <li>Feche o Chrome e abra novamente para tentar de novo</li>
                          </ul>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center text-success-foreground">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Pronto! App instalado
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            O ícone do CobraFácil aparecerá na sua tela inicial!
                          </p>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Samsung Browser Instructions */}
                    <TabsContent value="samsung" className="space-y-6">
                      <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                        <p className="text-sm text-muted-foreground">
                          <strong className="text-foreground">Samsung Internet:</strong> Siga os passos abaixo para instalar pelo Samsung Browser. Você também pode usar o <strong className="text-foreground">Chrome</strong> se preferir.
                        </p>
                      </div>

                      {/* Step 1 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                            1
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Abra o menu do navegador
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            No Samsung Internet, toque no ícone de <strong className="text-foreground">menu ☰</strong> na parte inferior da tela (3 linhas horizontais).
                          </p>
                          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                <span className="text-2xl text-primary">☰</span>
                              </div>
                              <span className="text-xs text-muted-foreground">Menu Samsung</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                            2
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Toque em "Adicionar página a"
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            No menu, procure a opção <strong className="text-foreground">"Adicionar página a"</strong> ou <strong className="text-foreground">"Instalar"</strong>.
                          </p>
                          <div className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                              <Plus className="w-5 h-5 text-foreground" />
                              <span className="text-foreground font-medium">Adicionar página a...</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                            3
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Selecione "Tela inicial"
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Escolha a opção <strong className="text-foreground">"Tela inicial"</strong> para adicionar o atalho.
                          </p>
                          <div className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                              <Smartphone className="w-5 h-5 text-foreground" />
                              <span className="text-foreground font-medium">Tela inicial</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center text-success-foreground">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground mb-2">
                            Pronto! App instalado
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            O ícone do CobraFácil aparecerá na sua tela inicial!
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}

          {/* Benefits */}
          <Card>
            <CardHeader>
              <CardTitle>Vantagens do App Instalado</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-foreground">Acesso rápido direto da tela inicial</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-foreground">Funciona mesmo com internet instável</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-foreground">Experiência em tela cheia como app nativo</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-foreground">Receba lembretes de cobranças</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-foreground">Sem precisar baixar da loja de apps</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Back to Dashboard */}
          <div className="text-center">
            <Link to="/dashboard">
              <Button variant="outline" size="lg" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Voltar ao Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Install;
