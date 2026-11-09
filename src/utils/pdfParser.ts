export interface ItemRelatorioPDF {
  id: string;
  numDoc: string;
  repres: string;
  dataRelatorioISO: string; // YYYY-MM-DD
  dataRelatorioBr: string;  // DD/MM/YYYY
  descricao: string;
  tipo: string;
  contrato: string;
  dataVendaISO: string;     // YYYY-MM-DD
  dataVendaBr: string;      // DD/MM/YYYY
  grupo: string;
  cota: string;
  parcela: number;
  valorBase: number;
  valorComissao: number;
}

export interface DadosRelatorioPDF {
  codigoPN?: string;
  nomePN?: string;
  cnpj?: string;
  numeroDocumento?: string;
  status?: string;
  dataGeracaoISO?: string;
  dataGeracaoBr?: string;
  totalValorBase?: number;
  totalBruto?: number;
  totalLiquido?: number;
  itens: ItemRelatorioPDF[];
  textoBruto: string;
}

/** Converte DD/MM/YYYY para YYYY-MM-DD */
export const converterDataBrParaISO = (dataBr: string): string => {
  const m = dataBr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
};

/** Converte string monetária pt-BR (ex: "300.000,00" ou "-291,36") para number */
export const parseMoedaBr = (valorStr: string): number => {
  if (!valorStr) return 0;
  const limpo = valorStr
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
};

/**
 * Carrega o PDF.js dinamicamente via CDN caso ainda não esteja disponível em window.pdfjsLib
 */
async function obterPdfJsLib(): Promise<any | null> {
  const win = window as any;
  if (win.pdfjsLib) return win.pdfjsLib;

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (win.pdfjsLib) {
        win.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(win.pdfjsLib);
      } else {
        resolve(null);
      }
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

/**
 * Extrai o texto do PDF preservando a estrutura de linhas (agrupando itens pela coordenada Y)
 * usando PDF.js
 */
async function extrairTextoComPdfJs(buffer: ArrayBuffer): Promise<string | null> {
  try {
    const pdfjsLib = await obterPdfJsLib();
    if (!pdfjsLib) return null;

    const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
    const pdf = await loadingTask.promise;
    const paginasTexto: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      interface PosItem {
        str: string;
        x: number;
        y: number;
      }

      const items: PosItem[] = [];
      for (const item of textContent.items) {
        if ('str' in item && item.str.trim().length > 0) {
          const tx = item.transform;
          items.push({
            str: item.str,
            x: tx ? tx[4] : 0,
            y: tx ? tx[5] : 0,
          });
        }
      }

      // Agrupa itens que estão na mesma linha horizontal (tolerância de Y = 3.5 unidades)
      const linhasAgrupadas: { y: number; items: PosItem[] }[] = [];
      const toleranciaY = 3.5;

      for (const it of items) {
        let linhaExistente = linhasAgrupadas.find((l) => Math.abs(l.y - it.y) <= toleranciaY);
        if (!linhaExistente) {
          linhaExistente = { y: it.y, items: [] };
          linhasAgrupadas.push(linhaExistente);
        }
        linhaExistente.items.push(it);
      }

      // Ordena de cima para baixo (Y decrescente no sistema de coordenadas do PDF)
      linhasAgrupadas.sort((a, b) => b.y - a.y);

      const linhasPagina = linhasAgrupadas.map((linha) => {
        // Ordena da esquerda para a direita (X crescente)
        linha.items.sort((a, b) => a.x - b.x);
        return linha.items.map((i) => i.str.trim()).join(' ');
      });

      paginasTexto.push(linhasPagina.join('\n'));
    }

    return paginasTexto.join('\n');
  } catch (err) {
    console.warn('Falha ao extrair texto via PDF.js, tentando fallback nativo:', err);
    return null;
  }
}

/**
 * Fallback nativo usando DecompressionStream do navegador para descomprimir FlateDecode streams
 * caso o usuário esteja sem acesso ao CDN do PDF.js.
 */
async function descomprimirFlate(dados: Uint8Array): Promise<Uint8Array | null> {
  for (const formato of ['deflate', 'deflate-raw'] as const) {
    try {
      const ds = new DecompressionStream(formato);
      const writer = ds.writable.getWriter();
      writer.write(new Uint8Array(dados));
      writer.close();
      const resp = new Response(ds.readable);
      const ab = await resp.arrayBuffer();
      return new Uint8Array(ab);
    } catch {
      // Tenta o próximo formato
    }
  }
  return null;
}

