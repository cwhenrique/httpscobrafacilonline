import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';

interface LoansTutorialProps {
  run: boolean;
  onFinish: () => void;
  onExit: () => void;
  stepIndex: number;
  onStepChange: (index: number) => void;
}

// Demonstrative tutorial - user just clicks "Next" to see each field explained
const TUTORIAL_STEPS: Step[] = [
  // Step 0: New Loan button
  {
    target: '.tutorial-new-loan',
    content: 'Este botão abre o formulário para criar um novo empréstimo parcelado, semanal ou pagamento único.',
    title: '➕ Novo Empréstimo',
    placement: 'bottom',
    disableBeacon: true,
  },
  // Step 1: New Daily button
  {
    target: '.tutorial-new-daily',
    content: 'Botão específico para criar empréstimos com cobrança diária. Você escolhe as datas de cobrança manualmente.',
    title: '📅 Novo Diário',
    placement: 'bottom',
    disableBeacon: true,
  },
  // Step 2: Search field
  {
    target: '.tutorial-search',
    content: 'Campo de busca para encontrar empréstimos pelo nome do cliente ou valor.',
    title: '🔍 Buscar Empréstimos',
    placement: 'bottom',
    disableBeacon: true,
  },
  // Step 3: Filters
  {
    target: '.tutorial-filters',
    content: 'Filtre empréstimos por status: Em Dia, Pagos, Em Atraso, Renegociados, etc.',
    title: '🏷️ Filtros de Status',
    placement: 'bottom',
    disableBeacon: true,
  },
  // Step 4: Client select (dialog opens automatically)
  {
    target: '.tutorial-client-select',
    content: 'Selecione um cliente já cadastrado no sistema para vincular ao empréstimo.',
    title: '👤 Selecionar Cliente',
    placement: 'right',
    disableBeacon: true,
  },
  // Step 5: New client button
  {
    target: '.tutorial-new-client-btn',
    content: 'Se o cliente não existir, clique aqui para cadastrar um novo cliente sem sair do formulário.',
    title: '➕ Cadastrar Novo Cliente',
    placement: 'right',
    disableBeacon: true,
  },
  // Step 6: Loan value
  {
    target: '.tutorial-form-value',
    content: 'Digite o valor principal que será emprestado ao cliente (sem juros).',
    title: '💰 Valor do Empréstimo',
    placement: 'right',
    disableBeacon: true,
  },
  // Step 7: Interest rate
  {
    target: '.tutorial-form-interest',
    content: 'Defina a taxa de juros em percentual. Exemplo: 10% ao mês.',
    title: '📊 Taxa de Juros',
    placement: 'right',
    disableBeacon: true,
  },
  // Step 8: Interest mode
  {
    target: '.tutorial-form-interest-mode',
    content: 'Por Parcela: juros multiplicado pelo número de parcelas. Sobre o Total: juros aplicado uma única vez.',
    title: '⚙️ Modo de Juros',
    placement: 'right',
    disableBeacon: true,
  },
  // Step 9: Payment type
  {
    target: '.tutorial-form-payment-type',
    content: 'Escolha a modalidade: Parcelado (várias parcelas), Semanal, ou Pagamento Único.',
    title: '💳 Modalidade de Pagamento',
    placement: 'right',
    disableBeacon: true,
  },
  // Step 10: Dates
  {
    target: '.tutorial-form-dates',
    content: 'Defina a data de início do empréstimo. O vencimento é calculado automaticamente.',
    title: '📅 Datas do Contrato',
    placement: 'right',
    disableBeacon: true,
  },
  // Step 11: Notes
  {
    target: '.tutorial-form-notes',
    content: 'Adicione observações opcionais sobre o empréstimo ou acordos especiais.',
    title: '📝 Observações',
    placement: 'top',
    disableBeacon: true,
  },
  // Step 12: Submit button
  {
    target: '.tutorial-form-submit',
    content: 'Quando tudo estiver preenchido, clique aqui para salvar o empréstimo no sistema.',
    title: '✅ Criar Empréstimo',
    placement: 'top',
    disableBeacon: true,
  },
  // Step 13: Final summary (back to main page)
  {
    target: '.tutorial-new-loan',
    content: 'Parabéns! Você conheceu todas as funcionalidades básicas da página de empréstimos. Agora você pode começar a gerenciar seus empréstimos!',
    title: '🎉 Tutorial Concluído!',
    placement: 'bottom',
    disableBeacon: true,
  },
];

export default function LoansTutorial({ run, onFinish, onExit, stepIndex, onStepChange }: LoansTutorialProps) {
  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index, type } = data;
    
    // Block skip/close attempts
    if (action === ACTIONS.SKIP || action === ACTIONS.CLOSE) {
      return;
    }

    if (status === STATUS.FINISHED) {
      onFinish();
      return;
    }

    // Handle navigation
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        onStepChange(index + 1);
      } else if (action === ACTIONS.PREV) {
        onStepChange(Math.max(0, index - 1));
      }
    }
  };

  if (!run) return null;

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      stepIndex={stepIndex}
      scrollToFirstStep
      showProgress
      showSkipButton={false}
      steps={TUTORIAL_STEPS}
      disableOverlayClose
      disableCloseOnEsc
      spotlightClicks={false}
      floaterProps={{
        disableAnimation: true,
        offset: 15,
      }}
      spotlightPadding={8}
      locale={{
        back: '← Voltar',
        close: 'Fechar',
        last: '🎉 Finalizar Tutorial',
        next: 'Próxima Etapa →',
        open: 'Abrir',
        skip: '',
      }}
      styles={{
        options: {
          primaryColor: '#22c55e',
          backgroundColor: '#1e293b',
          textColor: '#f8fafc',
          arrowColor: '#1e293b',
          overlayColor: 'rgba(0, 0, 0, 0.85)',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 12,
          padding: 20,
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        tooltipTitle: {
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 10,
        },
        tooltipContent: {
          fontSize: 15,
          lineHeight: 1.6,
        },
        buttonNext: {
          backgroundColor: '#22c55e',
          borderRadius: 8,
          padding: '10px 20px',
          fontSize: 14,
          fontWeight: 500,
        },
        buttonBack: {
          color: '#94a3b8',
          marginRight: 10,
          fontSize: 14,
        },
        spotlight: {
          borderRadius: 12,
        },
      }}
    />
  );
}
