import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface QuizResultDisqualifiedProps {
  reason: 'low_score' | 'no_investment';
}

export function QuizResultDisqualified({ reason }: QuizResultDisqualifiedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="text-center space-y-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="flex justify-center"
      >
        <div className="p-4 rounded-full bg-muted">
          <XCircle className="w-16 h-16 text-muted-foreground" />
        </div>
      </motion.div>

      <div className="space-y-4">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          Hmm... Talvez não seja o momento certo
        </h2>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          {reason === 'no_investment' 
            ? "O CobraFacil é um investimento para quem está pronto para levar seu negócio a sério. Quando tiver disponibilidade, estaremos aqui!"
            : "Parece que você ainda está no início da jornada. O CobraFacil é ideal para quem já tem um fluxo de clientes e precisa de organização."
          }
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg p-6 max-w-sm mx-auto space-y-4">
        <h3 className="font-semibold text-foreground">Enquanto isso, você pode:</h3>
        <ul className="text-sm text-muted-foreground text-left space-y-2">
          <li>✓ Usar nosso simulador gratuito</li>
          <li>✓ Conhecer mais sobre o CobraFacil</li>
          <li>✓ Voltar quando estiver pronto</li>
        </ul>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="space-y-3"
      >
        <Link to="/">
          <Button variant="outline" size="lg" className="w-full max-w-sm py-6 text-lg">
            Conhecer o CobraFacil
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </Link>
        
        <Link to="/simulador">
          <Button variant="ghost" size="lg" className="w-full max-w-sm">
            Usar Simulador Gratuito
          </Button>
        </Link>
      </motion.div>
    </motion.div>
  );
}