function decodificarLiteralPdf(raw: string): string {
  return raw
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

async function extrairTextoNativoFallback(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const latin1 = new TextDecoder('latin1').decode(bytes);
  const partesTexto: string[] = [];

  const regexStream = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = regexStream.exec(latin1)) !== null) {
    const conteudoRaw = match[1];
    const streamBytes = new Uint8Array(conteudoRaw.length);
    for (let i = 0; i < conteudoRaw.length; i++) {
      streamBytes[i] = conteudoRaw.charCodeAt(i) & 0xff;
    }

    const descomprimido = await descomprimirFlate(streamBytes);
    const textoStream = descomprimido
      ? new TextDecoder('latin1').decode(descomprimido)
      : conteudoRaw;

    // Extrai strings entre parênteses (...) ou hexadecimais <...> em blocos de texto PDF
    const regexTokens = /\((?:\\.|[^\\()])*\)|<([0-9A-Fa-f\s]{2,})>/g;
    let mStr: RegExpExecArray | null;
    const tokensStream: string[] = [];
    while ((mStr = regexTokens.exec(textoStream)) !== null) {
      if (mStr[0].startsWith('(')) {
        const interno = mStr[0].slice(1, -1);
        const dec = decodificarLiteralPdf(interno).trim();
        if (dec) tokensStream.push(dec);
      } else if (mStr[1]) {
        const hex = mStr[1].replace(/\s+/g, '');
        if (hex.length % 4 === 0 && /^(00[2-7][0-9A-Fa-f])+$/i.test(hex)) {
          let s = '';
          for (let i = 0; i < hex.length; i += 4) {
            s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
          }
          if (s.trim()) tokensStream.push(s.trim());
        }
      }
    }
    if (tokensStream.length > 0) {
      partesTexto.push(tokensStream.join(' '));
    }
  }

  return partesTexto.join('\n');
}

/**
 * Faz o parse do texto extraído do PDF de Relatório de Comissão (padrão Âncora / Administradoras)
 */
