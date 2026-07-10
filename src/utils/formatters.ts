// ========================================
// Utilitários de Formatação — Centralizado
// ========================================

const NOMES_MESES_ABR: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
};

/**
 * Formata um número como moeda brasileira (R$)
 * @example formatarMoeda(150000) => "R$ 150.000"
 */
export const formatarMoeda = (valor: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(valor);
};

/**
 * Formata um número como moeda abreviada para eixos de gráficos
 * @example formatarMoedaEixo(1500000) => "R$ 1.5M"
 */
export const formatarMoedaEixo = (value: number): string => {
  if (value >= 1e6) return `R$ ${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R$ ${(value / 1e3).toFixed(0)}k`;
  return `R$ ${value}`;
};

/**
 * Converte uma chave YYYY-MM para o formato de exibição Mês/Ano
 * @example formatarChaveMesExibicao("2026-07") => "Jul/26"
 */
export const formatarChaveMesExibicao = (mesChave: string): string => {
  const [anoStr, mesStr] = mesChave.split('-');
  const anoReduzido = anoStr.substring(2);
  return `${NOMES_MESES_ABR[mesStr] || 'Mês'}/${anoReduzido}`;
};

/**
 * Retorna a data atual (centralizada para facilitar testes e evitar hardcoding)
 */
export const obterDataHoje = (): Date => {
  return new Date();
};

/**
 * Retorna a chave YYYY-MM do mês atual
 * @example obterChaveMesAtual() => "2026-07"
 */
export const obterChaveMesAtual = (): string => {
  const hoje = obterDataHoje();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
};

/**
 * Retorna o nome abreviado do mês atual para exibição
 * @example obterNomeMesAtual() => "Jul"
 */
export const obterNomeMesAtual = (): string => {
  const hoje = obterDataHoje();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  return NOMES_MESES_ABR[mes] || 'Mês';
};
