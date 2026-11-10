import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Dialog,
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
import DeleteIcon from '@mui/icons-material/Delete';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import BusinessIcon from '@mui/icons-material/Business';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import type {
  LancamentoVenda,
  StatusParcela,
  Empresa,
  RelatorioComissaoSalvo,
  AjustesPendentesRelatorioPDF,
} from '../types';
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
  comissaoSistemaOriginal?: number;
  comissaoSistema?: number;
  valorBaseSistemaOriginal?: number;
  valorBaseSistema?: number;
  dataVendaSistemaOriginal?: string;
  dataVendaSistema?: string;
  dataAjustadaPendente?: boolean;
  comissaoAjustadaPendente?: boolean;
  baseAjustadaPendente?: boolean;
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
  embedded?: boolean;
}

export const ImportarRelatorioComissaoModal: React.FC<ImportarRelatorioComissaoModalProps> = ({
  open,
  onClose,
  vendas,
  empresas = [],
  onAtualizarVenda,
  onSucesso,
  embedded = false,
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

  const obterCorEmpresa = (empresaId?: string): string => {
    const id = empresaId || 'emp_vertex';
    if (id === 'emp_vertex') return '#6366f1';
    if (id === 'emp_winvest') return '#0ea5e9';
    if (id === 'emp_shazam') return '#a855f7';
    return '#10b981';
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
  const [vendasAtualizadasSessao, setVendasAtualizadasSessao] = useState<
    Record<string, LancamentoVenda>
  >({});

  // Campos editáveis para o lote de recebimento
  const [numeroRelatorioInput, setNumeroRelatorioInput] = useState<string>('');
  const [dataRelatorioInput, setDataRelatorioInput] = useState<string>('');
  const [notaFiscalInput, setNotaFiscalInput] = useState<string>('');

  // Opções globais de conciliação em rascunho (só salvas no banco ao clicar em "Receber Parcelas")
  const [atualizarComissaoParaValorPdf, setAtualizarComissaoParaValorPdf] = useState<boolean>(false);
  const [marcarParcelaPagaAutomaticamente, setMarcarParcelaPagaAutomaticamente] =
    useState<boolean>(true);
  const [corrigirDatasDivergentesAutomaticamente, setCorrigirDatasDivergentesAutomaticamente] =
    useState<boolean>(false);

  // Ajustes de divergências em rascunho (só efetivados no banco ao clicar em "Receber Parcelas")
  const [ajustesPendentes, setAjustesPendentes] = useState<AjustesPendentesRelatorioPDF>({
    datasAjustadas: {},
    comissoesAjustadas: {},
    valoresBaseAjustados: {},
    divergenciasAceitas: {},
  });

  // Vínculos manuais (itemPdf.id -> venda.id)
  const [vinculosManuais, setVinculosManuais] = useState<Record<string, string>>({});

  // Seleção de linhas para baixa
  const [itensSelecionados, setItensSelecionados] = useState<string[]>([]);

  // Filtro visual das linhas
  const [filtroAbas, setFiltroAbas] = useState<
    'TODOS' | 'OK' | 'DIVERGENTE' | 'NAO_ENCONTRADO' | 'JA_RECEBIDO'
  >('TODOS');
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('TODAS');

  // Modo colar texto manual
  const [mostrarColarTexto, setMostrarColarTexto] = useState(false);
  const [textoManualInput, setTextoManualInput] = useState('');

  // Vendas reais (não espelho) para conciliação direta, abrangendo todas as empresas (Vertex, Winvest, Shazam)
  const vendasPrincipais = useMemo(() => {
    const mapa = new Map<string, LancamentoVenda>();
    for (const v of vendas) {
      if (v && v.id && !v.isVendaEspelho) {
        mapa.set(v.id, vendasAtualizadasSessao[v.id] || v);
      }
    }
    try {
      const salvas = localStorage.getItem('apex_lancamentos_vendas');
      if (salvas) {
        const todas: LancamentoVenda[] = JSON.parse(salvas);
        for (const v of todas) {
          if (v && v.id && !v.isVendaEspelho && !mapa.has(v.id)) {
            mapa.set(v.id, vendasAtualizadasSessao[v.id] || v);
          }
        }
      }
    } catch {
      // Ignora erro de leitura do localStorage
    }
    for (const [idSessao, vSessao] of Object.entries(vendasAtualizadasSessao)) {
      if (!vSessao.isVendaEspelho) {
        mapa.set(idSessao, vSessao);
      }
    }
    return Array.from(mapa.values());
  }, [vendas, open, vendasAtualizadasSessao]);

  // Verifica o status (Processado vs Não Processado) de qualquer relatório salvo
  const obterStatusRelatorioSalvo = (rel: RelatorioComissaoSalvo) => {
    const itensRel: ItemRelatorioPDF[] = rel.dadosPdf?.itens || [];
    const vinculosRel = rel.vinculosManuais || {};
    let recebidosCount = 0;

    for (const it of itensRel) {
      const codNorm = normalizarCodigoContrato(it.contrato);
      const idMan = vinculosRel[it.id];
      let vendaMatch: LancamentoVenda | undefined;
      if (idMan) {
        vendaMatch = vendasPrincipais.find((v) => v.id === idMan);
      } else {
        const candidatas = vendasPrincipais.filter(
          (v) =>
            normalizarCodigoContrato(v.pac) === codNorm ||
            (v.pac && v.pac.trim().toLowerCase() === it.contrato.trim().toLowerCase())
        );
        if (candidatas.length === 1) {
          vendaMatch = candidatas[0];
        } else if (candidatas.length > 1) {
          vendaMatch = [...candidatas].sort((a, b) => {
            const sA =
              (Math.abs((a.valorVenda || 0) - it.valorBase) < 1 ? 100 : 0) +
              (a.dataVenda === it.dataVendaISO ? 50 : 0);
            const sB =
              (Math.abs((b.valorVenda || 0) - it.valorBase) < 1 ? 100 : 0) +
              (b.dataVenda === it.dataVendaISO ? 50 : 0);
            return sB - sA;
          })[0];
        }
      }
      if (vendaMatch) {
        const mesesAtivos = Object.keys(vendaMatch.projecaoMensal || {})
          .filter((m) => (vendaMatch!.projecaoMensal[m]?.valorVenda || 0) > 0)
          .sort();
        const mesChave = mesesAtivos[it.parcela - 1];
        if (mesChave && vendaMatch.projecaoMensal[mesChave]?.recebida) {
          recebidosCount += 1;
        }
      }
    }

    const todosRecebidos = itensRel.length > 0 && recebidosCount === itensRel.length;
    const isProcessado = !!rel.processado || todosRecebidos;

    return {
      isProcessado,
      recebidosCount,
      totalItens: itensRel.length,
    };
  };

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

  // Carrega um relatório PDF salvo da barra lateral
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
    setAjustesPendentes(
      rel.ajustesPendentes || {
        datasAjustadas: {},
        comissoesAjustadas: {},
        valoresBaseAjustados: {},
        divergenciasAceitas: {},
      }
    );
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

  // Recalcula seleção quando as vendas mudam para garantir que todos os itens conciliados e ainda não recebidos fiquem marcados
  useEffect(() => {
    if (!dadosPdf) return;
    setItensSelecionados(calcularSelecaoInicial(dadosPdf, vinculosManuais));
  }, [vendasPrincipais, vinculosManuais]);

  const relatorioAtivoObj = useMemo(
    () => relatoriosSalvos.find((r) => r.id === relatorioAtivoId) || null,
    [relatoriosSalvos, relatorioAtivoId]
  );

  // Sincroniza metadados, vínculos e ajustes em rascunho no cadastro persistente do relatório
  const atualizarCadastroRelatorioAtivo = (
    camposParciais: Partial<
      Pick<
        RelatorioComissaoSalvo,
        | 'numeroDocumento'
        | 'dataRecebimentoInput'
        | 'notaFiscalInput'
        | 'vinculosManuais'
        | 'ajustesPendentes'
        | 'processado'
        | 'dataProcessamento'
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

  // Processa os itens do PDF cruzando com as vendas do sistema e aplicando os ajustes em rascunho
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
            ? `PAC ${item.contrato} não cadastrado. Possível correspondência: ${vendaSugerida.cliente} (${obterNomeEmpresa(vendaSugerida.empresaId)} · PAC: ${vendaSugerida.pac || 'Sem PAC'} · Venda: ${formatarData(vendaSugerida.dataVenda)} · ${formatarMoeda(vendaSugerida.valorVenda)}).`
            : `Nenhum contrato com PAC "${item.contrato}" foi encontrado no sistema. Vincule manualmente ao cliente correspondente.`,
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
      const comissaoSistemaOriginal = Number((celula.comissaoGerada || 0).toFixed(2));
      const valorBaseSistemaOriginal = Number((vendaEncontrada.valorVenda || 0).toFixed(2));
      const dataVendaSistemaOriginal = vendaEncontrada.dataVenda || '';
      const jaRecebida = !!celula.recebida;

      // Valores efetivos considerando os ajustes em rascunho (só salvos ao clicar em Receber Parcelas)
      const dataAjustadaISO = corrigirDatasDivergentesAutomaticamente
        ? item.dataVendaISO
        : ajustesPendentes.datasAjustadas?.[item.id];
      const dataVendaSistema = dataAjustadaISO || dataVendaSistemaOriginal;
      const dataAjustadaPendente =
        !jaRecebida &&
        !!dataAjustadaISO &&
        dataAjustadaISO !== dataVendaSistemaOriginal;

      const comissaoAjustadaVal = atualizarComissaoParaValorPdf
        ? item.valorComissao
        : ajustesPendentes.comissoesAjustadas?.[item.id];
      const comissaoSistema =
        comissaoAjustadaVal !== undefined ? comissaoAjustadaVal : comissaoSistemaOriginal;
      const comissaoAjustadaPendente =
        !jaRecebida &&
        comissaoAjustadaVal !== undefined &&
        Math.abs(comissaoAjustadaVal - comissaoSistemaOriginal) > 0.05;

      const baseAjustadaVal = ajustesPendentes.valoresBaseAjustados?.[item.id];
      const valorBaseSistema =
        baseAjustadaVal !== undefined ? baseAjustadaVal : valorBaseSistemaOriginal;
      const baseAjustadaPendente =
        !jaRecebida &&
        baseAjustadaVal !== undefined &&
        Math.abs(baseAjustadaVal - valorBaseSistemaOriginal) > 0.05;

      // Se a parcela já está marcada como recebida, não aponta divergências pendentes e bloqueia edição
      if (jaRecebida) {
        divergencias.push({
          tipo: 'PARCELA_JA_RECEBIDA',
          severidade: 'info',
          titulo: '🔒 Recebido (Bloqueado p/ alteração)',
          descricao: `Parcela já marcada como recebida${celula.numeroRelatorioRecebimento ? ` no Relatório nº ${celula.numeroRelatorioRecebimento}` : ''}${celula.dataRelatorioRecebimento ? ` em ${formatarData(celula.dataRelatorioRecebimento)}` : ''}.`,
          valorPdf: `Doc ${item.numDoc}`,
          valorSistema: celula.numeroRelatorioRecebimento
            ? `Doc ${celula.numeroRelatorioRecebimento}`
            : 'Recebida',
        });

        return {
          itemPdf: item,
          vendaEncontrada,
          vendaSugerida: null,
          vinculoManual,
          mesChaveParcela,
          statusParcelaSistema: statusEfetivo,
          jaRecebidaSistema: true,
          comissaoSistemaOriginal,
          comissaoSistema: comissaoSistemaOriginal,
          valorBaseSistemaOriginal,
          valorBaseSistema: valorBaseSistemaOriginal,
          dataVendaSistemaOriginal,
          dataVendaSistema: dataVendaSistemaOriginal,
          divergencias,
          statusConciliacao: 'JA_RECEBIDO',
          podeMarcarRecebido: false,
        };
      }

      // 1. Verifica divergência de Valor da Comissão (se ainda não ajustada/aceita no rascunho)
      const difComissao = Number((item.valorComissao - comissaoSistema).toFixed(2));
      const comissaoAceita = !!ajustesPendentes.divergenciasAceitas?.[`${item.id}_COMISSAO`];
      if (Math.abs(difComissao) > 0.05 && !comissaoAceita) {
        divergencias.push({
          tipo: 'VALOR_COMISSAO_DIVERGENTE',
          severidade: 'warning',
          titulo: 'Comissão divergente',
          descricao: `Comissão no PDF (${formatarMoeda(item.valorComissao)}) difere do valor no sistema (${formatarMoeda(comissaoSistemaOriginal)}). Diferença: ${difComissao > 0 ? '+' : ''}${formatarMoeda(difComissao)}.`,
          valorPdf: formatarMoeda(item.valorComissao),
          valorSistema: formatarMoeda(comissaoSistemaOriginal),
          diferencaValor: difComissao,
        });
      }

      // 2. Verifica divergência de Valor Base (Crédito da Cota)
      const difBase = Number((item.valorBase - valorBaseSistema).toFixed(2));
      const baseAceita = !!ajustesPendentes.divergenciasAceitas?.[`${item.id}_BASE`];
      if (Math.abs(difBase) > 0.05 && !baseAceita) {
        divergencias.push({
          tipo: 'VALOR_BASE_DIVERGENTE',
          severidade: 'warning',
          titulo: 'Valor Base (Crédito) divergente',
          descricao: `Valor Base no PDF (${formatarMoeda(item.valorBase)}) difere do Valor da Cota no sistema (${formatarMoeda(valorBaseSistemaOriginal)}). Diferença: ${difBase > 0 ? '+' : ''}${formatarMoeda(difBase)}.`,
          valorPdf: formatarMoeda(item.valorBase),
          valorSistema: formatarMoeda(valorBaseSistemaOriginal),
          diferencaValor: difBase,
        });
      }

      // 3. Verifica divergência de Data da Venda
      const dataAceita = !!ajustesPendentes.divergenciasAceitas?.[`${item.id}_DATA`];
      if (
        dataVendaSistema &&
        item.dataVendaISO &&
        dataVendaSistema !== item.dataVendaISO &&
        !dataAceita
      ) {
        divergencias.push({
          tipo: 'DATA_VENDA_DIVERGENTE',
          severidade: 'warning',
          titulo: 'Data da Venda divergente',
          descricao: `Data da venda no PDF (${item.dataVendaBr}) difere da cadastrada no sistema (${formatarData(dataVendaSistemaOriginal)}).`,
          valorPdf: item.dataVendaBr,
          valorSistema: formatarData(dataVendaSistemaOriginal),
        });
      }

      // 4. Verifica se o contrato ou parcela está Cancelado/Estornado
      const isCancelado =
        vendaEncontrada.statusCliente === 'Cancelado' ||
        statusEfetivo === 'Cancelada' ||
        statusEfetivo === 'Estornada';
      const canceladoAceito = !!ajustesPendentes.divergenciasAceitas?.[`${item.id}_CANCELADO`];

      if (isCancelado && !canceladoAceito) {
        divergencias.push({
          tipo: 'CONTRATO_CANCELADO',
          severidade: 'error',
          titulo: 'Contrato/Parcela Cancelada',
          descricao: `Esta parcela consta como "${statusEfetivo}" (Cliente: ${vendaEncontrada.statusCliente}) no sistema, mas está sendo paga no relatório.`,
          valorPdf: 'Comissão Ativa',
          valorSistema: statusEfetivo,
        });
      }

      const temDivergenciaPendente = divergencias.some(
        (d) =>
          d.tipo === 'VALOR_COMISSAO_DIVERGENTE' ||
          d.tipo === 'VALOR_BASE_DIVERGENTE' ||
          d.tipo === 'DATA_VENDA_DIVERGENTE' ||
          d.tipo === 'CONTRATO_CANCELADO'
      );

      const statusConciliacao: ItemConciliacao['statusConciliacao'] = temDivergenciaPendente
        ? 'DIVERGENTE'
        : 'OK';

      return {
        itemPdf: item,
        vendaEncontrada,
        vendaSugerida: null,
        vinculoManual,
        mesChaveParcela,
        statusParcelaSistema: statusEfetivo,
        jaRecebidaSistema: false,
        comissaoSistemaOriginal,
        comissaoSistema,
        valorBaseSistemaOriginal,
        valorBaseSistema,
        dataVendaSistemaOriginal,
        dataVendaSistema,
        dataAjustadaPendente,
        comissaoAjustadaPendente,
        baseAjustadaPendente,
        divergencias,
        statusConciliacao,
        podeMarcarRecebido: !isCancelado || canceladoAceito,
      };
    });
  }, [
    dadosPdf,
    vendasPrincipais,
    vinculosManuais,
    ajustesPendentes,
    corrigirDatasDivergentesAutomaticamente,
    atualizarComissaoParaValorPdf,
  ]);

  // Inicializa seleção padrão e cadastra/atualiza o relatório PDF na barra lateral
  const aplicarDadosExtraidos = async (dados: DadosRelatorioPDF, origemNome: string) => {
    const numDoc = dados.numeroDocumento || dados.itens[0]?.numDoc || 'S/N';
    const dataRec =
      dados.itens[0]?.dataRelatorioISO ||
      dados.dataGeracaoISO ||
      new Date().toISOString().split('T')[0];

    const existente = relatoriosSalvos.find(
      (r) =>
        (numDoc !== 'S/N' && r.numeroDocumento === numDoc) ||
        (r.nomeArquivo === origemNome && Math.abs(r.totalLiquido - (dados.totalLiquido ?? 0)) < 0.05)
    );

    const vinculosIniciais = existente?.vinculosManuais || {};
    const ajustesIniciais: AjustesPendentesRelatorioPDF = existente?.ajustesPendentes || {
      datasAjustadas: {},
      comissoesAjustadas: {},
      valoresBaseAjustados: {},
      divergenciasAceitas: {},
    };
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
    setAjustesPendentes(ajustesIniciais);
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
      ajustesPendentes: ajustesIniciais,
      processado: existente?.processado || false,
      dataProcessamento: existente?.dataProcessamento,
      createdAt: existente?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const listaAtualizada = await salvarRelatorioPdfSupabase(novoCadastro);
    setRelatoriosSalvos(listaAtualizada);
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

  // Funções de ajuste em rascunho (NÃO alteram o banco até clicar em "Receber Parcelas")
  const handleAjustarDataRascunho = (itemId: string, novaDataISO: string, jaRecebida?: boolean) => {
    if (jaRecebida || !novaDataISO) return;
    setAjustesPendentes((prev) => {
      const novo: AjustesPendentesRelatorioPDF = {
        ...prev,
        datasAjustadas: { ...(prev.datasAjustadas || {}), [itemId]: novaDataISO },
      };
      atualizarCadastroRelatorioAtivo({ ajustesPendentes: novo });
      return novo;
    });
  };

  const handleAjustarComissaoRascunho = (
    itemId: string,
    novoValorComissao: number,
    jaRecebida?: boolean
  ) => {
    if (jaRecebida) return;
    setAjustesPendentes((prev) => {
      const novo: AjustesPendentesRelatorioPDF = {
        ...prev,
        comissoesAjustadas: { ...(prev.comissoesAjustadas || {}), [itemId]: novoValorComissao },
      };
      atualizarCadastroRelatorioAtivo({ ajustesPendentes: novo });
      return novo;
    });
  };

  const handleAjustarValorBaseRascunho = (
    itemId: string,
    novoValorBase: number,
    jaRecebida?: boolean
  ) => {
    if (jaRecebida) return;
    setAjustesPendentes((prev) => {
      const novo: AjustesPendentesRelatorioPDF = {
        ...prev,
        valoresBaseAjustados: { ...(prev.valoresBaseAjustados || {}), [itemId]: novoValorBase },
      };
      atualizarCadastroRelatorioAtivo({ ajustesPendentes: novo });
      return novo;
    });
  };

  const handleAceitarDivergenciaMantendoSistema = (
    chaveDivergencia: string,
    jaRecebida?: boolean
  ) => {
    if (jaRecebida) return;
    setAjustesPendentes((prev) => {
      const novo: AjustesPendentesRelatorioPDF = {
        ...prev,
        divergenciasAceitas: {
          ...(prev.divergenciasAceitas || {}),
          [chaveDivergencia]: true,
        },
      };
      atualizarCadastroRelatorioAtivo({ ajustesPendentes: novo });
      return novo;
    });
  };

  // Resolve todas as divergências pendentes em rascunho (datas, comissões, valores base e vínculos sugeridos)
  const handleResolverTodasDivergenciasRascunho = () => {
    const novasDatas = { ...(ajustesPendentes.datasAjustadas || {}) };
    const novasComissoes = { ...(ajustesPendentes.comissoesAjustadas || {}) };
    const novasBases = { ...(ajustesPendentes.valoresBaseAjustados || {}) };
    const novosAceites = { ...(ajustesPendentes.divergenciasAceitas || {}) };
    const novosVinculos = { ...vinculosManuais };

    for (const ic of itensConciliados) {
      if (ic.jaRecebidaSistema) continue;
      const id = ic.itemPdf.id;

      if (!ic.vendaEncontrada && ic.vendaSugerida) {
        novosVinculos[id] = ic.vendaSugerida.id;
      }

      for (const div of ic.divergencias) {
        if (div.tipo === 'DATA_VENDA_DIVERGENTE' && ic.itemPdf.dataVendaISO) {
          novasDatas[id] = ic.itemPdf.dataVendaISO;
        } else if (div.tipo === 'VALOR_COMISSAO_DIVERGENTE') {
          novasComissoes[id] = ic.itemPdf.valorComissao;
        } else if (div.tipo === 'VALOR_BASE_DIVERGENTE') {
          novasBases[id] = ic.itemPdf.valorBase;
        } else if (div.tipo === 'CONTRATO_CANCELADO') {
          novosAceites[`${id}_CANCELADO`] = true;
        }
      }
    }

    const novoAjustes: AjustesPendentesRelatorioPDF = {
      datasAjustadas: novasDatas,
      comissoesAjustadas: novasComissoes,
      valoresBaseAjustados: novasBases,
      divergenciasAceitas: novosAceites,
    };

    setVinculosManuais(novosVinculos);
    setAjustesPendentes(novoAjustes);
    atualizarCadastroRelatorioAtivo({
      vinculosManuais: novosVinculos,
      ajustesPendentes: novoAjustes,
    });
  };

  // Resumo estatístico da conciliação e resumo por empresa dona dos contratos
  const resumo = useMemo(() => {
    const totalItens = itensConciliados.length;
    const totalValorPdf = itensConciliados.reduce((acc, i) => acc + i.itemPdf.valorComissao, 0);
    const totalBasePdf = itensConciliados.reduce((acc, i) => acc + i.itemPdf.valorBase, 0);

    const qtdOk = itensConciliados.filter((i) => i.statusConciliacao === 'OK').length;
    const qtdDivergente = itensConciliados.filter((i) => i.statusConciliacao === 'DIVERGENTE').length;
    const qtdNaoEncontrado = itensConciliados.filter(
      (i) => i.statusConciliacao === 'NAO_ENCONTRADO'
    ).length;
    const qtdJaRecebido = itensConciliados.filter(
      (i) => i.statusConciliacao === 'JA_RECEBIDO'
    ).length;
    const totalPendencias = qtdDivergente + qtdNaoEncontrado;

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
      (i) =>
        itensSelecionados.includes(i.itemPdf.id) &&
        i.podeMarcarRecebido &&
        !i.jaRecebidaSistema
    );
    const valorSelecionado = selecionadosValidos.reduce(
      (acc, i) => acc + i.itemPdf.valorComissao,
      0
    );

    // Resumo detalhado por empresa dona dos contratos (Vertex, Winvest, Shazam, etc.)
    const mapaEmpresas = new Map<
      string,
      {
        id: string;
        nome: string;
        cor: string;
        qtd: number;
        qtdRecebidos: number;
        valorComissaoPdf: number;
        valorComissaoSistema: number;
        valorBase: number;
      }
    >();

    for (const ic of itensConciliados) {
      const vendaRef = ic.vendaEncontrada || ic.vendaSugerida;
      if (vendaRef) {
        const empId = vendaRef.empresaId || 'emp_vertex';
        const nome = obterNomeEmpresa(empId);
        const cor = obterCorEmpresa(empId);
        const atual = mapaEmpresas.get(empId) || {
          id: empId,
          nome,
          cor,
          qtd: 0,
          qtdRecebidos: 0,
          valorComissaoPdf: 0,
          valorComissaoSistema: 0,
          valorBase: 0,
        };
        atual.qtd += 1;
        if (ic.jaRecebidaSistema) atual.qtdRecebidos += 1;
        atual.valorComissaoPdf = Number(
          (atual.valorComissaoPdf + ic.itemPdf.valorComissao).toFixed(2)
        );
        atual.valorComissaoSistema = Number(
          (atual.valorComissaoSistema + (ic.comissaoSistema ?? ic.itemPdf.valorComissao)).toFixed(2)
        );
        atual.valorBase = Number((atual.valorBase + ic.itemPdf.valorBase).toFixed(2));
        mapaEmpresas.set(empId, atual);
      }
    }
    const porEmpresa = Array.from(mapaEmpresas.values()).sort(
      (a, b) => b.valorComissaoPdf - a.valorComissaoPdf
    );

    const isRelatorioProcessado =
      !!relatorioAtivoObj?.processado ||
      (totalItens > 0 && qtdJaRecebido === totalItens);

    return {
      totalItens,
      totalValorPdf,
      totalBasePdf,
      qtdOk,
      qtdDivergente,
      qtdNaoEncontrado,
      qtdJaRecebido,
      totalPendencias,
      qtdDatasDivergentes,
      somaComissaoSistemaEncontrados,
      somaComissaoPdfEncontrados,
      diferencaLiquidaComissao,
      qtdSelecionados: selecionadosValidos.length,
      valorSelecionado,
      porEmpresa,
      isRelatorioProcessado,
    };
  }, [itensConciliados, itensSelecionados, empresas, relatorioAtivoObj]);

  const itensFiltrados = useMemo(() => {
    return itensConciliados.filter((i) => {
      if (filtroAbas !== 'TODOS' && i.statusConciliacao !== filtroAbas) return false;
      if (filtroEmpresa !== 'TODAS') {
        const vendaRef = i.vendaEncontrada || i.vendaSugerida;
        const empId = vendaRef ? vendaRef.empresaId || 'emp_vertex' : 'SEM_EMPRESA';
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

  // Efetiva TODAS as alterações e ajustes de divergências + baixa das parcelas no banco (somente com 0 divergências)
  const handleConfirmarBaixaEmLote = async () => {
    if (resumo.totalPendencias > 0) return;

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
      const mapaVendasParaAtualizar = new Map<string, LancamentoVenda>();

      for (const itemConc of selecionados) {
        const vendaBase =
          mapaVendasParaAtualizar.get(itemConc.vendaEncontrada!.id) ||
          itemConc.vendaEncontrada!;

        const mesChave = itemConc.mesChaveParcela!;
        const celulaAtual = vendaBase.projecaoMensal[mesChave];
        // Jamais altera uma parcela que já consta como recebida
        if (!celulaAtual || celulaAtual.recebida) continue;

        const idItem = itemConc.itemPdf.id;
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

        // Aplica comissão ajustada no rascunho ou pelo switch global
        const comissaoAjustadaItem = ajustesPendentes.comissoesAjustadas?.[idItem];
        const novaComissao =
          comissaoAjustadaItem !== undefined
            ? comissaoAjustadaItem
            : atualizarComissaoParaValorPdf
            ? itemConc.itemPdf.valorComissao
            : celulaAtual.comissaoGerada;

        // Aplica valor base ajustado no rascunho (se houver)
        const baseAjustadaItem = ajustesPendentes.valoresBaseAjustados?.[idItem];
        const novoValorVenda =
          baseAjustadaItem !== undefined ? baseAjustadaItem : vendaBase.valorVenda;

        const novaCelula = {
          ...celulaAtual,
          valorVenda: novoValorVenda,
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

        // Recalcula totalComissoes e totalVendas
        let totalComissoes = vendaBase.totalComissoes;
        let totalVendas = novoValorVenda;
        const teveAjusteComissao =
          comissaoAjustadaItem !== undefined || atualizarComissaoParaValorPdf;

        if (teveAjusteComissao) {
          totalComissoes = Number(
            Object.values(novaProjecao)
              .filter(
                (c) =>
                  c &&
                  c.status !== 'Cancelada' &&
                  c.status !== 'Estornada' &&
                  c.valorVenda > 0
              )
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

        // Se foi vinculado manualmente, atualiza o PAC para o contrato do PDF
        const novoPac = itemConc.vinculoManual
          ? itemConc.itemPdf.contrato
          : vendaBase.pac;

        // Aplica data de venda ajustada no rascunho ou pelo switch global
        const dataAjustadaItem = ajustesPendentes.datasAjustadas?.[idItem];
        const novaDataVenda =
          dataAjustadaItem ||
          (corrigirDatasDivergentesAutomaticamente && itemConc.itemPdf.dataVendaISO
            ? itemConc.itemPdf.dataVendaISO
            : vendaBase.dataVenda);

        const vendaAtualizada: LancamentoVenda = {
          ...vendaBase,
          pac: novoPac,
          dataVenda: novaDataVenda,
          valorVenda: novoValorVenda,
          numeroRelatorio: numRelatorioFinal,
          dataRelatorio: dataRelatorioFinal,
          projecaoMensal: novaProjecao,
          totalVendas,
          totalComissoes,
        };

        mapaVendasParaAtualizar.set(vendaAtualizada.id, vendaAtualizada);
      }

      // Persiste todas as vendas atualizadas no Supabase e no estado global + sessão
      const vendasAtualizadasLista = Array.from(mapaVendasParaAtualizar.values());
      const novoMapaSessao: Record<string, LancamentoVenda> = {};
      for (const vendaUpd of vendasAtualizadasLista) {
        novoMapaSessao[vendaUpd.id] = vendaUpd;
        await salvarVendaSupabase(vendaUpd);
        onAtualizarVenda(vendaUpd);
      }

      setVendasAtualizadasSessao((prev) => ({ ...prev, ...novoMapaSessao }));
      setItensSelecionados([]);

      // Marca o relatório como PROCESSADO de forma permanente
      atualizarCadastroRelatorioAtivo({
        numeroDocumento: numeroRelatorioInput.trim() || dadosPdf?.numeroDocumento || 'S/N',
        dataRecebimentoInput: dataRelatorioInput,
        notaFiscalInput: notaFiscalInput.trim(),
        vinculosManuais,
        ajustesPendentes,
        processado: true,
        dataProcessamento: new Date().toISOString(),
      });

      const msg = `✅ Relatório nº ${numeroRelatorioInput || dadosPdf?.numeroDocumento || ''} PROCESSADO! ${selecionados.length} parcela(s) de ${vendasAtualizadasLista.length} contrato(s) marcada(s) como Recebida(s) e bloqueada(s).`;
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

  // Exporta PDF de Auditoria
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
      `Parceiro: ${dadosPdf.nomePN || 'Vertex Soluções Financeiras'} | Status: ${resumo.isRelatorioProcessado ? 'PROCESSADO' : 'NÃO PROCESSADO'} | Data: ${formatarData(dataRelatorioInput)} | Total PDF: ${formatarMoeda(resumo.totalValorPdf)}`,
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
      'Status / Divergências',
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

  const conteudoModal = (
    <>
      {/* Input oculto para Upload de PDF */}
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

      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 1.8,
          borderBottom: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
          bgcolor: isDark ? '#111827' : '#f8fafc',
          flexShrink: 0,
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Typography
                variant="h6"
                sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, lineHeight: 1.2 }}
              >
                Central de Relatórios de Comissão (PDF)
              </Typography>
              {dadosPdf && (
                <Chip
                  size="small"
                  icon={
                    resumo.isRelatorioProcessado ? (
                      <CheckCircleIcon sx={{ fontSize: '14px !important' }} />
                    ) : (
                      <HourglassEmptyIcon sx={{ fontSize: '14px !important' }} />
                    )
                  }
                  label={resumo.isRelatorioProcessado ? 'Processado' : 'Não Processado'}
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    bgcolor: resumo.isRelatorioProcessado
                      ? 'rgba(16, 185, 129, 0.16)'
                      : 'rgba(245, 158, 11, 0.16)',
                    color: resumo.isRelatorioProcessado ? '#10b981' : '#f59e0b',
                    border: `1px solid ${
                      resumo.isRelatorioProcessado
                        ? 'rgba(16, 185, 129, 0.4)'
                        : 'rgba(245, 158, 11, 0.4)'
                    }`,
                  }}
                />
              )}
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Selecione um relatório na barra lateral, resolva as divergências pendentes e clique em "Receber Parcelas"
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
            }}
          >
            Carregar PDF
          </Button>
          {embedded ? (
            <Button
              variant="outlined"
              size="small"
              onClick={onClose}
              disabled={salvando}
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                textTransform: 'none',
                borderColor: isDark ? '#334155' : '#cbd5e1',
                color: 'text.secondary',
                '&:hover': {
                  borderColor: '#0ea5e9',
                  color: '#0ea5e9',
                  bgcolor: 'rgba(14, 165, 233, 0.08)',
                },
              }}
            >
              Voltar ao Dashboard
            </Button>
          ) : (
            <IconButton onClick={onClose} disabled={salvando} size="small">
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Corpo com Barra Lateral Esquerda + Painel Principal Direito */}
      <Box
        sx={{
          p: 0,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          overflow: 'hidden',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* BARRA LATERAL ESQUERDA: Lista de todos os PDFs Carregados */}
        <Box
          sx={{
            width: { xs: '100%', md: 300 },
            flexShrink: 0,
            borderRight: { md: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}` },
            borderBottom: { xs: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`, md: 'none' },
            bgcolor: isDark ? '#0b0f19' : '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: { xs: 220, md: '100%' },
          }}
        >
          {/* Cabeçalho da Barra Lateral */}
          <Box
            sx={{
              p: 2,
              borderBottom: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <FolderSpecialIcon sx={{ color: '#0ea5e9', fontSize: 19 }} />
                <Typography
                  variant="subtitle2"
                  sx={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '0.84rem' }}
                >
                  PDFs Carregados ({relatoriosSalvos.length})
                </Typography>
              </Box>
            </Box>

            <Button
              fullWidth
              variant="contained"
              size="small"
              startIcon={<UploadFileIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                py: 0.8,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              }}
            >
              + Carregar Novo PDF
            </Button>
          </Box>

          {/* Lista de Relatórios PDF na Barra Lateral */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {relatoriosSalvos.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                <PictureAsPdfIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                  Nenhum relatório PDF carregado ainda.
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>
                  Clique em "+ Carregar Novo PDF" acima para importar.
                </Typography>
              </Box>
            ) : (
              relatoriosSalvos.map((rel) => {
                const isSelecionado = rel.id === relatorioAtivoId;
                const statusInfo = obterStatusRelatorioSalvo(rel);

                return (
                  <Paper
                    key={rel.id}
                    elevation={0}
                    onClick={() => selecionarRelatorioSalvo(rel)}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      border: isSelecionado
                        ? '2px solid #0ea5e9'
                        : `1px solid ${isDark ? '#1e293b' : '#cbd5e1'}`,
                      bgcolor: isSelecionado
                        ? isDark
                          ? 'rgba(14, 165, 233, 0.12)'
                          : 'rgba(14, 165, 233, 0.08)'
                        : isDark
                        ? '#111827'
                        : '#ffffff',
                      '&:hover': {
                        borderColor: '#0ea5e9',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 0.8,
                        mb: 0.6,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0 }}>
                        <PictureAsPdfIcon
                          sx={{
                            color: statusInfo.isProcessado
                              ? '#10b981'
                              : isSelecionado
                              ? '#0ea5e9'
                              : 'text.secondary',
                            fontSize: 20,
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            fontFamily: 'Outfit, sans-serif',
                            color: isSelecionado ? '#0ea5e9' : 'text.primary',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          Doc nº {rel.numeroDocumento || 'S/N'}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                        <Chip
                          size="small"
                          label={statusInfo.isProcessado ? 'Processado' : 'Não Processado'}
                          sx={{
                            height: 20,
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            bgcolor: statusInfo.isProcessado
                              ? 'rgba(16, 185, 129, 0.16)'
                              : 'rgba(245, 158, 11, 0.15)',
                            color: statusInfo.isProcessado ? '#10b981' : '#f59e0b',
                          }}
                        />
                        <Tooltip title="Remover relatório da lista">
                          <IconButton
                            size="small"
                            onClick={(e) => handleExcluirRelatorioSalvo(rel.id, e)}
                            sx={{
                              p: 0.3,
                              color: 'text.disabled',
                              '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' },
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        fontSize: '0.68rem',
                        display: 'block',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        mb: 0.4,
                      }}
                    >
                      {rel.nomeArquivo}
                    </Typography>

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mt: 0.5,
                        pt: 0.5,
                        borderTop: `1px dashed ${isDark ? '#1e293b' : '#e2e8f0'}`,
                      }}
                    >
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                        {rel.dataGeracaoBr || formatarData(rel.dataRecebimentoInput)} ·{' '}
                        {statusInfo.recebidosCount}/{statusInfo.totalItens} rec.
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 800, fontSize: '0.73rem', color: '#0ea5e9' }}
                      >
                        {formatarMoeda(rel.totalLiquido)}
                      </Typography>
                    </Box>
                  </Paper>
                );
              })
            )}
          </Box>
        </Box>

        {/* PAINEL PRINCIPAL DIREITO: Detalhes do Relatório Selecionado */}
        <Box
          sx={{
            flex: 1,
            p: 2.5,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
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
                p: 6,
                my: 'auto',
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
                    Clique para carregar ou arraste o PDF do Relatório de Comissão
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
                    Todos os PDFs carregados ficam disponíveis na barra lateral esquerda com status Processado / Não Processado
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
                      Carregar PDF
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
            <>
              {/* Barra de Informações do Documento e Configurações do Recebimento */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                  bgcolor: isDark ? '#111827' : '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
                    <Chip
                      icon={<PictureAsPdfIcon />}
                      label={nomeArquivo || `Relatório ${numeroRelatorioInput}`}
                      color="info"
                      variant="outlined"
                      sx={{ fontWeight: 700 }}
                    />
                    <Chip
                      size="small"
                      icon={
                        resumo.isRelatorioProcessado ? (
                          <CheckCircleIcon sx={{ fontSize: '14px !important' }} />
                        ) : (
                          <HourglassEmptyIcon sx={{ fontSize: '14px !important' }} />
                        )
                      }
                      label={
                        resumo.isRelatorioProcessado
                          ? 'Status: Processado'
                          : 'Status: Não Processado'
                      }
                      sx={{
                        fontWeight: 800,
                        fontSize: '0.72rem',
                        bgcolor: resumo.isRelatorioProcessado
                          ? 'rgba(16, 185, 129, 0.16)'
                          : 'rgba(245, 158, 11, 0.16)',
                        color: resumo.isRelatorioProcessado ? '#10b981' : '#f59e0b',
                      }}
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
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {resumo.totalPendencias > 0 && !resumo.isRelatorioProcessado && (
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        startIcon={<AutoFixHighIcon />}
                        onClick={handleResolverTodasDivergenciasRascunho}
                        sx={{
                          borderRadius: 2,
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          textTransform: 'none',
                        }}
                      >
                        Ajustar Todas as Divergências ({resumo.totalPendencias})
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={handleExportarRelatorioDivergenciasPDF}
                      sx={{ borderRadius: 2, fontWeight: 700, fontSize: '0.75rem', textTransform: 'none' }}
                    >
                      Exportar Auditoria PDF
                    </Button>
                  </Box>
                </Box>

                <Divider />

                {/* Inputs de Metadados do Recebimento e Switches de Ajuste */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <TextField
                      label="Nº do Documento / Relatório"
                      size="small"
                      required
                      disabled={resumo.isRelatorioProcessado}
                      value={numeroRelatorioInput}
                      onChange={(e) => {
                        setNumeroRelatorioInput(e.target.value);
                        atualizarCadastroRelatorioAtivo({ numeroDocumento: e.target.value });
                      }}
                      sx={{ width: 190 }}
                    />
                    <TextField
                      label="Data do Recebimento"
                      type="date"
                      size="small"
                      required
                      disabled={resumo.isRelatorioProcessado}
                      value={dataRelatorioInput}
                      onChange={(e) => {
                        setDataRelatorioInput(e.target.value);
                        atualizarCadastroRelatorioAtivo({ dataRecebimentoInput: e.target.value });
                      }}
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={{ width: 165 }}
                    />
                    <TextField
                      label="Nota Fiscal (Opcional)"
                      size="small"
                      disabled={resumo.isRelatorioProcessado}
                      placeholder="Ex: NF 1042"
                      value={notaFiscalInput}
                      onChange={(e) => {
                        setNotaFiscalInput(e.target.value);
                        atualizarCadastroRelatorioAtivo({ notaFiscalInput: e.target.value });
                      }}
                      sx={{ width: 165 }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          disabled={resumo.isRelatorioProcessado}
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

                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          color="warning"
                          disabled={resumo.isRelatorioProcessado}
                          checked={atualizarComissaoParaValorPdf}
                          onChange={(e) => setAtualizarComissaoParaValorPdf(e.target.checked)}
                        />
                      }
                      label={
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          Ajustar comissões p/ PDF
                        </Typography>
                      }
                    />

                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          color="info"
                          disabled={resumo.isRelatorioProcessado}
                          checked={corrigirDatasDivergentesAutomaticamente}
                          onChange={(e) =>
                            setCorrigirDatasDivergentesAutomaticamente(e.target.checked)
                          }
                        />
                      }
                      label={
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          Ajustar datas divergentes p/ PDF
                        </Typography>
                      }
                    />
                  </Box>
                </Box>
              </Paper>

              {/* RESUMO POR EMPRESA DONA DOS CONTRATOS */}
              {resumo.porEmpresa.length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.8,
                    borderRadius: 2.5,
                    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                    bgcolor: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 1.2,
                      flexWrap: 'wrap',
                      gap: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <BusinessIcon sx={{ fontSize: 18, color: '#6366f1' }} />
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          color: 'text.secondary',
                        }}
                      >
                        Resumo por Empresa Dona dos Contratos no Relatório
                      </Typography>
                    </Box>
                    {filtroEmpresa !== 'TODAS' && (
                      <Button
                        size="small"
                        onClick={() => setFiltroEmpresa('TODAS')}
                        sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'none', py: 0 }}
                      >
                        Mostrar Todas as Empresas ({resumo.totalItens})
                      </Button>
                    )}
                  </Box>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, 1fr)',
                        md: `repeat(${Math.min(resumo.porEmpresa.length + 1, 4)}, 1fr)`,
                      },
                      gap: 1.2,
                    }}
                  >
                    {resumo.porEmpresa.map((emp) => {
                      const ativo = filtroEmpresa === emp.id;
                      const percValor =
                        resumo.totalValorPdf > 0
                          ? ((emp.valorComissaoPdf / resumo.totalValorPdf) * 100).toFixed(1)
                          : '0.0';
                      return (
                        <Paper
                          key={emp.id}
                          elevation={0}
                          onClick={() => setFiltroEmpresa(ativo ? 'TODAS' : emp.id)}
                          sx={{
                            p: 1.4,
                            borderRadius: 2,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            border: ativo
                              ? `2px solid ${emp.cor}`
                              : `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                            bgcolor: ativo
                              ? `${emp.cor}18`
                              : isDark
                              ? '#111827'
                              : '#f8fafc',
                            '&:hover': {
                              borderColor: emp.cor,
                            },
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              mb: 0.5,
                            }}
                          >
                            <Chip
                              size="small"
                              label={emp.nome}
                              sx={{
                                height: 20,
                                fontWeight: 800,
                                fontSize: '0.7rem',
                                bgcolor: `${emp.cor}22`,
                                color: emp.cor,
                              }}
                            />
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.68rem' }}
                            >
                              {emp.qtd} cota(s) ({percValor}%)
                            </Typography>
                          </Box>

                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 800,
                              color: emp.cor,
                              fontFamily: 'Outfit, sans-serif',
                              lineHeight: 1.2,
                            }}
                          >
                            {formatarMoeda(emp.valorComissaoPdf)}
                          </Typography>

                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              mt: 0.4,
                              color: 'text.secondary',
                              fontSize: '0.66rem',
                            }}
                          >
                            <span>Base: {formatarMoeda(emp.valorBase)}</span>
                            <span>
                              {emp.qtdRecebidos}/{emp.qtd} receb.
                            </span>
                          </Box>
                        </Paper>
                      );
                    })}

                    {/* Card Total Consolidado */}
                    <Paper
                      elevation={0}
                      onClick={() => setFiltroEmpresa('TODAS')}
                      sx={{
                        p: 1.4,
                        borderRadius: 2,
                        cursor: 'pointer',
                        border: `1px dashed ${isDark ? '#334155' : '#cbd5e1'}`,
                        bgcolor: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          mb: 0.5,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}
                        >
                          Total Geral PDF
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          {resumo.totalItens} cotas
                        </Typography>
                      </Box>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 800,
                          color: '#10b981',
                          fontFamily: 'Outfit, sans-serif',
                          lineHeight: 1.2,
                        }}
                      >
                        {formatarMoeda(resumo.totalValorPdf)}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', fontSize: '0.66rem', display: 'block', mt: 0.4 }}
                      >
                        Base Total: {formatarMoeda(resumo.totalBasePdf)}
                      </Typography>
                    </Paper>
                  </Box>
                </Paper>
              )}

              {/* Filtros de Status de Conciliação */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, color: 'text.secondary', mr: 0.5 }}
                  >
                    FILTRAR VISÃO:
                  </Typography>
                  {[
                    { id: 'TODOS' as const, label: `Todos (${resumo.totalItens})`, color: '#6366f1' },
                    {
                      id: 'OK' as const,
                      label: `Prontos / Ajustados (${resumo.qtdOk})`,
                      color: '#10b981',
                    },
                    {
                      id: 'DIVERGENTE' as const,
                      label: `Divergências Pendentes (${resumo.qtdDivergente})`,
                      color: '#f59e0b',
                    },
                    {
                      id: 'NAO_ENCONTRADO' as const,
                      label: `Não Encontrados (${resumo.qtdNaoEncontrado})`,
                      color: '#ef4444',
                    },
                    {
                      id: 'JA_RECEBIDO' as const,
                      label: `Já Recebidos (${resumo.qtdJaRecebido})`,
                      color: '#0ea5e9',
                    },
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

                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: resumo.totalPendencias === 0 ? '#10b981' : '#f59e0b',
                  }}
                >
                  {resumo.totalPendencias === 0
                    ? '✅ 0 divergências pendentes — Botão "Receber Parcelas" liberado!'
                    : `⚠️ ${resumo.totalPendencias} divergência(s) pendente(s) — Ajuste para liberar o recebimento`}
                </Typography>
              </Box>

              {/* Tabela de Conciliação */}
              <TableContainer
                component={Paper}
                elevation={0}
                sx={{
                  borderRadius: 2.5,
                  border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                  flex: 1,
                  minHeight: 300,
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
                          disabled={resumo.isRelatorioProcessado}
                          checked={
                            itensFiltrados.some((i) => i.podeMarcarRecebido && !i.jaRecebidaSistema) &&
                            itensFiltrados
                              .filter((i) => i.podeMarcarRecebido && !i.jaRecebidaSistema)
                              .every((i) => itensSelecionados.includes(i.itemPdf.id))
                          }
                          indeterminate={
                            itensFiltrados.some(
                              (i) =>
                                i.podeMarcarRecebido &&
                                !i.jaRecebidaSistema &&
                                itensSelecionados.includes(i.itemPdf.id)
                            ) &&
                            !itensFiltrados
                              .filter((i) => i.podeMarcarRecebido && !i.jaRecebidaSistema)
                              .every((i) => itensSelecionados.includes(i.itemPdf.id))
                          }
                          onChange={(e) => handleToggleTodosVisiveis(e.target.checked)}
                        />
                      </TableCell>
                      {[
                        'Contrato PDF / Cota',
                        'Empresa Dona',
                        'Contrato / Cliente no Sistema',
                        'Venda (PDF vs Sist.)',
                        'Parc.',
                        'Valor Base (PDF vs Sist.)',
                        'Comissão PDF',
                        'Comissão Sistema',
                        'Status & Ajustes de Divergências',
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
                      const {
                        itemPdf,
                        vendaEncontrada,
                        vendaSugerida,
                        divergencias,
                        statusConciliacao,
                      } = ic;
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

                      const corEmp = vendaEncontrada
                        ? obterCorEmpresa(vendaEncontrada.empresaId)
                        : '#64748b';

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
                                disabled={!ic.podeMarcarRecebido || resumo.isRelatorioProcessado}
                                checked={isChecked}
                                onChange={() => handleToggleItem(itemPdf.id)}
                              />
                            )}
                          </TableCell>

                          {/* Contrato PDF / Grupo / Cota */}
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 800,
                                fontSize: '0.8rem',
                                fontFamily: 'Outfit, sans-serif',
                              }}
                            >
                              {itemPdf.contrato}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: 'text.secondary', fontSize: '0.66rem', display: 'block' }}
                            >
                              Gr: {itemPdf.grupo} · Cota: {itemPdf.cota}
                            </Typography>
                          </TableCell>

                          {/* Empresa Dona do Contrato */}
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {vendaEncontrada ? (
                              <Chip
                                label={obterNomeEmpresa(vendaEncontrada.empresaId)}
                                size="small"
                                sx={{
                                  height: 22,
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  bgcolor: `${corEmp}22`,
                                  color: corEmp,
                                  border: `1px solid ${corEmp}55`,
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
                              <Typography
                                variant="caption"
                                sx={{ color: 'text.disabled', fontWeight: 600 }}
                              >
                                Não identificada
                              </Typography>
                            )}
                          </TableCell>

                          {/* Cliente no Sistema (ou seletor de vínculo manual — bloqueado se já recebido) */}
                          <TableCell sx={{ minWidth: 240 }}>
                            {vendaEncontrada && (ic.jaRecebidaSistema || !ic.vinculoManual) ? (
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 700, fontSize: '0.78rem' }}
                                  >
                                    {vendaEncontrada.cliente}
                                  </Typography>
                                  {ic.jaRecebidaSistema && (
                                    <Tooltip title="Recebido e bloqueado para alterações">
                                      <LockIcon sx={{ fontSize: 13, color: '#10b981' }} />
                                    </Tooltip>
                                  )}
                                </Box>
                                <Typography
                                  variant="caption"
                                  sx={{ color: 'text.secondary', fontSize: '0.66rem' }}
                                >
                                  PAC: {vendaEncontrada.pac || '—'} · Vend:{' '}
                                  {vendaEncontrada.vendedorNome || '—'} · {vendaEncontrada.tabela}
                                </Typography>
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                                <Autocomplete
                                  size="small"
                                  disabled={!!ic.jaRecebidaSistema || resumo.isRelatorioProcessado}
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
                                {!vendaEncontrada &&
                                  vendaSugerida &&
                                  !ic.jaRecebidaSistema &&
                                  !resumo.isRelatorioProcessado && (
                                    <Button
                                      size="small"
                                      variant="text"
                                      startIcon={<LinkIcon sx={{ fontSize: 13 }} />}
                                      onClick={() =>
                                        handleVincularContratoManual(itemPdf.id, vendaSugerida)
                                      }
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
                                      Sugestão: Vincular a {vendaSugerida.cliente} [
                                      {obterNomeEmpresa(vendaSugerida.empresaId)} · PAC{' '}
                                      {vendaSugerida.pac || 'S/N'} ·{' '}
                                      {formatarData(vendaSugerida.dataVenda)} ·{' '}
                                      {formatarMoeda(vendaSugerida.valorVenda)}]
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
                                  color: temDivDataVenda
                                    ? '#f59e0b'
                                    : ic.dataAjustadaPendente
                                    ? '#10b981'
                                    : 'text.secondary',
                                  fontWeight:
                                    temDivDataVenda || ic.dataAjustadaPendente ? 700 : 500,
                                  fontSize: '0.65rem',
                                  display: 'block',
                                }}
                              >
                                Sist: {formatarData(ic.dataVendaSistema)}
                                {ic.dataAjustadaPendente ? ' (Ajustado)' : ''}
                              </Typography>
                            )}
                            {temDivDataVenda &&
                              !ic.jaRecebidaSistema &&
                              !resumo.isRelatorioProcessado &&
                              vendaEncontrada &&
                              itemPdf.dataVendaISO && (
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={() =>
                                    handleAjustarDataRascunho(
                                      itemPdf.id,
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
                                  Ajustar p/ {itemPdf.dataVendaBr}
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
                                  color: temDivValorBase
                                    ? '#f59e0b'
                                    : ic.baseAjustadaPendente
                                    ? '#10b981'
                                    : 'text.secondary',
                                  fontWeight:
                                    temDivValorBase || ic.baseAjustadaPendente ? 700 : 500,
                                  fontSize: '0.65rem',
                                  display: 'block',
                                }}
                              >
                                Sist: {formatarMoeda(ic.valorBaseSistema)}
                                {ic.baseAjustadaPendente ? ' (Ajustado)' : ''}
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
                                {ic.comissaoAjustadaPendente && (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: '#10b981',
                                      fontWeight: 700,
                                      fontSize: '0.63rem',
                                      display: 'block',
                                    }}
                                  >
                                    ✓ Ajustado p/ PDF
                                  </Typography>
                                )}
                                {temDivValorComissao && (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: '#ef4444',
                                      fontWeight: 700,
                                      fontSize: '0.65rem',
                                      display: 'block',
                                    }}
                                  >
                                    Dif:{' '}
                                    {itemPdf.valorComissao - ic.comissaoSistema > 0 ? '+' : ''}
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

                          {/* Status & Ajustes de Divergências */}
                          <TableCell sx={{ minWidth: 270 }}>
                            {divergencias.length === 0 ? (
                              <Chip
                                size="small"
                                icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                                label={
                                  ic.dataAjustadaPendente ||
                                  ic.comissaoAjustadaPendente ||
                                  ic.baseAjustadaPendente
                                    ? 'Divergência ajustada (Pronto p/ receber)'
                                    : 'Conciliado sem divergências'
                                }
                                sx={{
                                  bgcolor: 'rgba(16, 185, 129, 0.12)',
                                  color: '#10b981',
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 0.5,
                                  py: 0.3,
                                }}
                              >
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
                                          flexWrap: 'wrap',
                                          gap: 0.5,
                                          px: 1,
                                          py: 0.35,
                                          borderRadius: 1.5,
                                          bgcolor: bg,
                                          color: cor,
                                          border: `1px solid ${cor}33`,
                                          width: 'fit-content',
                                        }}
                                      >
                                        <Icone sx={{ fontSize: 13, flexShrink: 0 }} />
                                        <Typography
                                          sx={{
                                            fontSize: '0.68rem',
                                            fontWeight: 700,
                                            lineHeight: 1.2,
                                          }}
                                        >
                                          {div.titulo}
                                        </Typography>

                                        {/* Botões de ajuste em rascunho para zerar cada divergência */}
                                        {!ic.jaRecebidaSistema && !resumo.isRelatorioProcessado && (
                                          <>
                                            {div.tipo === 'DATA_VENDA_DIVERGENTE' &&
                                              itemPdf.dataVendaISO && (
                                                <Box sx={{ display: 'flex', gap: 0.4, ml: 0.4 }}>
                                                  <Button
                                                    size="small"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleAjustarDataRascunho(
                                                        itemPdf.id,
                                                        itemPdf.dataVendaISO,
                                                        ic.jaRecebidaSistema
                                                      );
                                                    }}
                                                    sx={{
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
                                                    Ajustar p/ PDF
                                                  </Button>
                                                  <Button
                                                    size="small"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleAceitarDivergenciaMantendoSistema(
                                                        `${itemPdf.id}_DATA`,
                                                        ic.jaRecebidaSistema
                                                      );
                                                    }}
                                                    sx={{
                                                      px: 0.6,
                                                      py: 0.1,
                                                      minWidth: 'auto',
                                                      height: 18,
                                                      fontSize: '0.6rem',
                                                      fontWeight: 700,
                                                      textTransform: 'none',
                                                      borderRadius: 1,
                                                      border: '1px solid currentColor',
                                                      color: 'inherit',
                                                    }}
                                                  >
                                                    Manter Sist.
                                                  </Button>
                                                </Box>
                                              )}

                                            {div.tipo === 'VALOR_COMISSAO_DIVERGENTE' && (
                                              <Box sx={{ display: 'flex', gap: 0.4, ml: 0.4 }}>
                                                <Button
                                                  size="small"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAjustarComissaoRascunho(
                                                      itemPdf.id,
                                                      itemPdf.valorComissao,
                                                      ic.jaRecebidaSistema
                                                    );
                                                  }}
                                                  sx={{
                                                    px: 0.7,
                                                    py: 0.1,
                                                    minWidth: 'auto',
                                                    height: 18,
                                                    fontSize: '0.62rem',
                                                    fontWeight: 800,
                                                    textTransform: 'none',
                                                    borderRadius: 1,
                                                    bgcolor: '#f59e0b',
                                                    color: '#fff',
                                                    '&:hover': { bgcolor: '#d97706' },
                                                  }}
                                                >
                                                  Ajustar p/ PDF
                                                </Button>
                                                <Button
                                                  size="small"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAceitarDivergenciaMantendoSistema(
                                                      `${itemPdf.id}_COMISSAO`,
                                                      ic.jaRecebidaSistema
                                                    );
                                                  }}
                                                  sx={{
                                                    px: 0.6,
                                                    py: 0.1,
                                                    minWidth: 'auto',
                                                    height: 18,
                                                    fontSize: '0.6rem',
                                                    fontWeight: 700,
                                                    textTransform: 'none',
                                                    borderRadius: 1,
                                                    border: '1px solid currentColor',
                                                    color: 'inherit',
                                                  }}
                                                >
                                                  Manter Sist.
                                                </Button>
                                              </Box>
                                            )}

                                            {div.tipo === 'VALOR_BASE_DIVERGENTE' && (
                                              <Box sx={{ display: 'flex', gap: 0.4, ml: 0.4 }}>
                                                <Button
                                                  size="small"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAjustarValorBaseRascunho(
                                                      itemPdf.id,
                                                      itemPdf.valorBase,
                                                      ic.jaRecebidaSistema
                                                    );
                                                  }}
                                                  sx={{
                                                    px: 0.7,
                                                    py: 0.1,
                                                    minWidth: 'auto',
                                                    height: 18,
                                                    fontSize: '0.62rem',
                                                    fontWeight: 800,
                                                    textTransform: 'none',
                                                    borderRadius: 1,
                                                    bgcolor: '#f59e0b',
                                                    color: '#fff',
                                                    '&:hover': { bgcolor: '#d97706' },
                                                  }}
                                                >
                                                  Ajustar Base
                                                </Button>
                                                <Button
                                                  size="small"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAceitarDivergenciaMantendoSistema(
                                                      `${itemPdf.id}_BASE`,
                                                      ic.jaRecebidaSistema
                                                    );
                                                  }}
                                                  sx={{
                                                    px: 0.6,
                                                    py: 0.1,
                                                    minWidth: 'auto',
                                                    height: 18,
                                                    fontSize: '0.6rem',
                                                    fontWeight: 700,
                                                    textTransform: 'none',
                                                    borderRadius: 1,
                                                    border: '1px solid currentColor',
                                                    color: 'inherit',
                                                  }}
                                                >
                                                  Manter Sist.
                                                </Button>
                                              </Box>
                                            )}
                                          </>
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
                placeholder="Cole aqui o texto copiado do PDF..."
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
        </Box>
      </Box>

      {/* Rodapé com Ações — Botão "Receber Parcelas" ativo somente com 0 divergências */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderTop: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
          bgcolor: isDark ? '#111827' : '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1.5,
          flexShrink: 0,
        }}
      >
        <Box>
          {dadosPdf && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {resumo.isRelatorioProcessado ? (
                <span style={{ color: '#10b981', fontWeight: 800 }}>
                  🔒 Relatório Processado ({resumo.qtdJaRecebido}/{resumo.totalItens} recebidos e bloqueados)
                </span>
              ) : resumo.totalPendencias > 0 ? (
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>
                  ⚠️ Existem {resumo.totalPendencias} divergência(s) pendente(s). Ajuste todas (0 divergências) para ativar o botão "Receber Parcelas".
                </span>
              ) : (
                <span>
                  ✅ <strong>0 divergências!</strong> {resumo.qtdSelecionados} parcela(s) pronta(s) para recebimento · Total:{' '}
                  <strong style={{ color: '#10b981' }}>{formatarMoeda(resumo.valorSelecionado)}</strong>
                </span>
              )}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button
            onClick={onClose}
            disabled={salvando}
            variant="outlined"
            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
          >
            {embedded ? 'Voltar ao Dashboard' : 'Fechar'}
          </Button>
          {dadosPdf && (
            <Tooltip
              title={
                resumo.totalPendencias > 0
                  ? `Resolva as ${resumo.totalPendencias} divergência(s) antes de receber as parcelas`
                  : ''
              }
            >
              <span>
                <Button
                  onClick={handleConfirmarBaixaEmLote}
                  disabled={
                    salvando ||
                    resumo.isRelatorioProcessado ||
                    resumo.totalPendencias > 0 ||
                    resumo.qtdSelecionados === 0 ||
                    !numeroRelatorioInput.trim() ||
                    !dataRelatorioInput
                  }
                  variant="contained"
                  startIcon={
                    salvando ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : resumo.isRelatorioProcessado ? (
                      <LockIcon />
                    ) : (
                      <CheckCircleIcon />
                    )
                  }
                  sx={{
                    borderRadius: 2,
                    fontWeight: 800,
                    px: 3,
                    textTransform: 'none',
                    background:
                      resumo.totalPendencias === 0 && !resumo.isRelatorioProcessado
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : undefined,
                    boxShadow:
                      resumo.totalPendencias === 0 && !resumo.isRelatorioProcessado
                        ? '0 4px 12px rgba(16, 185, 129, 0.3)'
                        : 'none',
                    '&:hover': {
                      background:
                        resumo.totalPendencias === 0 && !resumo.isRelatorioProcessado
                          ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                          : undefined,
                    },
                  }}
                >
                  {salvando
                    ? 'Processando Recebimento...'
                    : resumo.isRelatorioProcessado
                    ? 'Relatório Já Processado'
                    : resumo.totalPendencias > 0
                    ? `Receber Parcelas (${resumo.totalPendencias} Divergência(s) Pendente(s))`
                    : `Receber Parcelas (${resumo.qtdSelecionados})`}
                </Button>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>
    </>
  );

  if (embedded) {
    return (
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          height: { xs: 'auto', md: 'calc(100vh - 170px)' },
          minHeight: 700,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 3,
          border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
          bgcolor: isDark ? '#0f172a' : '#ffffff',
          overflow: 'hidden',
          boxShadow: isDark
            ? '0 10px 30px -5px rgba(0, 0, 0, 0.5)'
            : '0 10px 30px -5px rgba(0, 0, 0, 0.05)',
        }}
      >
        {conteudoModal}
      </Paper>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={salvando ? undefined : onClose}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            bgcolor: isDark ? '#0f172a' : '#ffffff',
            backgroundImage: 'none',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        },
      }}
    >
      {conteudoModal}
    </Dialog>
  );
};
