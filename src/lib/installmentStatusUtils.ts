/**
 * Utility functions for generating installment status lists with emojis
 * Used in WhatsApp notification messages
 */

export interface InstallmentStatusInfo {
  installmentDates: string[];
  paidCount: number;
  totalInstallments: number;
}

/**
 * Generates a formatted list of installment statuses with emojis
 * ✅ Paid, 🔴 Overdue, ⏳ Open
 * 
 * @param info - Object containing installment dates, paid count, and total installments
 * @returns Formatted string with installment statuses or empty string if no dates
 */
export const generateInstallmentsStatusList = (info: InstallmentStatusInfo): string => {
  const { installmentDates, paidCount, totalInstallments } = info;
  
  if (!installmentDates || installmentDates.length === 0 || totalInstallments === 0) {
    return '';
  }
  
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  
  let list = `\n📊 *STATUS DAS PARCELAS:*\n`;
  
  const count = Math.min(installmentDates.length, totalInstallments);
  
  for (let i = 0; i < count; i++) {
    const dateStr = installmentDates[i];
    if (!dateStr) continue;
    
    const dueDate = new Date(dateStr + 'T12:00:00');
    const formattedDate = dueDate.toLocaleDateString('pt-BR');
    const num = i + 1;
    
    let emoji: string;
    let status: string;
    
    if (i < paidCount) {
      emoji = '✅';
      status = 'Paga';
    } else if (dueDate < today) {
      emoji = '🔴';
      status = 'Em Atraso';
    } else {
      emoji = '⏳';
      status = 'Em Aberto';
    }
    
    // Use number emoji if available (1-9), otherwise use plain number
    const numDisplay = num <= 9 ? `${num}️⃣` : `${num}.`;
    
    list += `${numDisplay} ${emoji} ${formattedDate} - ${status}\n`;
  }
  
  return list;
};

/**
 * Generates a compact list showing only relevant installments
 * (paid + next few upcoming)
 */
export const generateCompactInstallmentsStatusList = (
  info: InstallmentStatusInfo,
  maxToShow: number = 6
): string => {
  const { installmentDates, paidCount, totalInstallments } = info;
  
  if (!installmentDates || installmentDates.length === 0 || totalInstallments === 0) {
    return '';
  }
  
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  
  let list = `\n📊 *STATUS DAS PARCELAS:*\n`;
  
  const count = Math.min(installmentDates.length, totalInstallments);
  let shown = 0;
  
  for (let i = 0; i < count && shown < maxToShow; i++) {
    const dateStr = installmentDates[i];
    if (!dateStr) continue;
    
    const dueDate = new Date(dateStr + 'T12:00:00');
    const formattedDate = dueDate.toLocaleDateString('pt-BR');
    const num = i + 1;
    
    let emoji: string;
    let status: string;
    
    if (i < paidCount) {
      emoji = '✅';
      status = 'Paga';
    } else if (dueDate < today) {
      emoji = '🔴';
      status = 'Em Atraso';
    } else {
      emoji = '⏳';
      status = 'Em Aberto';
    }
    
    const numDisplay = num <= 9 ? `${num}️⃣` : `${num}.`;
    list += `${numDisplay} ${emoji} ${formattedDate} - ${status}\n`;
    shown++;
  }
  
  // If there are more installments not shown
  const remaining = count - shown;
  if (remaining > 0) {
    list += `   _... e mais ${remaining} parcela${remaining > 1 ? 's' : ''}_\n`;
  }
  
  return list;
};
