import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';

interface LoansTutorialProps {
  run: boolean;
  onFinish: () => void;
}

const TUTORIAL_STEPS: Step[] = [
  {
    target: '.tutorial-new-loan',
    content: 'Clique aqui para criar um novo empréstimo. Você pode escolher entre empréstimo parcelado, pagamento único ou semanal.',
    title: '🆕 Novo Empréstimo',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '.tutorial-new-daily',
    content: 'Para cobranças diárias, use este botão. Ideal para empréstimos com parcelas pagas todos os dias.',
    title: '📅 Empréstimo Diário',
    placement: 'bottom',
  },
  {
    target: '.tutorial-download-report',
    content: 'Baixe um relatório PDF completo com todos os seus empréstimos, pagamentos e estatísticas.',
    title: '📊 Relatório',
    placement: 'bottom',
  },
  {
    target: '.tutorial-search',
    content: 'Pesquise rapidamente por nome do cliente ou valor para encontrar empréstimos específicos.',
    title: '🔍 Buscar',
    placement: 'bottom',
  },
  {
    target: '.tutorial-filters',
    content: 'Filtre os empréstimos por status: todos, em dia, pagos, em atraso, renegociados, só juros, semanal ou diário.',
    title: '📋 Filtros',
    placement: 'bottom',
  },
  {
    target: '.tutorial-loan-card',
    content: 'Cada empréstimo aparece como um card com informações do cliente, valor emprestado, parcelas, juros e status. Clique na foto para alterar o avatar do cliente.',
    title: '💳 Card do Empréstimo',
    placement: 'top',
  },
  {
    target: '.tutorial-loan-payment',
    content: 'Clique em "Pagar" para registrar um pagamento. Você pode pagar parcelas individuais, múltiplas parcelas ou valores parciais.',
    title: '💰 Registrar Pagamento',
    placement: 'top',
  },
  {
    target: '.tutorial-loan-interest',
    content: 'Use "Pagar Juros" quando o cliente paga apenas os juros da parcela ou para aplicar taxas extras em parcelas específicas.',
    title: '💵 Pagamento de Juros',
    placement: 'top',
  },
  {
    target: '.tutorial-loan-edit',
    content: 'Edite os detalhes do empréstimo como valores, datas e observações.',
    title: '✏️ Editar',
    placement: 'top',
  },
  {
    target: '.tutorial-loan-receipt',
    content: 'Gere comprovantes em PDF e envie via WhatsApp para registro. Útil para confirmar pagamentos com clientes.',
    title: '📄 Comprovante',
    placement: 'left',
  },
];

export default function LoansTutorial({ run, onFinish }: LoansTutorialProps) {
  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      onFinish();
    }
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={TUTORIAL_STEPS}
      locale={{
        back: 'Voltar',
        close: 'Fechar',
        last: 'Finalizar',
        next: 'Próximo',
        open: 'Abrir',
        skip: 'Pular Tutorial',
      }}
      styles={{
        options: {
          primaryColor: '#22c55e',
          backgroundColor: '#1e293b',
          textColor: '#f8fafc',
          arrowColor: '#1e293b',
          overlayColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 12,
          padding: 16,
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        tooltipTitle: {
          fontSize: 16,
          fontWeight: 600,
          marginBottom: 8,
        },
        tooltipContent: {
          fontSize: 14,
          lineHeight: 1.5,
        },
        buttonNext: {
          backgroundColor: '#22c55e',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 500,
        },
        buttonBack: {
          color: '#94a3b8',
          marginRight: 8,
          fontSize: 14,
        },
        buttonSkip: {
          color: '#64748b',
          fontSize: 13,
        },
        spotlight: {
          borderRadius: 12,
        },
      }}
    />
  );
}
