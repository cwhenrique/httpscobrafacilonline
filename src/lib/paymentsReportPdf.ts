import jsPDF from 'jspdf';
import cobraFacilLogo from '@/assets/cobrafacil-logo.png';
import { PaymentRecord } from '@/components/payments/PaymentsTable';

const PRIMARY_GREEN = { r: 34, g: 197, b: 94 };
const DARK_GREEN = { r: 22, g: 163, b: 74 };
const LIGHT_GREEN_BG = { r: 220, g: 252, b: 231 };
const WHITE = { r: 255, g: 255, b: 255 };
const DARK_TEXT = { r: 30, g: 30, b: 30 };
const MUTED_TEXT = { r: 100, g: 100, b: 100 };
const PURPLE = { r: 168, g: 85, b: 247 };

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR');
};

const loadLogoAsBase64 = (customLogoUrl?: string | null): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = () => {
      if (customLogoUrl && img.src !== cobraFacilLogo) {
        img.src = cobraFacilLogo;
      } else {
        reject(new Error('Could not load logo'));
      }
    };
    img.src = customLogoUrl || cobraFacilLogo;
  });
};

const getPaymentTypeLabel = (type: PaymentRecord['payment_type']): string => {
  switch (type) {
    case 'interest_only': return 'Só Juros';
    case 'partial_interest': return 'Juros Parcial';
    case 'amortization': return 'Amortização';
    case 'installment': return 'Parcela';
    case 'historical': return 'Juros Histórico';
    default: return 'Pagamento';
  }
};

export interface PaymentsReportOptions {
  payments: PaymentRecord[];
  periodLabel: string;
  summary: {
    totalReceived: number;
    totalInterest: number;
    totalPrincipal: number;
    count: number;
  };
  companyName?: string;
  customLogoUrl?: string | null;
}

export const generatePaymentsReport = async (options: PaymentsReportOptions): Promise<void> => {
  const { payments, periodLabel, summary, companyName, customLogoUrl } = options;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let currentY = 0;

  let logoBase64 = '';
  try {
    logoBase64 = await loadLogoAsBase64(customLogoUrl);
  } catch (e) {
    console.warn('Could not load logo:', e);
  }

  const drawHeader = () => {
    doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.rect(0, 0, pageWidth, 30, 'F');
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', margin, 3, 35, 22);
    }
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (companyName) {
      doc.text(companyName, pageWidth - margin, 12, { align: 'right' });
    }
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin, 20, { align: 'right' });
  };

  const checkNewPage = (neededSpace: number) => {
    if (currentY + neededSpace > pageHeight - 15) {
      doc.addPage();
      drawHeader();
      currentY = 38;
    }
  };

  // Page 1
  drawHeader();
  currentY = 38;

  // Title
  doc.setFillColor(LIGHT_GREEN_BG.r, LIGHT_GREEN_BG.g, LIGHT_GREEN_BG.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 14, 2, 2, 'F');
  doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`RELATÓRIO DE RECEBIMENTOS — ${periodLabel}`, pageWidth / 2, currentY + 9, { align: 'center' });
  currentY += 20;

  // Summary cards
  const cardW = (pageWidth - 2 * margin - 9) / 4;
  const cards = [
    { label: 'Total Recebido', value: formatCurrency(summary.totalReceived) },
    { label: 'Juros Recebido', value: formatCurrency(summary.totalInterest) },
    { label: 'Principal Pago', value: formatCurrency(summary.totalPrincipal) },
    { label: 'Qtd. Pagamentos', value: String(summary.count) },
  ];

  cards.forEach((card, i) => {
    const x = margin + i * (cardW + 3);
    doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, currentY, cardW, 18, 2, 2, 'S');
    doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(card.label, x + 4, currentY + 7);
    doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(card.value, x + 4, currentY + 14);
  });
  currentY += 24;

  if (payments.length === 0) {
    doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Nenhum pagamento registrado neste período.', pageWidth / 2, currentY + 15, { align: 'center' });
    doc.save(`recebimentos-${periodLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    return;
  }

  // Table header
  const colX = {
    date: margin + 2,
    client: margin + 28,
    installment: margin + 90,
    type: margin + 120,
    amount: pageWidth - margin - 2,
  };

  const drawTableHeader = () => {
    doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.rect(margin, currentY, pageWidth - 2 * margin, 8, 'F');
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Data', colX.date, currentY + 5.5);
    doc.text('Cliente', colX.client, currentY + 5.5);
    doc.text('Parcela', colX.installment, currentY + 5.5);
    doc.text('Tipo', colX.type, currentY + 5.5);
    doc.text('Valor', colX.amount, currentY + 5.5, { align: 'right' });
    currentY += 10;
  };

  drawTableHeader();

  // Table rows
  payments.forEach((payment, index) => {
    checkNewPage(10);
    if (currentY <= 40) drawTableHeader();

    // Alternating bg
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, currentY - 1, pageWidth - 2 * margin, 8, 'F');
    }

    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    // Date
    doc.text(formatDateBR(payment.payment_date), colX.date, currentY + 4.5);

    // Client name (truncate)
    const clientName = payment.client_name.length > 28 ? payment.client_name.substring(0, 26) + '…' : payment.client_name;
    doc.text(clientName, colX.client, currentY + 4.5);

    // Installment info
    const installmentMatch = (payment.notes || '').match(/Parcela (\d+ de \d+)/);
    const installmentText = installmentMatch ? installmentMatch[1] : '-';
    doc.text(installmentText, colX.installment, currentY + 4.5);

    // Type - highlight interest-only in purple
    const typeLabel = getPaymentTypeLabel(payment.payment_type);
    if (payment.payment_type === 'interest_only' || payment.payment_type === 'partial_interest' || payment.payment_type === 'historical') {
      doc.setTextColor(PURPLE.r, PURPLE.g, PURPLE.b);
      doc.setFont('helvetica', 'bold');
    }
    doc.text(typeLabel, colX.type, currentY + 4.5);
    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFont('helvetica', 'normal');

    // Amount
    doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(payment.amount), colX.amount, currentY + 4.5, { align: 'right' });

    currentY += 8;
  });

  // Footer line
  checkNewPage(12);
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 5;
  doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${formatCurrency(summary.totalReceived)} em ${summary.count} pagamento(s)`, pageWidth - margin, currentY + 3, { align: 'right' });

  doc.save(`recebimentos-${periodLabel.replace(/[\s/]+/g, '-').toLowerCase()}.pdf`);
};