export function analisarTextoRelatorioPDF(texto: string): DadosRelatorioPDF {
  const textoNormalizado = texto.replace(/\r/g, '\n');

  // Metadados do cabeçalho
  const matchCodPN = textoNormalizado.match(/C[óo]digo\s+do\s+PN:\s*([A-Z0-9_-]+)/i);
  const matchNomePN = textoNormalizado.match(/Nome\s+do\s+PN:\s*([^\n]+?)(?:\s+Status:|\s+N[º°o]\s*documento:|\n|$)/i);
  const matchCnpj = textoNormalizado.match(/CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i);
  const matchNumDocHeader = textoNormalizado.match(/N[º°o]\s*documento:\s*(\d+)/i);
  const matchStatus = textoNormalizado.match(/Status:\s*([A-Za-zÀ-ÿ]+)/i);
  const matchDataGeracao = textoNormalizado.match(/Relat[óo]rio\s+gerado\s+em\s+(\d{2}\/\d{2}\/\d{4})/i);
  const matchTotalLiquido = textoNormalizado.match(/TOTAL\s+L[ÍI]QUIDO:\s*R?\$?\s*([\d.]+,\d{2})/i);
  const matchTotalBruto = textoNormalizado.match(/TOTAL\s+BRUTO:?\s*R?\$?\s*([\d.]+,\d{2})/i);

  const itens: ItemRelatorioPDF[] = [];
  const chavesVistas = new Set<string>();

  // 1. Regex completa da linha padrão do relatório de comissão:
  // Nº doc | Repres | Data | Descrição | Tipo | Contrato | Venda | Grupo | Cota | Parcela | Valor Base | Valor
  // Exemplo: 53637 18880 03/11/2026 COMISSÃO S/ VENDAS I 1000413312 18/08/2026 00707 1124 3 300.000,00 750,00
  const regexLinhaCompleta =
    /(\d{3,10})\s+(\d{3,10})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([A-Z])\s+(\d{5,15})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2,6})\s+(\d{1,6})\s+(\d{1,3})\s+([\d.]+,\d{2})\s+(-?[\d.]+,\d{2})/g;

  let m: RegExpExecArray | null;
  while ((m = regexLinhaCompleta.exec(textoNormalizado)) !== null) {
    const numDoc = m[1].trim();
    const repres = m[2].trim();
    const dataRelBr = m[3].trim();
    const descricao = m[4].trim();
    const tipo = m[5].trim();
    const contrato = m[6].trim();
    const dataVendaBr = m[7].trim();
    const grupo = m[8].trim();
    const cota = m[9].trim();
    const parcela = parseInt(m[10].trim(), 10);
    const valorBase = parseMoedaBr(m[11]);
    const valorComissao = parseMoedaBr(m[12]);

    const chaveUnica = `${contrato}_${parcela}_${valorComissao}`;
    if (!chavesVistas.has(chaveUnica)) {
      chavesVistas.add(chaveUnica);
      itens.push({
        id: `pdf_item_${itens.length + 1}_${contrato}_${parcela}`,
        numDoc,
        repres,
        dataRelatorioBr: dataRelBr,
        dataRelatorioISO: converterDataBrParaISO(dataRelBr),
        descricao,
        tipo,
        contrato,
        dataVendaBr,
        dataVendaISO: converterDataBrParaISO(dataVendaBr),
        grupo,
        cota,
        parcela,
        valorBase,
        valorComissao,
      });
    }
  }

  // 2. Fallback: caso o PDF tenha quebrado a parte inicial da linha ou não tenha coluna "Tipo" de 1 letra
  if (itens.length === 0) {
    const regexFallback =
      /(?:(\d{3,10})\s+(?:\d{3,10}\s+)?(\d{2}\/\d{2}\/\d{4})\s+[^\d\n]+?\s+)?(\d{6,15})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2,6})\s+(\d{1,6})\s+(\d{1,3})\s+([\d.]+,\d{2})\s+(-?[\d.]+,\d{2})/g;

    while ((m = regexFallback.exec(textoNormalizado)) !== null) {
      const numDoc = (m[1] || matchNumDocHeader?.[1] || '').trim();
      const dataRelBr = (m[2] || matchDataGeracao?.[1] || '').trim();
      const contrato = m[3].trim();
      const dataVendaBr = m[4].trim();
      const grupo = m[5].trim();
      const cota = m[6].trim();
      const parcela = parseInt(m[7].trim(), 10);
      const valorBase = parseMoedaBr(m[8]);
      const valorComissao = parseMoedaBr(m[9]);

      const chaveUnica = `${contrato}_${parcela}_${valorComissao}`;
      if (!chavesVistas.has(chaveUnica)) {
        chavesVistas.add(chaveUnica);
        itens.push({
          id: `pdf_item_${itens.length + 1}_${contrato}_${parcela}`,
          numDoc,
          repres: '',
          dataRelatorioBr: dataRelBr,
          dataRelatorioISO: converterDataBrParaISO(dataRelBr),
          descricao: 'COMISSÃO S/ VENDAS',
          tipo: 'I',
          contrato,
          dataVendaBr,
          dataVendaISO: converterDataBrParaISO(dataVendaBr),
          grupo,
          cota,
          parcela,
          valorBase,
          valorComissao,
        });
      }
    }
  }

  const somaBase = itens.reduce((acc, item) => acc + item.valorBase, 0);
  const somaComissao = itens.reduce((acc, item) => acc + item.valorComissao, 0);

  const numDocInferido = matchNumDocHeader?.[1] || itens[0]?.numDoc || '';
  const dataGeracaoBr = matchDataGeracao?.[1] || itens[0]?.dataRelatorioBr || '';

  return {
    codigoPN: matchCodPN?.[1]?.trim(),
    nomePN: matchNomePN?.[1]?.trim(),
    cnpj: matchCnpj?.[1]?.trim(),
    numeroDocumento: numDocInferido,
    status: matchStatus?.[1]?.trim(),
    dataGeracaoBr,
    dataGeracaoISO: converterDataBrParaISO(dataGeracaoBr),
    totalValorBase: somaBase,
    totalBruto: matchTotalBruto ? parseMoedaBr(matchTotalBruto[1]) : somaComissao,
    totalLiquido: matchTotalLiquido ? parseMoedaBr(matchTotalLiquido[1]) : somaComissao,
    itens,
    textoBruto: textoNormalizado,
  };
}

/**
 * Lê um arquivo PDF (File) e retorna os dados estruturados do Relatório de Comissão
 */
export async function extrairDadosRelatorioPDF(arquivo: File): Promise<DadosRelatorioPDF> {
  const buffer = await arquivo.arrayBuffer();

  // Tenta primeiro via PDF.js (mantém ordenação exata por coordenadas X/Y)
  let texto = await extrairTextoComPdfJs(buffer);
  let resultado = texto ? analisarTextoRelatorioPDF(texto) : null;

  // Se não encontrou itens pelo PDF.js, tenta o extrator nativo FlateDecode
  if (!resultado || resultado.itens.length === 0) {
    const textoFallback = await extrairTextoNativoFallback(buffer);
    const resultadoFallback = analisarTextoRelatorioPDF(textoFallback);
    if (resultadoFallback.itens.length > 0 || !resultado) {
      resultado = resultadoFallback;
    }
  }

  return resultado;
}
