import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle, MessageCircle, Sparkles } from "lucide-react";

interface QuizAnswer {
  question: string;
  answer: string;
}

interface QuizResultQualifiedProps {
  score: number;
  answers: QuizAnswer[];
  isHot: boolean;
}

export function QuizResultQualified({ score, answers, isHot }: QuizResultQualifiedProps) {
  const whatsappNumber = "5511999999999"; // Substituir pelo número real
  
  const message = `Olá! Fiz o quiz de qualificação no site.

Meu perfil:
${answers.map(a => `• ${a.question}: ${a.answer}`).join('\n')}

Score: ${score} pontos - Lead ${isHot ? 'Quente 🔥' : 'Morno'}

Gostaria de saber mais sobre o CobraFacil!`;

  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

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
        <div className={`p-4 rounded-full ${isHot ? 'bg-green-500/20' : 'bg-blue-500/20'}`}>
          <CheckCircle className={`w-16 h-16 ${isHot ? 'text-green-500' : 'text-blue-500'}`} />
        </div>
      </motion.div>

      <div className="space-y-4">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          {isHot ? (
            <>Perfeito! <Sparkles className="inline w-8 h-8 text-yellow-500" /></>
          ) : (
            "Ótimo!"
          )}
        </h2>
        <h3 className="text-xl md:text-2xl font-semibold text-primary">
          {isHot 
            ? "O CobraFacil foi feito pra você!" 
            : "Podemos te ajudar!"
          }
        </h3>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          {isHot 
            ? "Você tem um negócio estruturado e precisa de uma ferramenta profissional. Vamos conversar agora!"
            : "Você está no caminho certo. Vamos entender melhor seu negócio e mostrar como o CobraFacil pode te ajudar."
          }
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 max-w-sm mx-auto">
        <p className="text-sm text-muted-foreground mb-2">Seu score de qualificação:</p>
        <p className="text-4xl font-bold text-primary">{score} pontos</p>
        <p className={`text-sm font-medium ${isHot ? 'text-green-500' : 'text-blue-500'}`}>
          Lead {isHot ? 'Quente 🔥' : 'Morno'}
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Button
          size="lg"
          className={`w-full max-w-sm py-6 text-lg ${
            isHot 
              ? 'bg-green-600 hover:bg-green-700' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
          onClick={() => window.open(whatsappUrl, '_blank')}
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          {isHot ? 'Falar com Especialista' : 'Quero saber mais'}
        </Button>
      </motion.div>

      <p className="text-xs text-muted-foreground">
        Você será redirecionado para o WhatsApp
      </p>
    </motion.div>
  );
}
