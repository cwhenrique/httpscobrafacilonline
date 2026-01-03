import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface QuizOption {
  label: string;
  value: string;
  points: number;
  isEliminator?: boolean;
}

interface QuizQuestionProps {
  question: string;
  options: QuizOption[];
  onAnswer: (option: QuizOption) => void;
}

export function QuizQuestion({ question, options, onAnswer }: QuizQuestionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center">
        {question}
      </h2>
      
      <div className="space-y-3">
        {options.map((option, index) => (
          <motion.div
            key={option.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Button
              variant="outline"
              className="w-full py-6 px-4 text-left justify-start text-base md:text-lg hover:bg-primary hover:text-primary-foreground transition-all duration-200 h-auto whitespace-normal"
              onClick={() => onAnswer(option)}
            >
              {option.label}
            </Button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
