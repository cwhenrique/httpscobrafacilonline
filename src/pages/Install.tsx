import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Share, Plus, MoreVertical, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import cobrafacilLogo from "@/assets/cobrafacil-logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

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
          <Link to="/" className="flex items-center gap-2">
            <img src={cobrafacilLogo} alt="CobraFácil" className="h-8 w-auto" />
            <span className="font-bold text-xl text-foreground">CobraFácil</span>
          </Link>
          <Link to="/auth">
            <Button variant="outline" size="sm">Entrar</Button>
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
                <Card className="border-primary/50">
                  <CardContent className="py-6">
                    <Button
                      onClick={handleInstallClick}
                      size="lg"
                      className="w-full text-lg py-6"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Instalar Agora
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* iOS Instructions */}
              {isIOS && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Share className="w-5 h-5" />
                      Instruções para iPhone/iPad
                    </CardTitle>
                    <CardDescription>
                      Siga os passos abaixo para instalar o app
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        1
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Toque no botão Compartilhar</p>
                        <p className="text-sm text-muted-foreground">
                          Na barra inferior do Safari, toque no ícone <Share className="inline w-4 h-4" />
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        2
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Selecione "Adicionar à Tela de Início"</p>
                        <p className="text-sm text-muted-foreground">
                          Role para baixo e toque em <Plus className="inline w-4 h-4" /> Adicionar à Tela de Início
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        3
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Confirme a instalação</p>
                        <p className="text-sm text-muted-foreground">
                          Toque em "Adicionar" no canto superior direito
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Android Instructions */}
              {!isIOS && !deferredPrompt && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MoreVertical className="w-5 h-5" />
                      Instruções para Android
                    </CardTitle>
                    <CardDescription>
                      Siga os passos abaixo para instalar o app
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        1
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Abra o menu do navegador</p>
                        <p className="text-sm text-muted-foreground">
                          Toque nos três pontos <MoreVertical className="inline w-4 h-4" /> no canto superior
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        2
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Selecione "Instalar aplicativo"</p>
                        <p className="text-sm text-muted-foreground">
                          Ou "Adicionar à tela inicial"
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        3
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Confirme a instalação</p>
                        <p className="text-sm text-muted-foreground">
                          Toque em "Instalar" para confirmar
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
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
                  <span className="text-foreground">Carregamento ultra-rápido</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Ainda não tem conta?
            </p>
            <Link to="/auth">
              <Button size="lg">
                Criar Conta Grátis
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Install;
