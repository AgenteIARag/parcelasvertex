// ========================================
// Utilitários de Formatação — Centralizado
// ========================================
import type { StatusParcela } from '../types';

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
 * Formata uma data ISO YYYY-MM-DD para DD/MM/YYYY
 */
export const formatarData = (iso: string): string => {
  if (!iso || iso.includes('undefined')) return '—';
  const [ano, mes, dia] = iso.split('T')[0].split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
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

/**
 * Calcula o status efetivo de uma parcela em tempo real com base na data de vencimento.
 * Se o status salvo for 'A vencer' mas o vencimento já passou, retorna 'Vencida'.
 * Garante consistência entre todos os componentes sem depender do valor gravado no banco.
 * @param status  Status armazenado no banco/projeção
 * @param dataVencimento  Data de vencimento no formato YYYY-MM-DD
 */
export const obterStatusEfetivo = (status: StatusParcela, dataVencimento: string): StatusParcela => {
  if (status === 'A vencer' && dataVencimento) {
    const hoje = obterDataHoje();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(`${dataVencimento}T00:00:00`);
    if (venc < hoje) return 'Vencida';
  }
  return status;
};

/**
 * Máscara/normalizador para inputs de data ISO (YYYY-MM-DD).
 * Impede anos com mais de 4 dígitos (ex: "20226-08-07" -> "2026-08-07").
 */
export const normalizarDataISO = (valor: string): string => {
  if (!valor) return '';
  const partes = valor.split('-');
  if (partes.length !== 3) return valor;
  let [ano, mes, dia] = partes;
  if (ano.length > 4) {
    // Caso específico de digitação duplicada como "20226" -> "2026", senão mantém os 4 primeiros dígitos
    if (ano.length === 5 && ano.startsWith('2022')) {
      ano = '202' + ano.slice(4);
    } else {
      ano = ano.slice(0, 4);
    }
  }
  return `${ano}-${mes.slice(0, 2)}-${dia.slice(0, 2)}`;
};

/**
 * Valida se uma data está estritamente no formato YYYY-MM-DD com ano válido (2000 a 2099).
 */
export const validarDataISO = (valor: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const ano = Number(valor.substring(0, 4));
  if (ano < 2000 || ano > 2099) return false;
  const dt = new Date(`${valor}T00:00:00`);
  return !isNaN(dt.getTime());
};


