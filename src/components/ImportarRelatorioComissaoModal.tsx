import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Chip,
  TextField,
  Alert,
  Tooltip,
  Divider,
  CircularProgress,
  FormControlLabel,
  Switch,
  Autocomplete,
  Collapse,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import LinkIcon from '@mui/icons-material/Link';
import DownloadIcon from '@mui/icons-material/Download';
import LockIcon from '@mui/icons-material/Lock';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import type { LancamentoVenda, StatusParcela, Empresa, RelatorioComissaoSalvo } from '../types';
import { calcularTotaisLinha } from '../data/initialData';
import { obterStatusEfetivo } from '../utils/formatters';
import {
  salvarVendaSupabase,
  obterRelatoriosPdfLocais,
  obterRelatoriosPdfSupabase,
  salvarRelatorioPdfSupabase,
  excluirRelatorioPdfSupabase,
} from '../utils/supabase';
import {
  extrairDadosRelatorioPDF,
  analisarTextoRelatorioPDF,
  type DadosRelatorioPDF,
  type ItemRelatorioPDF,
} from '../utils/pdfParser';

const formatarMoeda = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatarData = (iso?: string): string => {
  if (!iso || iso.includes('undefined')) return '—';
  const partes = iso.split('-');
  if (partes.length !== 3) return iso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

const normalizarCodigoContrato = (codigo?: string): string => {
  if (!codigo) return '';
  const apenasDigitos = codigo.replace(/\D/g, '').replace(/^0+/, '');
  if (apenasDigitos.length > 0) return apenasDigitos;
  return codigo.trim().toLowerCase();
};

const calcularDiferencaDias = (isoA?: string, isoB?: string): number => {
  if (!isoA || !isoB) return 9999;
  const tA = new Date(`${isoA}T12:00:00`).getTime();
  const tB = new Date(`${isoB}T12:00:00`).getTime();
  if (isNaN(tA) || isNaN(tB)) return 9999;
  return Math.abs(Math.round((tA - tB) / (1000 * 60 * 60 * 24)));
};

export type TipoDivergencia =
  | 'CONTRATO_NAO_ENCONTRADO'
  | 'PARCELA_NAO_ENCONTRADA'
  | 'VALOR_COMISSAO_DIVERGENTE'
  | 'VALOR_BASE_DIVERGENTE'
  | 'DATA_VENDA_DIVERGENTE'
  | 'CONTRATO_CANCELADO'
  | 'PARCELA_JA_RECEBIDA'
  | 'PARCELA_NAO_PAGA_CLIENTE';

export interface DivergenciaDetalhe {
  tipo: TipoDivergencia;
  severidade: 'error' | 'warning' | 'info';
  titulo: string;
  descricao: string;
  valorPdf?: string;
  valorSistema?: string;
  diferencaValor?: number;
}

export interface ItemConciliacao {
  itemPdf: ItemRelatorioPDF;
  vendaEncontrada: LancamentoVenda | null;
  vendaSugerida: LancamentoVenda | null;
  vinculoManual: boolean;
  mesChaveParcela: string | null;
  statusParcelaSistema?: StatusParcela;
  jaRecebidaSistema?: boolean;
  comissaoSistema?: number;
  valorBaseSistema?: number;
  dataVendaSistema?: string;
  divergencias: DivergenciaDetalhe[];
  statusConciliacao: 'OK' | 'DIVERGENTE' | 'NAO_ENCONTRADO' | 'JA_RECEBIDO';
  podeMarcarRecebido: boolean;
}

interface ImportarRelatorioComissaoModalProps {
  open: boolean;
  onClose: () => void;
  vendas: LancamentoVenda[];
  empresas?: Empresa[];
  onAtualizarVenda: (venda: LancamentoVenda) => void;
  onSucesso?: (mensagem: string) => void;
}

export const ImportarRelatorioComissaoModal: React.FC<ImportarRelatorioComissaoModalProps> = ({
  open,
  onClose,
  vendas,
  empresas = [],
  onAtualizarVenda,
  onSucesso,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const obterNomeEmpresa = (empresaId?: string): string => {
    const id = empresaId || 'emp_vertex';
    const encontrada = empresas.find((e) => e.id === id);
    if (encontrada) return encontrada.nome;
    if (id === 'emp_vertex') return 'Vertex';
    if (id === 'emp_winvest') return 'Winvest';
    if (id === 'emp_shazam') return 'Shazam';
    if (id.includes('vetex_master') || id.includes('vertex_master')) return 'Vertex Master';
    return id.replace(/^emp_/, '');
  };
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroLeitura, setErroLeitura] = useState<string>('');
  const [mensagemSucessoLocal, setMensagemSucessoLocal] = useState<string>('');
  const [nomeArquivo, setNomeArquivo] = useState<string>('');
  const [dadosPdf, setDadosPdf] = useState<DadosRelatorioPDF | null>(null);

  // Cadastro persistente de relatórios PDF importados
  const [relatoriosSalvos, setRelatoriosSalvos] = useState<RelatorioComissaoSalvo[]>(() =>
    obterRelatoriosPdfLocais()
  );
  const [relatorioAtivoId, setRelatorioAtivoId] = useState<string | null>(null);
  const [vendasAtualizadasSessao, setVendasAtualizadasSessao] = useState<Record<string, LancamentoVenda>>({});

  // Campos editáveis para o lote de recebimento
  const [numeroRelatorioInput, setNumeroRelatorioInput] = useState<string>('');
  const [dataRelatorioInput, setDataRelatorioInput] = useState<string>('');
  const [notaFiscalInput, setNotaFiscalInput] = useState<string>('');

  // Opções de conciliação
  const [atualizarComissaoParaValorPdf, setAtualizarComissaoParaValorPdf] = useState<boolean>(false);
  const [marcarParcelaPagaAutomaticamente, setMarcarParcelaPagaAutomaticamente] = useState<boolean>(true);
  const [corrigirDatasDivergentesAutomaticamente, setCorrigirDatasDivergentesAutomaticamente] = useState<boolean>(false);
  const [datasCorrigidasLocalmente, setDatasCorrigidasLocalmente] = useState<Record<string, string>>({});
  const salvarPacEmVinculoManual = true;

  // Vínculos manuais (itemPdf.id -> venda.id)
  const [vinculosManuais, setVinculosManuais] = useState<Record<string, string>>({});

  // Seleção de linhas para baixa
  const [itensSelecionados, setItensSelecionados] = useState<string[]>([]);

  // Filtro visual das linhas
  const [filtroAbas, setFiltroAbas] = useState<'TODOS' | 'OK' | 'DIVERGENTE' | 'NAO_ENCONTRADO' | 'JA_RECEBIDO'>('TODOS');
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('TODAS');

  // Modo colar texto manual (caso o PDF seja imagem escaneada)
  const [mostrarColarTexto, setMostrarColarTexto] = useState(false);
  const [textoManualInput, setTextoManualInput] = useState('');

  // Vendas reais (não espelho) para conciliação direta, abrangendo todas as empresas (Vertex, Winvest, Shazam)
  // mesmo quando o filtro de empresa estiver ativo na aba atual
  const vendasPrincipais = useMemo(() => {
    const mapa = new Map<string, LancamentoVenda>();
    for (const v of vendas) {
      if (v && v.id && !v.isVendaEspelho) {
        const vendaSessao = vendasAtualizadasSessao[v.id] || v;
        const dataCorrigida = datasCorrigidasLocalmente[v.id];
        mapa.set(
          v.id,
          dataCorrigida ? { ...vendaSessao, dataVenda: dataCorrigida } : vendaSessao
        );
      }
    }
    try {
      const salvas = localStorage.getItem('apex_lancamentos_vendas');
      if (salvas) {
        const todas: LancamentoVenda[] = JSON.parse(salvas);
        for (const v of todas) {
          if (v && v.id && !v.isVendaEspelho && !mapa.has(v.id)) {
            const vendaSessao = vendasAtualizadasSessao[v.id] || v;
            const dataCorrigida = datasCorrigidasLocalmente[v.id];
            mapa.set(
              v.id,
              dataCorrigida ? { ...vendaSessao, dataVenda: dataCorrigida } : vendaSessao
            );
          }
        }
      }
    } catch {
      // Ignora erro de leitura do localStorage
    }
    for (const [idSessao, vSessao] of Object.entries(vendasAtualizadasSessao)) {
      if (!vSessao.isVendaEspelho) {
        const dataCorrigida = datasCorrigidasLocalmente[idSessao];
        mapa.set(
          idSessao,
          dataCorrigida ? { ...vSessao, dataVenda: dataCorrigida } : vSessao
        );
      }
    }
    return Array.from(mapa.values());
  }, [vendas, open, datasCorrigidasLocalmente, vendasAtualizadasSessao]);

  // Calcula os IDs de itens elegíveis para seleção automática (exclui os já recebidos)
  const calcularSelecaoInicial = (
    dados: DadosRelatorioPDF,
    mapaVinculos: Record<string, string> = {}
  ): string[] => {
    const idsParaSelecionar: string[] = [];
    dados.itens.forEach((item) => {
      const codNorm = normalizarCodigoContrato(item.contrato);
      const idManual = mapaVinculos[item.id];
      let venda: LancamentoVenda | undefined;
      if (idManual) {
        venda = vendasPrincipais.find((v) => v.id === idManual);
      } else {
        const candidatas = vendasPrincipais.filter(
          (v) =>
            normalizarCodigoContrato(v.pac) === codNorm ||
            (v.pac && v.pac.trim().toLowerCase() === item.contrato.trim().toLowerCase())
        );
        if (candidatas.length === 1) {
          venda = candidatas[0];
        } else if (candidatas.length > 1) {
          venda = [...candidatas].sort((a, b) => {
            const sA =
              (Math.abs((a.valorVenda || 0) - item.valorBase) < 1 ? 100 : 0) +
              (a.dataVenda === item.dataVendaISO ? 50 : 0);
            const sB =
              (Math.abs((b.valorVenda || 0) - item.valorBase) < 1 ? 100 : 0) +
              (b.dataVenda === item.dataVendaISO ? 50 : 0);
            return sB - sA;
          })[0];
        }
      }
      if (!venda || venda.statusCliente === 'Cancelado') return;
      const mesesAtivos = Object.keys(venda.projecaoMensal || {})
        .filter((m) => (venda!.projecaoMensal[m]?.valorVenda || 0) > 0)
        .sort();
      const mesChave = mesesAtivos[item.parcela - 1];
      if (!mesChave) return;
      const cel = venda.projecaoMensal[mesChave];
      if (cel && !cel.recebida && cel.status !== 'Cancelada' && cel.status !== 'Estornada') {
        idsParaSelecionar.push(item.id);
      }
    });
    return idsParaSelecionar;
  };

  // Carrega um relatório PDF salvo do cadastro
  const selecionarRelatorioSalvo = (rel: RelatorioComissaoSalvo) => {
    if (!rel || !rel.dadosPdf) return;
    setErroLeitura('');
    setMensagemSucessoLocal('');
    setRelatorioAtivoId(rel.id);
    setDadosPdf(rel.dadosPdf);
    setNomeArquivo(rel.nomeArquivo);
    setNumeroRelatorioInput(
      rel.numeroDocumento || rel.dadosPdf.numeroDocumento || rel.dadosPdf.itens?.[0]?.numDoc || ''
    );
    setDataRelatorioInput(
      rel.dataRecebimentoInput ||
        rel.dadosPdf.itens?.[0]?.dataRelatorioISO ||
        rel.dataGeracaoISO ||
        new Date().toISOString().split('T')[0]
    );
    setNotaFiscalInput(rel.notaFiscalInput || '');
    const vinculos = rel.vinculosManuais || {};
    setVinculosManuais(vinculos);
    setFiltroAbas('TODOS');
    setFiltroEmpresa('TODAS');
    setMostrarColarTexto(false);
    setItensSelecionados(calcularSelecaoInicial(rel.dadosPdf, vinculos));
  };

  // Ao abrir o modal, carrega os relatórios salvos (localStorage + Supabase) e seleciona o mais recente automaticamente
  useEffect(() => {
    if (!open) return;
    setMensagemSucessoLocal('');
    const locais = obterRelatoriosPdfLocais();
    setRelatoriosSalvos(locais);
    if (!dadosPdf && locais.length > 0) {
      selecionarRelatorioSalvo(locais[0]);
    }
    obterRelatoriosPdfSupabase().then((remotos) => {
      setRelatoriosSalvos(remotos);
      if (!dadosPdf && locais.length === 0 && remotos.length > 0) {
        selecionarRelatorioSalvo(remotos[0]);
      }
    });
  }, [open]);

  // Recalcula seleção quando as vendas mudam para remover automaticamente qualquer item já recebido
  useEffect(() => {
    if (!dadosPdf) return;
    setItensSelecionados((prev) => {
      const elegiveis = new Set(calcularSelecaoInicial(dadosPdf, vinculosManuais));
      return prev.filter((id) => elegiveis.has(id));
    });
  }, [vendasPrincipais]);

  // Processa os itens do PDF cruzando com as vendas do sistema (todas as empresas)
  const itensConciliados = useMemo<ItemConciliacao[]>(() => {
    if (!dadosPdf) return [];

    const pacsNoPdf = new Set(
      dadosPdf.itens.map((it) => normalizarCodigoContrato(it.contrato)).filter(Boolean)
    );

    return dadosPdf.itens.map((item) => {
      const codPdfNorm = normalizarCodigoContrato(item.contrato);
      const idManual = vinculosManuais[item.id];

      let vendaEncontrada: LancamentoVenda | null = null;
      let vinculoManual = false;

      if (idManual) {
        vendaEncontrada = vendasPrincipais.find((v) => v.id === idManual) || null;
        vinculoManual = !!vendaEncontrada;
      } else if (codPdfNorm) {
        // Caso haja mais de uma venda com o mesmo PAC no banco (ex: duplicidade de digitação),
        // prioriza aquela cujo Valor Base (valorVenda) e Data da Venda coincidem com o PDF
        const candidatasPac = vendasPrincipais.filter(
          (v) =>
            normalizarCodigoContrato(v.pac) === codPdfNorm ||
            (v.pac && v.pac.trim().toLowerCase() === item.contrato.trim().toLowerCase())
        );

        if (candidatasPac.length === 1) {
          vendaEncontrada = candidatasPac[0];
        } else if (candidatasPac.length > 1) {
          const pontuar = (v: LancamentoVenda) => {
            let score = 0;
            if (Math.abs((v.valorVenda || 0) - item.valorBase) < 1) score += 100;
            if (v.dataVenda === item.dataVendaISO) score += 50;
            const diffDias = calcularDiferencaDias(v.dataVenda, item.dataVendaISO);
            if (diffDias <= 7) score += Math.max(0, 20 - diffDias);
            return score;
          };
          vendaEncontrada = [...candidatasPac].sort((a, b) => pontuar(b) - pontuar(a))[0];
        }
      }

      // Caso não encontre pelo PAC, procura uma venda sugerida com mesmo valor de crédito e data próxima ou PAC similar
      let vendaSugerida: LancamentoVenda | null = null;
      if (!vendaEncontrada) {
        const candidatasSugestao = vendasPrincipais
          .filter((v) => {
            const pacNorm = normalizarCodigoContrato(v.pac);
            // Não sugere vendas que já batem exatamente com outro contrato presente no mesmo PDF
            if (pacNorm && pacsNoPdf.has(pacNorm)) return false;
            return Math.abs((v.valorVenda || 0) - item.valorBase) < 1;
          })
          .map((v) => {
            const diffDias = calcularDiferencaDias(v.dataVenda, item.dataVendaISO);
            const pacNorm = normalizarCodigoContrato(v.pac);
            const prefixoComum =
              pacNorm && codPdfNorm && pacNorm.slice(0, 7) === codPdfNorm.slice(0, 7);
            let score = 0;
            if (diffDias === 0) score += 100;
            else if (diffDias <= 15) score += 70 - diffDias * 3;
            if (prefixoComum) score += 40;
            if (!v.pac) score += 25;
            return { venda: v, score, diffDias };
          })
          .filter((c) => c.score > 0)
          .sort((a, b) => b.score - a.score);

        vendaSugerida = candidatasSugestao[0]?.venda || null;
      }

      const divergencias: DivergenciaDetalhe[] = [];

      if (!vendaEncontrada) {
        divergencias.push({
          tipo: 'CONTRATO_NAO_ENCONTRADO',
          severidade: 'error',
          titulo: 'Contrato não localizado',
          descricao: vendaSugerida
            ? `PAC ${item.contrato} não cadastrado. Possível correspondência por Valor/Data próxima: ${vendaSugerida.cliente} (${obterNomeEmpresa(vendaSugerida.empresaId)} · PAC no sistema: ${vendaSugerida.pac || 'Sem PAC'} · Venda: ${formatarData(vendaSugerida.dataVenda)} · ${formatarMoeda(vendaSugerida.valorVenda)}).`
            : `Nenhum contrato com PAC "${item.contrato}" foi encontrado no sistema.`,
          valorPdf: item.contrato,
          valorSistema: 'Não cadastrado',
        });

        return {
          itemPdf: item,
          vendaEncontrada: null,
          vendaSugerida,
          vinculoManual: false,
          mesChaveParcela: null,
          divergencias,
          statusConciliacao: 'NAO_ENCONTRADO',
          podeMarcarRecebido: false,
        };
      }

      // Localiza a N-ésima parcela ativa dentro de projecaoMensal
      const mesesAtivos = Object.keys(vendaEncontrada.projecaoMensal || {})
        .filter((m) => {
          const cel = vendaEncontrada!.projecaoMensal[m];
          return cel && cel.valorVenda > 0;
        })
        .sort();

      const mesChaveParcela = mesesAtivos[item.parcela - 1] || null;
      const celula = mesChaveParcela ? vendaEncontrada.projecaoMensal[mesChaveParcela] : null;

      if (!mesChaveParcela || !celula) {
        divergencias.push({
          tipo: 'PARCELA_NAO_ENCONTRADA',
          severidade: 'error',
          titulo: `Parcela ${item.parcela} inexistente`,
          descricao: `O PDF aponta a parcela ${item.parcela}, mas o contrato de ${vendaEncontrada.cliente} possui apenas ${mesesAtivos.length} parcela(s) ativa(s).`,
          valorPdf: `Parcela ${item.parcela}`,
          valorSistema: `Máx: ${mesesAtivos.length}`,
        });

        return {
          itemPdf: item,
          vendaEncontrada,
          vendaSugerida: null,
          vinculoManual,
          mesChaveParcela: null,
          divergencias,
          statusConciliacao: 'DIVERGENTE',
          podeMarcarRecebido: false,
        };
      }

      const statusEfetivo = obterStatusEfetivo(
        celula.status,
        celula.dataVencimento || `${mesChaveParcela}-15`
      );
      const comissaoSistema = Number((celula.comissaoGerada || 0).toFixed(2));
      const valorBaseSistema = Number((vendaEncontrada.valorVenda || 0).toFixed(2));
      const dataVendaSistema = vendaEncontrada.dataVenda || '';
      const jaRecebida = !!celula.recebida;

      // 1. Verifica divergência de Valor da Comissão
      const difComissao = Number((item.valorComissao - comissaoSistema).toFixed(2));
      if (Math.abs(difComissao) > 0.05) {
        divergencias.push({
          tipo: 'VALOR_COMISSAO_DIVERGENTE',
          severidade: 'warning',
          titulo: 'Comissão divergente',
          descricao: `Comissão no PDF (${formatarMoeda(item.valorComissao)}) difere do valor previsto no sistema (${formatarMoeda(comissaoSistema)}). Diferença: ${difComissao > 0 ? '+' : ''}${formatarMoeda(difComissao)}.`,
          valorPdf: formatarMoeda(item.valorComissao),
          valorSistema: formatarMoeda(comissaoSistema),
          diferencaValor: difComissao,
        });
      }

      // 2. Verifica divergência de Valor Base (Crédito da Cota)
      const difBase = Number((item.valorBase - valorBaseSistema).toFixed(2));
      if (Math.abs(difBase) > 0.05) {
        divergencias.push({
          tipo: 'VALOR_BASE_DIVERGENTE',
          severidade: 'warning',
          titulo: 'Valor Base (Crédito) divergente',
          descricao: `Valor Base no PDF (${formatarMoeda(item.valorBase)}) difere do Valor da Cota no sistema (${formatarMoeda(valorBaseSistema)}). Diferença: ${difBase > 0 ? '+' : ''}${formatarMoeda(difBase)}.`,
          valorPdf: formatarMoeda(item.valorBase),
          valorSistema: formatarMoeda(valorBaseSistema),
          diferencaValor: difBase,
        });
      }

      // 3. Verifica divergência de Data da Venda
      if (dataVendaSistema && item.dataVendaISO && dataVendaSistema !== item.dataVendaISO) {
        divergencias.push({
          tipo: 'DATA_VENDA_DIVERGENTE',
          severidade: 'info',
          titulo: 'Data da Venda divergente',
          descricao: `Data da venda no PDF (${item.dataVendaBr}) difere da cadastrada no sistema (${formatarData(dataVendaSistema)}).`,
          valorPdf: item.dataVendaBr,
          valorSistema: formatarData(dataVendaSistema),
        });
      }

      // 4. Verifica se o contrato ou parcela está Cancelado/Estornado
      const isCancelado =
        vendaEncontrada.statusCliente === 'Cancelado' ||
        statusEfetivo === 'Cancelada' ||
        statusEfetivo === 'Estornada';

      if (isCancelado) {
        divergencias.push({
          tipo: 'CONTRATO_CANCELADO',
          severidade: 'error',
          titulo: 'Contrato/Parcela Cancelada',
          descricao: `Esta parcela consta como "${statusEfetivo}" (Cliente: ${vendaEncontrada.statusCliente}) no sistema, mas está sendo paga no relatório.`,
          valorPdf: 'Comissão Ativa',
          valorSistema: statusEfetivo,
        });
      }

      // 5. Verifica se já foi marcada como Recebida anteriormente (bloqueado para alterações)
      if (jaRecebida) {
        divergencias.unshift({
          tipo: 'PARCELA_JA_RECEBIDA',
          severidade: 'info',
          titulo: '🔒 Recebido (Bloqueado p/ alteração)',
          descricao: `Parcela já marcada como recebida${celula.numeroRelatorioRecebimento ? ` no Relatório nº ${celula.numeroRelatorioRecebimento}` : ''}${celula.dataRelatorioRecebimento ? ` em ${formatarData(celula.dataRelatorioRecebimento)}` : ''}. Registros recebidos ficam bloqueados e não podem mais ser alterados pelo modal do PDF.`,
          valorPdf: `Doc ${item.numDoc}`,
          valorSistema: celula.numeroRelatorioRecebimento ? `Doc ${celula.numeroRelatorioRecebimento}` : 'Recebida',
        });
      } else if (statusEfetivo !== 'Paga' && !isCancelado) {
        // 6. Parcela ainda estava "A vencer" ou "Vencida" (não baixada como Paga pelo cliente)
        divergencias.push({
          tipo: 'PARCELA_NAO_PAGA_CLIENTE',
          severidade: 'info',
          titulo: `Status atual: ${statusEfetivo}`,
          descricao: `A parcela ainda não havia sido marcada como "Paga" pelo cliente. Será atualizada para "Paga" + "Recebida".`,
          valorPdf: 'Paga',
          valorSistema: statusEfetivo,
        });
      }

      const temDivergenciaRelevante = divergencias.some(
        (d) =>
          d.tipo === 'VALOR_COMISSAO_DIVERGENTE' ||
          d.tipo === 'VALOR_BASE_DIVERGENTE' ||
          d.tipo === 'DATA_VENDA_DIVERGENTE' ||
          d.tipo === 'CONTRATO_CANCELADO'
      );

      // Se a parcela já foi marcada como recebida, seu status principal é JA_RECEBIDO e fica bloqueada
      let statusConciliacao: ItemConciliacao['statusConciliacao'] = 'OK';
      if (jaRecebida) {
        statusConciliacao = 'JA_RECEBIDO';
      } else if (temDivergenciaRelevante) {
        statusConciliacao = 'DIVERGENTE';
      }

      return {
        itemPdf: item,
        vendaEncontrada,
        vendaSugerida: null,
        vinculoManual,
        mesChaveParcela,
        statusParcelaSistema: statusEfetivo,
        jaRecebidaSistema: jaRecebida,
        comissaoSistema,
        valorBaseSistema,
        dataVendaSistema,
        divergencias,
        statusConciliacao,
        podeMarcarRecebido: !jaRecebida && !isCancelado,
      };
    });
  }, [dadosPdf, vendasPrincipais, vinculosManuais]);

  // Inicializa seleção padrão e cadastra/atualiza o relatório PDF no histórico persistente
  const aplicarDadosExtraidos = async (dados: DadosRelatorioPDF, origemNome: string) => {
    const numDoc = dados.numeroDocumento || dados.itens[0]?.numDoc || 'S/N';
    const dataRec =
      dados.itens[0]?.dataRelatorioISO ||
      dados.dataGeracaoISO ||
      new Date().toISOString().split('T')[0];

    const existente = relatoriosSalvos.find(
      (r) =>
        (numDoc !== 'S/N' && r.numeroDocumento === numDoc) ||
        (r.nomeArquivo === origemNome && Math.abs(r.totalLiquido - dados.totalLiquido) < 0.05)
    );

    const vinculosIniciais = existente?.vinculosManuais || {};
    const nfInicial = existente?.notaFiscalInput || '';
    const idRelatorio =
      existente?.id ||
      (numDoc !== 'S/N' ? `rel_pdf_${numDoc.replace(/\D/g, '')}` : `rel_pdf_${Date.now()}`);

    setRelatorioAtivoId(idRelatorio);
    setDadosPdf(dados);
    setNomeArquivo(origemNome);
    setNumeroRelatorioInput(numDoc);
    setDataRelatorioInput(existente?.dataRecebimentoInput || dataRec);
    setNotaFiscalInput(nfInicial);
    setVinculosManuais(vinculosIniciais);
    setFiltroAbas('TODOS');
    setFiltroEmpresa('TODAS');
    setMensagemSucessoLocal('');

    const idsParaSelecionar = calcularSelecaoInicial(dados, vinculosIniciais);
    setItensSelecionados(idsParaSelecionar);

    const novoCadastro: RelatorioComissaoSalvo = {
      id: idRelatorio,
      nomeArquivo: origemNome,
      numeroDocumento: numDoc,
      codigoPN: dados.codigoPN,
      nomePN: dados.nomePN,
      cnpj: dados.cnpj,
      dataGeracaoISO: dados.dataGeracaoISO,
      dataGeracaoBr: dados.dataGeracaoBr,
      dataRecebimentoInput: existente?.dataRecebimentoInput || dataRec,
      notaFiscalInput: nfInicial,
      totalValorBase:
        dados.totalValorBase || dados.itens.reduce((acc, i) => acc + i.valorBase, 0),
      totalLiquido:
        dados.totalLiquido || dados.itens.reduce((acc, i) => acc + i.valorComissao, 0),
      qtdItens: dados.itens.length,
      dadosPdf: dados,
      vinculosManuais: vinculosIniciais,
      createdAt: existente?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const listaAtualizada = await salvarRelatorioPdfSupabase(novoCadastro);
    setRelatoriosSalvos(listaAtualizada);
  };

  // Sincroniza metadados e vínculos manuais do relatório ativo no cadastro persistente
  const atualizarCadastroRelatorioAtivo = (
    camposParciais: Partial<
      Pick<
        RelatorioComissaoSalvo,
        'numeroDocumento' | 'dataRecebimentoInput' | 'notaFiscalInput' | 'vinculosManuais'
      >
    >
  ) => {
    if (!relatorioAtivoId || !dadosPdf) return;
    const atual = relatoriosSalvos.find((r) => r.id === relatorioAtivoId);
    if (!atual) return;
    const atualizado: RelatorioComissaoSalvo = {
      ...atual,
      ...camposParciais,
      updatedAt: new Date().toISOString(),
    };
    salvarRelatorioPdfSupabase(atualizado).then((lista) => setRelatoriosSalvos(lista));
  };

  const handleExcluirRelatorioSalvo = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const novaLista = await excluirRelatorioPdfSupabase(id);
    setRelatoriosSalvos(novaLista);
    if (relatorioAtivoId === id) {
      if (novaLista.length > 0) {
        selecionarRelatorioSalvo(novaLista[0]);
      } else {
        setRelatorioAtivoId(null);
        setDadosPdf(null);
        setNomeArquivo('');
        setItensSelecionados([]);
      }
    }
  };

  const handleUploadArquivo = async (file: File) => {
    setErroLeitura('');
    setMensagemSucessoLocal('');
    setCarregando(true);
    try {
      const dados = await extrairDadosRelatorioPDF(file);
      if (dados.itens.length === 0) {
        setErroLeitura(
          'Não foi possível identificar linhas de contratos automaticamente neste PDF. Você pode colar o texto do relatório abaixo.'
        );
        setMostrarColarTexto(true);
      } else {
        await aplicarDadosExtraidos(dados, file.name);
        setMostrarColarTexto(false);
      }
    } catch (err: any) {
      console.error('Erro ao processar PDF:', err);
      setErroLeitura('Erro ao ler o arquivo PDF. Tente novamente ou cole o conteúdo textual.');
      setMostrarColarTexto(true);
    } finally {
      setCarregando(false);
    }
  };

  const handleProcessarTextoManual = async () => {
    if (!textoManualInput.trim()) return;
    setErroLeitura('');
    setMensagemSucessoLocal('');
    const dados = analisarTextoRelatorioPDF(textoManualInput);
    if (dados.itens.length === 0) {
      setErroLeitura(
        'Nenhuma linha no padrão do Relatório de Comissão foi encontrada no texto informado.'
      );
      return;
    }
    await aplicarDadosExtraidos(dados, 'Texto Colado Manualmente');
    setMostrarColarTexto(false);
  };

  const handleVincularContratoManual = (itemId: string, venda: LancamentoVenda | null) => {
    // Bloqueia alteração de vínculo se o item atual já estiver marcado como recebido
    const itemAtual = itensConciliados.find((i) => i.itemPdf.id === itemId);
    if (itemAtual?.jaRecebidaSistema) return;

    setVinculosManuais((prev) => {
      const copia = { ...prev };
      if (venda) {
        copia[itemId] = venda.id;
      } else {
        delete copia[itemId];
      }
      atualizarCadastroRelatorioAtivo({ vinculosManuais: copia });
      return copia;
    });

    if (venda) {
      // Só seleciona se a parcela correspondente na venda vinculada não estiver recebida
      const itemPdf = dadosPdf?.itens.find((it) => it.id === itemId);
      const mesesAtivos = Object.keys(venda.projecaoMensal || {})
        .filter((m) => (venda.projecaoMensal[m]?.valorVenda || 0) > 0)
        .sort();
      const mesChave = itemPdf ? mesesAtivos[itemPdf.parcela - 1] : undefined;
      const jaRec = mesChave ? !!venda.projecaoMensal[mesChave]?.recebida : false;
      if (!jaRec) {
        setItensSelecionados((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
      } else {
        setItensSelecionados((prev) => prev.filter((id) => id !== itemId));
      }
    } else {
      setItensSelecionados((prev) => prev.filter((id) => id !== itemId));
    }
  };

  // Resumo estatístico da conciliação
  const resumo = useMemo(() => {
    const totalItens = itensConciliados.length;
    const totalValorPdf = itensConciliados.reduce((acc, i) => acc + i.itemPdf.valorComissao, 0);
    const totalBasePdf = itensConciliados.reduce((acc, i) => acc + i.itemPdf.valorBase, 0);

    const qtdOk = itensConciliados.filter((i) => i.statusConciliacao === 'OK').length;
    const qtdDivergente = itensConciliados.filter((i) => i.statusConciliacao === 'DIVERGENTE').length;
    const qtdNaoEncontrado = itensConciliados.filter((i) => i.statusConciliacao === 'NAO_ENCONTRADO').length;
    const qtdJaRecebido = itensConciliados.filter((i) => i.statusConciliacao === 'JA_RECEBIDO').length;
    // Somente permite corrigir datas divergentes de itens que AINDA NÃO foram marcados como recebidos
    const qtdDatasDivergentes = itensConciliados.filter(
      (i) =>
        !i.jaRecebidaSistema &&
        i.divergencias.some((d) => d.tipo === 'DATA_VENDA_DIVERGENTE')
    ).length;

    const itensEncontrados = itensConciliados.filter((i) => i.vendaEncontrada && i.mesChaveParcela);
    const somaComissaoSistemaEncontrados = itensEncontrados.reduce(
      (acc, i) => acc + (i.comissaoSistema || 0),
      0
    );
    const somaComissaoPdfEncontrados = itensEncontrados.reduce(
      (acc, i) => acc + i.itemPdf.valorComissao,
      0
    );
    const diferencaLiquidaComissao = Number(
      (somaComissaoPdfEncontrados - somaComissaoSistemaEncontrados).toFixed(2)
    );

    const selecionadosValidos = itensConciliados.filter(
      (i) => itensSelecionados.includes(i.itemPdf.id) && i.podeMarcarRecebido && !i.jaRecebidaSistema
    );
    const valorSelecionado = selecionadosValidos.reduce(
      (acc, i) => acc + i.itemPdf.valorComissao,
      0
    );

    // Agrupamento por empresa (Vertex, Winvest, Shazam, etc.)
    const mapaEmpresas = new Map<
      string,
      { id: string; nome: string; qtd: number; valorComissao: number; valorBase: number }
    >();
    for (const ic of itensConciliados) {
      if (ic.vendaEncontrada) {
        const empId = ic.vendaEncontrada.empresaId || 'emp_vertex';
        const nome = obterNomeEmpresa(empId);
        const atual = mapaEmpresas.get(empId) || {
          id: empId,
          nome,
          qtd: 0,
          valorComissao: 0,
          valorBase: 0,
        };
        atual.qtd += 1;
        atual.valorComissao = Number((atual.valorComissao + ic.itemPdf.valorComissao).toFixed(2));
        atual.valorBase = Number((atual.valorBase + ic.itemPdf.valorBase).toFixed(2));
        mapaEmpresas.set(empId, atual);
      }
    }
    const porEmpresa = Array.from(mapaEmpresas.values()).sort((a, b) => b.qtd - a.qtd);

    return {
      totalItens,
      totalValorPdf,
      totalBasePdf,
      qtdOk,
      qtdDivergente,
      qtdNaoEncontrado,
      qtdJaRecebido,
      qtdDatasDivergentes,
      somaComissaoSistemaEncontrados,
      somaComissaoPdfEncontrados,
      diferencaLiquidaComissao,
      qtdSelecionados: selecionadosValidos.length,
      valorSelecionado,
      porEmpresa,
    };
  }, [itensConciliados, itensSelecionados, empresas]);

  // Corrige a data de venda de um único contrato para a data do PDF (bloqueado se já recebido)
  const handleCorrigirDataVendaIndividual = async (
    venda: LancamentoVenda,
    novaDataISO: string,
    jaRecebida?: boolean
  ) => {
    if (jaRecebida) return;
    if (!novaDataISO || venda.dataVenda === novaDataISO) return;
    const vendaAtualizada: LancamentoVenda = {
      ...venda,
      dataVenda: novaDataISO,
    };
    setDatasCorrigidasLocalmente((prev) => ({
      ...prev,
      [venda.id]: novaDataISO,
    }));
    setVendasAtualizadasSessao((prev) => ({
      ...prev,
      [venda.id]: vendaAtualizada,
    }));
    onAtualizarVenda(vendaAtualizada);
    try {
      await salvarVendaSupabase(vendaAtualizada);
    } catch (err) {
      console.error('Erro ao salvar data de venda corrigida no Supabase:', err);
    }
  };

  // Corrige em lote todas as datas de venda divergentes para a data constante no PDF (ignora os já recebidos)
  const handleCorrigirTodasDatasDivergentes = async () => {
    const itensComDataDiv = itensConciliados.filter(
      (i) =>
        !i.jaRecebidaSistema &&
        i.vendaEncontrada &&
        i.itemPdf.dataVendaISO &&
        i.divergencias.some((d) => d.tipo === 'DATA_VENDA_DIVERGENTE')
    );
    if (itensComDataDiv.length === 0) return;

    const novoMapaDatas: Record<string, string> = {};
    const novoMapaVendas: Record<string, LancamentoVenda> = {};
    const vendasParaSalvar: LancamentoVenda[] = [];

    for (const ic of itensComDataDiv) {
      const v = ic.vendaEncontrada!;
      const novaData = ic.itemPdf.dataVendaISO;
      if (v.dataVenda !== novaData) {
        const atualizada = { ...v, dataVenda: novaData };
        novoMapaDatas[v.id] = novaData;
        novoMapaVendas[v.id] = atualizada;
        vendasParaSalvar.push(atualizada);
      }
    }

    setDatasCorrigidasLocalmente((prev) => ({ ...prev, ...novoMapaDatas }));
    setVendasAtualizadasSessao((prev) => ({ ...prev, ...novoMapaVendas }));
    for (const vUpd of vendasParaSalvar) {
      onAtualizarVenda(vUpd);
      try {
        await salvarVendaSupabase(vUpd);
      } catch (err) {
        console.error('Erro ao corrigir data em lote no Supabase:', err);
      }
    }
  };

  const itensFiltrados = useMemo(() => {
    return itensConciliados.filter((i) => {
      if (filtroAbas !== 'TODOS' && i.statusConciliacao !== filtroAbas) return false;
      if (filtroEmpresa !== 'TODAS') {
        const empId = i.vendaEncontrada ? i.vendaEncontrada.empresaId || 'emp_vertex' : 'SEM_EMPRESA';
        if (empId !== filtroEmpresa) return false;
      }
      return true;
    });
  }, [itensConciliados, filtroAbas, filtroEmpresa]);

  const handleToggleItem = (id: string) => {
    const item = itensConciliados.find((i) => i.itemPdf.id === id);
    if (!item || !item.podeMarcarRecebido || item.jaRecebidaSistema) return;
    setItensSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleTodosVisiveis = (marcar: boolean) => {
    const idsVisiveisValidos = itensFiltrados
      .filter((i) => i.podeMarcarRecebido && !i.jaRecebidaSistema)
      .map((i) => i.itemPdf.id);
    if (marcar) {
      setItensSelecionados((prev) => Array.from(new Set([...prev, ...idsVisiveisValidos])));
    } else {
      setItensSelecionados((prev) => prev.filter((id) => !idsVisiveisValidos.includes(id)));
    }
  };

  const handleConfirmarBaixaEmLote = async () => {
    // Filtra estritamente apenas itens que AINDA NÃO estão marcados como recebidos
    const selecionados = itensConciliados.filter(
      (i) =>
        itensSelecionados.includes(i.itemPdf.id) &&
        i.podeMarcarRecebido &&
        !i.jaRecebidaSistema &&
        i.vendaEncontrada &&
        i.mesChaveParcela
    );

    if (selecionados.length === 0) return;

    setSalvando(true);
    setErroLeitura('');
    try {
      // Agrupa atualizações por vendaId para evitar condições de corrida quando o mesmo contrato tem mais de 1 parcela no PDF
      const mapaVendasParaAtualizar = new Map<string, LancamentoVenda>();

      for (const itemConc of selecionados) {
        const vendaBase =
          mapaVendasParaAtualizar.get(itemConc.vendaEncontrada!.id) ||
          itemConc.vendaEncontrada!;

        const mesChave = itemConc.mesChaveParcela!;
        const celulaAtual = vendaBase.projecaoMensal[mesChave];
        // Proteção extra: jamais altera uma parcela que já consta como recebida
        if (!celulaAtual || celulaAtual.recebida) continue;

        const numRelatorioFinal =
          numeroRelatorioInput.trim() || itemConc.itemPdf.numDoc || 'S/N';
        const dataRelatorioFinal =
          dataRelatorioInput ||
          itemConc.itemPdf.dataRelatorioISO ||
          new Date().toISOString().split('T')[0];

        const novoStatusParcela: StatusParcela =
          marcarParcelaPagaAutomaticamente &&
          (celulaAtual.status === 'A vencer' || celulaAtual.status === 'Vencida')
            ? 'Paga'
            : celulaAtual.status;

        const novaComissao =
          atualizarComissaoParaValorPdf
            ? itemConc.itemPdf.valorComissao
            : celulaAtual.comissaoGerada;

        const novaCelula = {
          ...celulaAtual,
          status: novoStatusParcela,
          recebida: true,
          comissaoGerada: novaComissao,
          numeroRelatorioRecebimento: numRelatorioFinal,
          dataRelatorioRecebimento: dataRelatorioFinal,
          notaFiscalRecebimento: notaFiscalInput.trim() || celulaAtual.notaFiscalRecebimento,
          dataPagamentoCliente:
            celulaAtual.dataPagamentoCliente ||
            (novoStatusParcela === 'Paga' ? dataRelatorioFinal : undefined),
        };

        const novaProjecao = {
          ...vendaBase.projecaoMensal,
          [mesChave]: novaCelula,
        };

        // Recalcula totalComissoes caso o valor de comissão tenha sido ajustado pelo PDF
        let totalComissoes = vendaBase.totalComissoes;
        let totalVendas = vendaBase.totalVendas;
        if (atualizarComissaoParaValorPdf) {
          totalComissoes = Number(
            Object.values(novaProjecao)
              .filter((c) => c && c.status !== 'Cancelada' && c.status !== 'Estornada' && c.valorVenda > 0)
              .reduce((acc, c) => acc + (c.comissaoGerada || 0), 0)
              .toFixed(2)
          );
        } else {
          const calc = calcularTotaisLinha(
            novaProjecao,
            vendaBase.percentualComissao,
            vendaBase.qtdParcelas,
            vendaBase.tipoTabela || 'Linear',
            vendaBase.percentualAdesao,
            vendaBase.percentualMensal,
            vendaBase.percentuaisParcelas,
            vendaBase.valorParcela
          );
          totalVendas = calc.totalVendas;
          totalComissoes = calc.totalComissoes;
        }

        // Se foi vinculado manualmente e a venda estava sem PAC, atualiza o PAC com o número do contrato do PDF
        const novoPac =
          itemConc.vinculoManual && salvarPacEmVinculoManual && !vendaBase.pac
            ? itemConc.itemPdf.contrato
            : vendaBase.pac;

        const novaDataVenda =
          corrigirDatasDivergentesAutomaticamente && itemConc.itemPdf.dataVendaISO
            ? itemConc.itemPdf.dataVendaISO
            : vendaBase.dataVenda;

        const vendaAtualizada: LancamentoVenda = {
          ...vendaBase,
          pac: novoPac,
          dataVenda: novaDataVenda,
          numeroRelatorio: numRelatorioFinal,
          dataRelatorio: dataRelatorioFinal,
          projecaoMensal: novaProjecao,
          totalVendas,
          totalComissoes,
        };

        mapaVendasParaAtualizar.set(vendaAtualizada.id, vendaAtualizada);
      }

      // Persiste todas as vendas atualizadas no Supabase e no estado global + estado da sessão (bloqueio imediato)
      const vendasAtualizadasLista = Array.from(mapaVendasParaAtualizar.values());
      const novoMapaSessao: Record<string, LancamentoVenda> = {};
      for (const vendaUpd of vendasAtualizadasLista) {
        novoMapaSessao[vendaUpd.id] = vendaUpd;
        await salvarVendaSupabase(vendaUpd);
        onAtualizarVenda(vendaUpd);
      }

      setVendasAtualizadasSessao((prev) => ({ ...prev, ...novoMapaSessao }));
      setItensSelecionados([]);

      // Salva também os metadados do relatório ativo no cadastro
      atualizarCadastroRelatorioAtivo({
        numeroDocumento: numeroRelatorioInput.trim() || dadosPdf?.numeroDocumento || 'S/N',
        dataRecebimentoInput: dataRelatorioInput,
        notaFiscalInput: notaFiscalInput.trim(),
        vinculosManuais,
      });

      const msg = `✅ ${selecionados.length} parcela(s) de ${vendasAtualizadasLista.length} contrato(s) marcada(s) como Recebida(s) e bloqueada(s) para alterações (Relatório nº ${numeroRelatorioInput || dadosPdf?.numeroDocumento || ''})!`;
      setMensagemSucessoLocal(msg);
      onSucesso?.(msg);
    } catch (err: any) {
      console.error('Erro ao baixar parcelas do relatório PDF:', err);
      setErroLeitura(
        `Erro ao salvar recebimentos: ${err?.message || 'Verifique sua conexão e tente novamente.'}`
      );
    } finally {
      setSalvando(false);
    }
  };

  // Exporta PDF de Divergências
  const handleExportarRelatorioDivergenciasPDF = () => {
    if (!dadosPdf) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(99, 102, 241);
    doc.text(
      `APEX - Auditoria e Conciliação de Relatório de Comissão (Doc nº ${numeroRelatorioInput || dadosPdf.numeroDocumento || '—'})`,
      14,
      15
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Parceiro: ${dadosPdf.nomePN || 'Vertex Soluções Financeiras'} | Data do Relatório: ${formatarData(dataRelatorioInput)} | Total PDF: ${formatarMoeda(resumo.totalValorPdf)}`,
      14,
      22
    );

    const headers = [
      'Contrato (PAC)',
      'Empresa',
      'Cliente no Sistema',
      'Parcela',
      'Venda (PDF / Sist.)',
      'Valor Base (PDF / Sist.)',
      'Comissão PDF',
      'Comissão Sistema',
      'Diferença',
      'Status / Divergências Apontadas',
    ];

    const rows = itensConciliados.map((ic) => {
      const dif =
        ic.comissaoSistema !== undefined
          ? ic.itemPdf.valorComissao - ic.comissaoSistema
          : 0;
      const textosDiv =
        ic.divergencias.length > 0
          ? ic.divergencias.map((d) => `• ${d.titulo}: ${d.descricao}`).join('\n')
          : 'OK - Conciliado sem divergências';

      return [
        `${ic.itemPdf.contrato}\n(Gr: ${ic.itemPdf.grupo} / Cota: ${ic.itemPdf.cota})`,
        ic.vendaEncontrada
          ? obterNomeEmpresa(ic.vendaEncontrada.empresaId)
          : ic.vendaSugerida
          ? `Sug.: ${obterNomeEmpresa(ic.vendaSugerida.empresaId)}`
          : '—',
        ic.vendaEncontrada ? ic.vendaEncontrada.cliente : 'NÃO ENCONTRADO',
        `${ic.itemPdf.parcela}${ic.vendaEncontrada ? `/${ic.vendaEncontrada.qtdParcelas}` : ''}`,
        `${ic.itemPdf.dataVendaBr}\nSist: ${ic.dataVendaSistema ? formatarData(ic.dataVendaSistema) : '—'}`,
        `${formatarMoeda(ic.itemPdf.valorBase)}\nSist: ${ic.valorBaseSistema !== undefined ? formatarMoeda(ic.valorBaseSistema) : '—'}`,
        formatarMoeda(ic.itemPdf.valorComissao),
        ic.comissaoSistema !== undefined ? formatarMoeda(ic.comissaoSistema) : '—',
        ic.comissaoSistema !== undefined
          ? `${dif > 0 ? '+' : ''}${formatarMoeda(dif)}`
          : '—',
        textosDiv,
      ];
    });

    autoTable(doc, {
      startY: 28,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [99, 102, 241],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 7.5,
        valign: 'middle',
      },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 32 },
        3: { cellWidth: 13, halign: 'center' },
        4: { cellWidth: 24, halign: 'center' },
        5: { cellWidth: 29, halign: 'right' },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 22, halign: 'right' },
        8: { cellWidth: 20, halign: 'right' },
        9: { cellWidth: 60 },
      },
      margin: { left: 14, right: 14 },
    });

    doc.save(`conciliacao_relatorio_${numeroRelatorioInput || 'comissao'}.pdf`);
  };

  return (
    <Dialog
      open={open}
      onClose={salvando ? undefined : onClose}
      maxWidth="xl"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            bgcolor: isDark ? '#0f172a' : '#ffffff',
            backgroundImage: 'none',
            minHeight: '75vh',
            maxHeight: '92vh',
          },
        },
      }}
    >
      {/* Header do Modal */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          borderBottom: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
          bgcolor: isDark ? '#111827' : '#f8fafc',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
              color: '#fff',
              display: 'flex',
            }}
          >
            <FactCheckIcon />
          </Box>
          <Box>
            <Typography
              variant="h6"
              sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, lineHeight: 1.2 }}
            >
              Importar e Conciliar Relatório de Comissão (PDF)
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Faça upload do PDF da administradora para dar baixa automática nos contratos recebidos e auditar divergências
            </Typography>
          </Box>
        </Box>

        <IconButton onClick={onClose} disabled={salvando} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Área de Upload do PDF */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUploadArquivo(f);
            e.target.value = '';
          }}
        />

        {/* Cadastro de Relatórios PDF Importados (acesso rápido sem precisar fazer novo upload) */}
        {relatoriosSalvos.length > 0 && (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: `1px solid ${isDark ? '#1e293b' : '#cbd5e1'}`,
              bgcolor: isDark ? 'rgba(15, 23, 42, 0.75)' : '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FolderSpecialIcon sx={{ color: '#0ea5e9', fontSize: 20 }} />
                <Typography
                  variant="subtitle2"
                  sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800 }}
                >
                  Relatórios PDF Cadastrados ({relatoriosSalvos.length})
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  Selecione qualquer relatório salvo abaixo sem precisar fazer novo upload
                </Typography>
              </Box>

              <Button
                size="small"
                variant="contained"
                startIcon={<UploadFileIcon />}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
                }}
              >
                + Novo Upload PDF
              </Button>
            </Box>

            <Box
              sx={{
                display: 'flex',
                gap: 1.2,
                flexWrap: 'wrap',
                maxHeight: 135,
                overflowY: 'auto',
                pr: 0.5,
              }}
            >
              {relatoriosSalvos.map((rel) => {
                const isSelecionado = rel.id === relatorioAtivoId;
                // Conta quantos itens deste relatório já constam como recebidos no sistema
                const itensRel: ItemRelatorioPDF[] = rel.dadosPdf?.itens || [];
                const vinculosRel = rel.vinculosManuais || {};
                let recebidosCount = 0;
                for (const it of itensRel) {
                  const codNorm = normalizarCodigoContrato(it.contrato);
                  const idMan = vinculosRel[it.id];
                  const vendaMatch = idMan
                    ? vendasPrincipais.find((v) => v.id === idMan)
                    : vendasPrincipais.find(
                        (v) =>
                          normalizarCodigoContrato(v.pac) === codNorm &&
                          Math.abs((v.valorVenda || 0) - it.valorBase) < 1
                      ) ||
                      vendasPrincipais.find((v) => normalizarCodigoContrato(v.pac) === codNorm);
                  if (vendaMatch) {
                    const mesesAtivos = Object.keys(vendaMatch.projecaoMensal || {})
                      .filter((m) => (vendaMatch.projecaoMensal[m]?.valorVenda || 0) > 0)
                      .sort();
                    const mesChave = mesesAtivos[it.parcela - 1];
                    if (mesChave && vendaMatch.projecaoMensal[mesChave]?.recebida) {
                      recebidosCount += 1;
                    }
                  }
                }
                const todosRecebidos = itensRel.length > 0 && recebidosCount === itensRel.length;

                return (
                  <Paper
                    key={rel.id}
                    elevation={0}
                    onClick={() => selecionarRelatorioSalvo(rel)}
                    sx={{
                      px: 1.6,
                      py: 1,
                      borderRadius: 2,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.2,
                       transition: 'all 0.15s ease',
                      border: isSelecionado
                        ? '2px solid #0ea5e9'
                        : `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                      bgcolor: isSelecionado
                        ? isDark
                          ? 'rgba(14, 165, 233, 0.14)'
                          : 'rgba(14, 165, 233, 0.08)'
                        : isDark
                        ? '#111827'
                        : '#ffffff',
                      '&:hover': {
                        borderColor: '#0ea5e9',
                      },
                    }}
                  >
                    <PictureAsPdfIcon
                      sx={{
                        color: isSelecionado ? '#0ea5e9' : 'text.secondary',
                        fontSize: 22,
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            fontFamily: 'Outfit, sans-serif',
                            color: isSelecionado ? '#0ea5e9' : 'text.primary',
                          }}
                        >
                          Doc nº {rel.numeroDocumento || 'S/N'}
                        </Typography>
                        <Chip
                          size="small"
                          label={
                            todosRecebidos
                              ? `🔒 ${recebidosCount}/${rel.qtdItens} Recebidos`
                              : `${recebidosCount}/${rel.qtdItens} recebidos`
                          }
                          sx={{
                            height: 18,
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            bgcolor: todosRecebidos
                              ? 'rgba(16, 185, 129, 0.16)'
                              : recebidosCount > 0
                              ? 'rgba(14, 165, 233, 0.15)'
                              : isDark
                              ? 'rgba(148, 163, 184, 0.12)'
                              : 'rgba(148, 163, 184, 0.2)',
                            color: todosRecebidos
                              ? '#10b981'
                              : recebidosCount > 0
                              ? '#0ea5e9'
                              : 'text.secondary',
                          }}
                        />
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontSize: '0.68rem',
                          display: 'block',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {rel.dataGeracaoBr || formatarData(rel.dataRecebimentoInput)} · {rel.qtdItens} cotas ·{' '}
                        <strong>{formatarMoeda(rel.totalLiquido)}</strong>
                      </Typography>
                    </Box>
                    <Tooltip title="Remover este relatório do cadastro">
                      <IconButton
                        size="small"
                        onClick={(e) => handleExcluirRelatorioSalvo(rel.id, e)}
                        sx={{
                          ml: 0.5,
                          p: 0.4,
                          color: 'text.disabled',
                          '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' },
                        }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Paper>
                );
              })}
            </Box>
          </Paper>
        )}

        {!dadosPdf ? (
          <Box
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleUploadArquivo(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: `2px dashed ${isDark ? '#334155' : '#94a3b8'}`,
              borderRadius: 3,
              p: 5,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(248, 250, 252, 0.8)',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#0ea5e9',
                bgcolor: isDark ? 'rgba(14, 165, 233, 0.06)' : 'rgba(14, 165, 233, 0.04)',
              },
            }}
          >
            {carregando ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                <CircularProgress size={42} sx={{ color: '#0ea5e9' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                  Lendo e analisando os contratos do PDF...
                </Typography>
              </Box>
            ) : (
              <>
                <PictureAsPdfIcon sx={{ fontSize: 54, color: '#0ea5e9', mb: 1 }} />
                <Typography variant="h6" sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, mb: 0.5 }}>
                  Clique para selecionar ou arraste o PDF do Relatório de Comissão aqui
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
                  O relatório ficará salvo automaticamente no cadastro acima para acesso imediato sempre que precisar
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    startIcon={<UploadFileIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    sx={{
                      borderRadius: 2,
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                    }}
                  >
                    Escolher Arquivo PDF
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<ContentPasteIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMostrarColarTexto((prev) => !prev);
                    }}
                    sx={{ borderRadius: 2, fontWeight: 600 }}
                  >
                    Colar Texto do Relatório
                  </Button>
                </Box>
              </>
            )}
          </Box>
        ) : (
          /* Barra compacta de arquivo carregado + Campos do Lote */
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
              bgcolor: isDark ? '#111827' : '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Chip
                  icon={<PictureAsPdfIcon />}
                  label={nomeArquivo || 'Relatório PDF'}
                  color="info"
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
                {dadosPdf.nomePN && (
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {dadosPdf.codigoPN ? `${dadosPdf.codigoPN} · ` : ''}
                    {dadosPdf.nomePN}
                  </Typography>
                )}
                {dadosPdf.cnpj && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    CNPJ: {dadosPdf.cnpj}
                  </Typography>
                )}
                {dadosPdf.status && (
                  <Chip
                    size="small"
                    label={`Status PDF: ${dadosPdf.status}`}
                    sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                  />
                )}
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportarRelatorioDivergenciasPDF}
                  sx={{ borderRadius: 2, fontWeight: 700, fontSize: '0.76rem' }}
                >
                  Exportar Auditoria PDF
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<UploadFileIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ borderRadius: 2, fontWeight: 700, fontSize: '0.76rem' }}
                >
                  Importar Outro PDF
                </Button>
              </Box>
            </Box>

            <Divider />

            {/* Inputs de Metadados do Recebimento e Switches de Comportamento */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField
                  label="Nº do Documento / Relatório"
                  size="small"
                  required
                  value={numeroRelatorioInput}
                  onChange={(e) => {
                    setNumeroRelatorioInput(e.target.value);
                    atualizarCadastroRelatorioAtivo({ numeroDocumento: e.target.value });
                  }}
                  sx={{ width: 200 }}
                />
                <TextField
                  label="Data do Recebimento"
                  type="date"
                  size="small"
                  required
                  value={dataRelatorioInput}
                  onChange={(e) => {
                    setDataRelatorioInput(e.target.value);
                    atualizarCadastroRelatorioAtivo({ dataRecebimentoInput: e.target.value });
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ width: 175 }}
                />
                <TextField
                  label="Nota Fiscal (Opcional)"
                  size="small"
                  placeholder="Ex: NF 1042"
                  value={notaFiscalInput}
                  onChange={(e) => {
                    setNotaFiscalInput(e.target.value);
                    atualizarCadastroRelatorioAtivo({ notaFiscalInput: e.target.value });
                  }}
                  sx={{ width: 180 }}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Tooltip title="Quando a parcela estiver 'A vencer' ou 'Vencida', marca também o pagamento do cliente como 'Paga'">
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={marcarParcelaPagaAutomaticamente}
                        onChange={(e) => setMarcarParcelaPagaAutomaticamente(e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        Marcar parcela como "Paga"
                      </Typography>
                    }
                  />
                </Tooltip>

                <Tooltip title="Se houver diferença de centavos ou valor entre a comissão calculada no sistema e o valor pago no PDF, atualiza a comissão da parcela para o valor exato do PDF">
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        color="warning"
                        checked={atualizarComissaoParaValorPdf}
                        onChange={(e) => setAtualizarComissaoParaValorPdf(e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        Ajustar comissão p/ valor do PDF
                      </Typography>
                    }
                  />
                </Tooltip>

                <Tooltip title="Ao confirmar a baixa, atualiza também a Data da Venda no sistema para a data constante no relatório PDF da administradora (apenas para registros ainda não recebidos)">
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        color="info"
                        checked={corrigirDatasDivergentesAutomaticamente}
                        onChange={(e) => setCorrigirDatasDivergentesAutomaticamente(e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        Corrigir datas divergentes p/ PDF
                      </Typography>
                    }
                  />
                </Tooltip>

                {resumo.qtdDatasDivergentes > 0 && (
                  <Tooltip title="Atualiza imediatamente todas as datas de venda divergentes (de contratos ainda não recebidos) para a data constante no PDF">
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      onClick={handleCorrigirTodasDatasDivergentes}
                      sx={{
                        borderRadius: 2,
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        textTransform: 'none',
                        py: 0.4,
                        px: 1.4,
                      }}
                    >
                      Corrigir {resumo.qtdDatasDivergentes} Data(s) Divergente(s)
                    </Button>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Paper>
        )}

        {/* Área para colar texto manualmente se solicitado */}
        <Collapse in={mostrarColarTexto}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Colar conteúdo textual do Relatório de Comissão
            </Typography>
            <TextField
              multiline
              minRows={4}
              maxRows={8}
              fullWidth
              placeholder="Cole aqui o texto copiado do PDF (ex: 53637 18880 03/11/2026 COMISSÃO S/ VENDAS I 1000413312 ...)"
              value={textoManualInput}
              onChange={(e) => setTextoManualInput(e.target.value)}
              sx={{ '& .MuiInputBase-input': { fontSize: '0.78rem', fontFamily: 'monospace' } }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button size="small" onClick={() => setMostrarColarTexto(false)}>
                Fechar
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleProcessarTextoManual}
                disabled={!textoManualInput.trim()}
              >
                Processar Texto
              </Button>
            </Box>
          </Paper>
        </Collapse>

        {erroLeitura && (
          <Alert severity="error" onClose={() => setErroLeitura('')} sx={{ borderRadius: 2 }}>
            {erroLeitura}
          </Alert>
        )}

        {mensagemSucessoLocal && (
          <Alert
            severity="success"
            onClose={() => setMensagemSucessoLocal('')}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            {mensagemSucessoLocal}
          </Alert>
        )}

        {/* Cards de Resumo da Conciliação */}
        {dadosPdf && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' },
                gap: 1.5,
              }}
            >
              {/* Card 1: Total no PDF */}
              <Paper
                elevation={0}
                sx={{
                  p: 1.8,
                  borderRadius: 2,
                  border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                  bgcolor: isDark ? '#111827' : '#ffffff',
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                  Total no PDF ({resumo.totalItens} itens)
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0ea5e9', fontFamily: 'Outfit, sans-serif' }}>
                  {formatarMoeda(resumo.totalValorPdf)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  Base: {formatarMoeda(resumo.totalBasePdf)}
                </Typography>
              </Paper>

              {/* Card 2: Sem Divergências */}
              <Paper
                elevation={0}
                onClick={() => setFiltroAbas(filtroAbas === 'OK' ? 'TODOS' : 'OK')}
                sx={{
                  p: 1.8,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: `1px solid ${filtroAbas === 'OK' ? '#10b981' : isDark ? '#1e293b' : '#e2e8f0'}`,
                  bgcolor: filtroAbas === 'OK' ? 'rgba(16,185,129,0.08)' : isDark ? '#111827' : '#ffffff',
                }}
              >
                <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                  Conciliados OK
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#10b981', fontFamily: 'Outfit, sans-serif' }}>
                  {resumo.qtdOk} contrato(s)
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  100% compatíveis
                </Typography>
              </Paper>

              {/* Card 3: Com Divergências */}
              <Paper
                elevation={0}
                onClick={() => setFiltroAbas(filtroAbas === 'DIVERGENTE' ? 'TODOS' : 'DIVERGENTE')}
                sx={{
                  p: 1.8,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: `1px solid ${filtroAbas === 'DIVERGENTE' ? '#f59e0b' : isDark ? '#1e293b' : '#e2e8f0'}`,
                  bgcolor:
                    filtroAbas === 'DIVERGENTE'
                      ? 'rgba(245,158,11,0.1)'
                      : resumo.qtdDivergente > 0
                      ? 'rgba(245,158,11,0.04)'
                      : isDark
                      ? '#111827'
                      : '#ffffff',
                }}
              >
                <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                  Com Divergências
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#f59e0b', fontFamily: 'Outfit, sans-serif' }}>
                  {resumo.qtdDivergente} contrato(s)
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  Dif. Líquida: {resumo.diferencaLiquidaComissao > 0 ? '+' : ''}
                  {formatarMoeda(resumo.diferencaLiquidaComissao)}
                </Typography>
              </Paper>

              {/* Card 4: Não Encontrados */}
              <Paper
                elevation={0}
                onClick={() => setFiltroAbas(filtroAbas === 'NAO_ENCONTRADO' ? 'TODOS' : 'NAO_ENCONTRADO')}
                sx={{
                  p: 1.8,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: `1px solid ${filtroAbas === 'NAO_ENCONTRADO' ? '#ef4444' : isDark ? '#1e293b' : '#e2e8f0'}`,
                  bgcolor:
                    filtroAbas === 'NAO_ENCONTRADO'
                      ? 'rgba(239,68,68,0.1)'
                      : resumo.qtdNaoEncontrado > 0
                      ? 'rgba(239,68,68,0.04)'
                      : isDark
                      ? '#111827'
                      : '#ffffff',
                }}
              >
                <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                  Não Localizados (PAC)
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#ef4444', fontFamily: 'Outfit, sans-serif' }}>
                  {resumo.qtdNaoEncontrado} contrato(s)
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  {resumo.qtdNaoEncontrado > 0 ? 'Permite vínculo manual abaixo' : 'Todos localizados'}
                </Typography>
              </Paper>

              {/* Card 5: Selecionados para Recebimento */}
              <Paper
                elevation={0}
                sx={{
                  p: 1.8,
                  borderRadius: 2,
                  border: '1.5px solid rgba(99,102,241,0.5)',
                  bgcolor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                  Prontos p/ Dar Baixa
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#6366f1', fontFamily: 'Outfit, sans-serif' }}>
                  {formatarMoeda(resumo.valorSelecionado)}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  {resumo.qtdSelecionados} parcela(s) marcada(s)
                </Typography>
              </Paper>
            </Box>

            {/* Barra de Filtros Rápidos */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mr: 0.5 }}>
                  FILTRAR VISÃO:
                </Typography>
                {[
                  { id: 'TODOS' as const, label: `Todos (${resumo.totalItens})`, color: '#6366f1' },
                  { id: 'OK' as const, label: `Sem Divergência (${resumo.qtdOk})`, color: '#10b981' },
                  { id: 'DIVERGENTE' as const, label: `Com Divergências (${resumo.qtdDivergente})`, color: '#f59e0b' },
                  { id: 'NAO_ENCONTRADO' as const, label: `Não Encontrados (${resumo.qtdNaoEncontrado})`, color: '#ef4444' },
                  { id: 'JA_RECEBIDO' as const, label: `Já Recebidos (${resumo.qtdJaRecebido})`, color: '#0ea5e9' },
                ].map((tab) => {
                  const ativo = filtroAbas === tab.id;
                  return (
                    <Chip
                      key={tab.id}
                      label={tab.label}
                      size="small"
                      onClick={() => setFiltroAbas(tab.id)}
                      variant={ativo ? 'filled' : 'outlined'}
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        bgcolor: ativo ? tab.color : 'transparent',
                        color: ativo ? '#fff' : 'text.secondary',
                        borderColor: ativo ? tab.color : isDark ? '#334155' : '#cbd5e1',
                      }}
                    />
                  );
                })}
              </Box>

              {resumo.qtdNaoEncontrado > 0 && (
                <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 600 }}>
                  💡 Dica: Nos contratos não encontrados pelo PAC, selecione o cliente manualmente na coluna "Contrato / Cliente no Sistema" para vincular.
                </Typography>
              )}
            </Box>

            {/* Resumo e Filtro por Empresa (Vertex, Winvest, Shazam, etc.) */}
            {resumo.porEmpresa.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  flexWrap: 'wrap',
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  bgcolor: isDark ? 'rgba(15, 23, 42, 0.7)' : '#f8fafc',
                  border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', mr: 0.5 }}>
                  EMPRESAS NO RELATÓRIO:
                </Typography>
                <Chip
                  label={`Todas as Empresas (${resumo.totalItens})`}
                  size="small"
                  onClick={() => setFiltroEmpresa('TODAS')}
                  variant={filtroEmpresa === 'TODAS' ? 'filled' : 'outlined'}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.71rem',
                    cursor: 'pointer',
                    bgcolor: filtroEmpresa === 'TODAS' ? '#475569' : 'transparent',
                    color: filtroEmpresa === 'TODAS' ? '#fff' : 'text.secondary',
                    borderColor: isDark ? '#334155' : '#cbd5e1',
                  }}
                />
                {resumo.porEmpresa.map((emp) => {
                  const ativo = filtroEmpresa === emp.id;
                  const corEmp =
                    emp.id === 'emp_vertex'
                      ? '#6366f1'
                      : emp.id === 'emp_winvest'
                      ? '#0ea5e9'
                      : '#a855f7';
                  return (
                    <Chip
                      key={emp.id}
                      label={`${emp.nome}: ${emp.qtd} cota(s) · ${formatarMoeda(emp.valorComissao)}`}
                      size="small"
                      onClick={() => setFiltroEmpresa(ativo ? 'TODAS' : emp.id)}
                      variant={ativo ? 'filled' : 'outlined'}
                      sx={{
                        fontWeight: 800,
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        bgcolor: ativo ? corEmp : `${corEmp}14`,
                        color: ativo ? '#fff' : corEmp,
                        borderColor: corEmp,
                      }}
                    />
                  );
                })}
              </Box>
            )}

            {/* Tabela de Conciliação */}
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                borderRadius: 2.5,
                border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                maxHeight: 430,
              }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      padding="checkbox"
                      sx={{ bgcolor: isDark ? '#0b0f19' : '#f1f5f9', textAlign: 'center' }}
                    >
                      <Checkbox
                        size="small"
                        checked={
                          itensFiltrados.some((i) => i.podeMarcarRecebido) &&
                          itensFiltrados
                            .filter((i) => i.podeMarcarRecebido)
                            .every((i) => itensSelecionados.includes(i.itemPdf.id))
                        }
                        indeterminate={
                          itensFiltrados.some(
                            (i) => i.podeMarcarRecebido && itensSelecionados.includes(i.itemPdf.id)
                          ) &&
                          !itensFiltrados
                            .filter((i) => i.podeMarcarRecebido)
                            .every((i) => itensSelecionados.includes(i.itemPdf.id))
                        }
                        onChange={(e) => handleToggleTodosVisiveis(e.target.checked)}
                      />
                    </TableCell>
                    {[
                      'Contrato PDF / Cota',
                      'Empresa',
                      'Contrato / Cliente no Sistema',
                      'Venda (PDF vs Sist.)',
                      'Parc.',
                      'Valor Base (PDF vs Sist.)',
                      'Comissão PDF',
                      'Comissão Sistema',
                      'Status & Divergências',
                    ].map((h) => (
                      <TableCell
                        key={h}
                        sx={{
                          bgcolor: isDark ? '#0b0f19' : '#f1f5f9',
                          fontWeight: 800,
                          fontSize: '0.68rem',
                          textTransform: 'uppercase',
                          color: 'text.secondary',
                          letterSpacing: '0.4px',
                          whiteSpace: 'nowrap',
                          py: 1,
                        }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {itensFiltrados.map((ic) => {
                    const { itemPdf, vendaEncontrada, vendaSugerida, divergencias, statusConciliacao } = ic;
                    const isChecked = itensSelecionados.includes(itemPdf.id);
                    const temDivValorComissao = divergencias.some(
                      (d) => d.tipo === 'VALOR_COMISSAO_DIVERGENTE'
                    );
                    const temDivValorBase = divergencias.some(
                      (d) => d.tipo === 'VALOR_BASE_DIVERGENTE'
                    );
                    const temDivDataVenda = divergencias.some(
                      (d) => d.tipo === 'DATA_VENDA_DIVERGENTE'
                    );

                    const bgRow =
                      ic.jaRecebidaSistema
                        ? isDark
                          ? 'rgba(16, 185, 129, 0.06)'
                          : 'rgba(16, 185, 129, 0.04)'
                        : statusConciliacao === 'NAO_ENCONTRADO'
                        ? isDark
                          ? 'rgba(239, 68, 68, 0.06)'
                          : 'rgba(239, 68, 68, 0.04)'
                        : statusConciliacao === 'DIVERGENTE'
                        ? isDark
                          ? 'rgba(245, 158, 11, 0.06)'
                          : 'rgba(245, 158, 11, 0.04)'
                        : 'transparent';

                    return (
                      <TableRow key={itemPdf.id} hover sx={{ bgcolor: bgRow }}>
                        <TableCell padding="checkbox" sx={{ textAlign: 'center' }}>
                          {ic.jaRecebidaSistema ? (
                            <Tooltip
                              title="Registro já marcado como recebido — bloqueado para alterações pelo modal do PDF"
                              arrow
                            >
                              <Box
                                sx={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#10b981',
                                  p: 0.5,
                                }}
                              >
                                <LockIcon sx={{ fontSize: 17 }} />
                              </Box>
                            </Tooltip>
                          ) : (
                            <Checkbox
                              size="small"
                              disabled={!ic.podeMarcarRecebido}
                              checked={isChecked}
                              onChange={() => handleToggleItem(itemPdf.id)}
                            />
                          )}
                        </TableCell>

                        {/* Contrato PDF / Grupo / Cota */}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.8rem', fontFamily: 'Outfit, sans-serif' }}>
                            {itemPdf.contrato}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.66rem', display: 'block' }}>
                            Gr: {itemPdf.grupo} · Cota: {itemPdf.cota}
                          </Typography>
                        </TableCell>

                        {/* Empresa do Contrato */}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {vendaEncontrada ? (
                            <Chip
                              label={obterNomeEmpresa(vendaEncontrada.empresaId)}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                bgcolor:
                                  (vendaEncontrada.empresaId || 'emp_vertex') === 'emp_vertex'
                                    ? 'rgba(99, 102, 241, 0.15)'
                                    : vendaEncontrada.empresaId === 'emp_winvest'
                                    ? 'rgba(14, 165, 233, 0.15)'
                                    : 'rgba(168, 85, 247, 0.15)',
                                color:
                                  (vendaEncontrada.empresaId || 'emp_vertex') === 'emp_vertex'
                                    ? '#6366f1'
                                    : vendaEncontrada.empresaId === 'emp_winvest'
                                    ? '#0ea5e9'
                                    : '#a855f7',
                                border: `1px solid ${
                                  (vendaEncontrada.empresaId || 'emp_vertex') === 'emp_vertex'
                                    ? 'rgba(99, 102, 241, 0.35)'
                                    : vendaEncontrada.empresaId === 'emp_winvest'
                                    ? 'rgba(14, 165, 233, 0.35)'
                                    : 'rgba(168, 85, 247, 0.35)'
                                }`,
                              }}
                            />
                          ) : vendaSugerida ? (
                            <Tooltip title={`Empresa da venda sugerida (${vendaSugerida.cliente})`}>
                              <Chip
                                label={`Sug.: ${obterNomeEmpresa(vendaSugerida.empresaId)}`}
                                size="small"
                                variant="outlined"
                                sx={{
                                  height: 21,
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  borderStyle: 'dashed',
                                  color: '#0ea5e9',
                                  borderColor: '#0ea5e9',
                                }}
                              />
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                              Não identificada
                            </Typography>
                          )}
                        </TableCell>

                        {/* Cliente no Sistema (ou seletor de vínculo manual — bloqueado se já recebido) */}
                        <TableCell sx={{ minWidth: 250 }}>
                          {vendaEncontrada && (ic.jaRecebidaSistema || !ic.vinculoManual) ? (
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>
                                  {vendaEncontrada.cliente}
                                </Typography>
                                {ic.jaRecebidaSistema && (
                                  <Tooltip title="Recebido e bloqueado para alterações">
                                    <LockIcon sx={{ fontSize: 13, color: '#10b981' }} />
                                  </Tooltip>
                                )}
                              </Box>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.66rem' }}>
                                PAC: {vendaEncontrada.pac || '—'} · Vend: {vendaEncontrada.vendedorNome || '—'} · {vendaEncontrada.tabela}
                              </Typography>
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                              <Autocomplete
                                size="small"
                                disabled={!!ic.jaRecebidaSistema}
                                options={vendasPrincipais}
                                value={vendaEncontrada}
                                getOptionLabel={(opt) =>
                                  `[${obterNomeEmpresa(opt.empresaId)}] ${opt.cliente} ${opt.pac ? `(PAC: ${opt.pac})` : '(Sem PAC)'} - ${formatarMoeda(opt.valorVenda)}`
                                }
                                onChange={(_, novaVenda) =>
                                  handleVincularContratoManual(itemPdf.id, novaVenda)
                                }
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    placeholder="Vincular a contrato do sistema..."
                                    size="small"
                                    sx={{
                                      '& .MuiInputBase-root': {
                                        fontSize: '0.74rem',
                                        py: 0.2,
                                      },
                                    }}
                                  />
                                )}
                              />
                              {!vendaEncontrada && vendaSugerida && !ic.jaRecebidaSistema && (
                                <Button
                                  size="small"
                                  variant="text"
                                  startIcon={<LinkIcon sx={{ fontSize: 13 }} />}
                                  onClick={() => handleVincularContratoManual(itemPdf.id, vendaSugerida)}
                                  sx={{
                                    justifyContent: 'flex-start',
                                    p: 0,
                                    fontSize: '0.68rem',
                                    color: '#0ea5e9',
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    textAlign: 'left',
                                  }}
                                >
                                  Sugestão: Vincular a {vendaSugerida.cliente} [{obterNomeEmpresa(vendaSugerida.empresaId)} · PAC {vendaSugerida.pac || 'S/N'} · {formatarData(vendaSugerida.dataVenda)} · {formatarMoeda(vendaSugerida.valorVenda)}]
                                </Button>
                              )}
                            </Box>
                          )}
                        </TableCell>

                        {/* Data da Venda */}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: '0.75rem',
                              fontWeight: temDivDataVenda ? 700 : 500,
                              color: temDivDataVenda ? '#f59e0b' : 'text.primary',
                            }}
                          >
                            {itemPdf.dataVendaBr}
                          </Typography>
                          {ic.dataVendaSistema && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: temDivDataVenda ? '#f59e0b' : 'text.secondary',
                                fontWeight: temDivDataVenda ? 700 : 500,
                                fontSize: '0.65rem',
                                display: 'block',
                              }}
                            >
                              Sist: {formatarData(ic.dataVendaSistema)}
                            </Typography>
                          )}
                          {temDivDataVenda &&
                            !ic.jaRecebidaSistema &&
                            vendaEncontrada &&
                            itemPdf.dataVendaISO && (
                              <Button
                                size="small"
                                variant="text"
                                onClick={() =>
                                  handleCorrigirDataVendaIndividual(
                                    vendaEncontrada,
                                    itemPdf.dataVendaISO,
                                    ic.jaRecebidaSistema
                                  )
                                }
                                sx={{
                                  p: 0,
                                  mt: 0.2,
                                  minWidth: 'auto',
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  color: '#0ea5e9',
                                  textTransform: 'none',
                                  '&:hover': {
                                    textDecoration: 'underline',
                                    bgcolor: 'transparent',
                                  },
                                }}
                              >
                                Corrigir p/ {itemPdf.dataVendaBr}
                              </Button>
                            )}
                        </TableCell>

                        {/* Parcela */}
                        <TableCell sx={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <Chip
                            size="small"
                            label={
                              vendaEncontrada
                                ? `${itemPdf.parcela}/${vendaEncontrada.qtdParcelas}`
                                : `${itemPdf.parcela}ª`
                            }
                            sx={{
                              height: 20,
                              fontWeight: 800,
                              fontSize: '0.7rem',
                              bgcolor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
                              color: '#6366f1',
                            }}
                          />
                        </TableCell>

                        {/* Valor Base (Crédito) */}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              color: temDivValorBase ? '#f59e0b' : 'text.primary',
                            }}
                          >
                            {formatarMoeda(itemPdf.valorBase)}
                          </Typography>
                          {ic.valorBaseSistema !== undefined && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: temDivValorBase ? '#f59e0b' : 'text.secondary',
                                fontWeight: temDivValorBase ? 700 : 500,
                                fontSize: '0.65rem',
                                display: 'block',
                              }}
                            >
                              Sist: {formatarMoeda(ic.valorBaseSistema)}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Comissão PDF */}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 800, fontSize: '0.8rem', color: '#0ea5e9' }}
                          >
                            {formatarMoeda(itemPdf.valorComissao)}
                          </Typography>
                        </TableCell>

                        {/* Comissão Sistema */}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {ic.comissaoSistema !== undefined ? (
                            <Box>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 800,
                                  fontSize: '0.8rem',
                                  color: temDivValorComissao ? '#f59e0b' : '#10b981',
                                }}
                              >
                                {formatarMoeda(ic.comissaoSistema)}
                              </Typography>
                              {temDivValorComissao && (
                                <Typography
                                  variant="caption"
                                  sx={{ color: '#ef4444', fontWeight: 700, fontSize: '0.65rem', display: 'block' }}
                                >
                                  Dif: {itemPdf.valorComissao - ic.comissaoSistema > 0 ? '+' : ''}
                                  {formatarMoeda(itemPdf.valorComissao - ic.comissaoSistema)}
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                              —
                            </Typography>
                          )}
                        </TableCell>

                        {/* Status & Divergências */}
                        <TableCell sx={{ minWidth: 260 }}>
                          {divergencias.length === 0 ? (
                            <Chip
                              size="small"
                              icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                              label="Conciliado sem divergências"
                              sx={{
                                bgcolor: 'rgba(16, 185, 129, 0.12)',
                                color: '#10b981',
                                fontWeight: 700,
                                fontSize: '0.7rem',
                              }}
                            />
                          ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.3 }}>
                              {divergencias.map((div, idx) => {
                                const isJaRec = div.tipo === 'PARCELA_JA_RECEBIDA';
                                const cor = isJaRec
                                  ? '#10b981'
                                  : div.severidade === 'error'
                                  ? '#ef4444'
                                  : div.severidade === 'warning'
                                  ? '#f59e0b'
                                  : '#0ea5e9';
                                const bg = isJaRec
                                  ? 'rgba(16,185,129,0.14)'
                                  : div.severidade === 'error'
                                  ? 'rgba(239,68,68,0.12)'
                                  : div.severidade === 'warning'
                                  ? 'rgba(245,158,11,0.12)'
                                  : 'rgba(14,165,233,0.12)';
                                const Icone = isJaRec
                                  ? LockIcon
                                  : div.severidade === 'error'
                                  ? CancelIcon
                                  : div.severidade === 'warning'
                                  ? WarningAmberIcon
                                  : InfoOutlinedIcon;

                                return (
                                  <Tooltip key={idx} title={div.descricao} arrow placement="left">
                                    <Box
                                      sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 0.6,
                                        px: 1,
                                        py: 0.3,
                                        borderRadius: 1.5,
                                        bgcolor: bg,
                                        color: cor,
                                        border: `1px solid ${cor}33`,
                                        width: 'fit-content',
                                      }}
                                    >
                                      <Icone sx={{ fontSize: 13, flexShrink: 0 }} />
                                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, lineHeight: 1.2 }}>
                                        {div.titulo}
                                      </Typography>
                                      {div.tipo === 'DATA_VENDA_DIVERGENTE' &&
                                        !ic.jaRecebidaSistema &&
                                        vendaEncontrada &&
                                        itemPdf.dataVendaISO && (
                                          <Button
                                            size="small"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleCorrigirDataVendaIndividual(
                                                vendaEncontrada,
                                                itemPdf.dataVendaISO,
                                                ic.jaRecebidaSistema
                                              );
                                            }}
                                            sx={{
                                              ml: 0.5,
                                              px: 0.7,
                                              py: 0.1,
                                              minWidth: 'auto',
                                              height: 18,
                                              fontSize: '0.62rem',
                                              fontWeight: 800,
                                              textTransform: 'none',
                                              borderRadius: 1,
                                              bgcolor: '#0ea5e9',
                                              color: '#fff',
                                              '&:hover': { bgcolor: '#0284c7' },
                                            }}
                                          >
                                            Corrigir
                                          </Button>
                                        )}
                                    </Box>
                                  </Tooltip>
                                );
                              })}
                            </Box>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>

      {/* Rodapé com Ações */}
      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
          bgcolor: isDark ? '#111827' : '#f8fafc',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Box>
          {dadosPdf && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {resumo.qtdJaRecebido > 0 && (
                <span style={{ color: '#10b981', fontWeight: 700, marginRight: 10 }}>
                  🔒 {resumo.qtdJaRecebido} já recebido(s) e bloqueado(s) ·
                </span>
              )}
              {resumo.qtdSelecionados} de {resumo.totalItens} parcela(s) selecionada(s) para baixa · Total Selecionado:{' '}
              <strong style={{ color: '#10b981' }}>{formatarMoeda(resumo.valorSelecionado)}</strong>
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            onClick={onClose}
            disabled={salvando}
            variant="outlined"
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            Fechar
          </Button>
          {dadosPdf && (
            <Button
              onClick={handleConfirmarBaixaEmLote}
              disabled={
                salvando ||
                resumo.qtdSelecionados === 0 ||
                !numeroRelatorioInput.trim() ||
                !dataRelatorioInput
              }
              variant="contained"
              startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                px: 3,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                },
              }}
            >
              {salvando
                ? 'Processando Baixas...'
                : resumo.qtdSelecionados === 0 && resumo.qtdJaRecebido === resumo.totalItens
                ? 'Todos os Registros Já Recebidos (Bloqueados)'
                : `Marcar ${resumo.qtdSelecionados} Parcela(s) como Recebida`}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};
