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
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
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
 * e unindo fragmentos adjacentes (ex: kerning de "1000452" + "111" ou "03/" + "11/2026") usando PDF.js
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
        width: number;
      }

      const items: PosItem[] = [];
      for (const item of textContent.items) {
        if ('str' in item && item.str.trim().length > 0) {
          const tx = item.transform;
          items.push({
            str: item.str,
            x: tx ? tx[4] : 0,
            y: tx ? tx[5] : 0,
            width: typeof item.width === 'number' ? item.width : item.str.length * 4.2,
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
        if (linha.items.length === 0) return '';

        let resultado = linha.items[0].str.trim();
        for (let idx = 1; idx < linha.items.length; idx++) {
          const ant = linha.items[idx - 1];
          const atual = linha.items[idx];
          const txtAnt = ant.str.trim();
          const txtAtual = atual.str.trim();
          const fimAnt = ant.x + (ant.width || 0);
          const gap = atual.x - fimAnt;

          // Se os fragmentos estão colados (kerning Crystal Reports, ex: "1000452" + "111" ou "03/" + "11/2026")
          const colados =
            gap <= 2.5 ||
            txtAnt.endsWith('/') ||
            txtAtual.startsWith('/') ||
            txtAtual === ':';

          resultado += (colados ? '' : ' ') + txtAtual;
        }
        return resultado;
      });

      paginasTexto.push(linhasPagina.join('\n'));
    }

    return paginasTexto.join('\n');
  } catch (err) {
    console.warn('Falha ao extrair texto via PDF.js, tentando extrator nativo CMap:', err);
    return null;
  }
}

/**
 * Descomprime bytes FlateDecode usando DecompressionStream nativo do navegador
 */
async function descomprimirFlate(dados: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
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

/**
 * Extrator nativo completo com suporte a tabelas ToUnicode CMap (Crystal Reports / SAP B1 / Administradoras)
 * e posicionamento de matriz de texto (Tm / Td / Tj / TJ). Funciona 100% offline no navegador.
 */
async function extrairTextoNativoFallback(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const latin1 = new TextDecoder('latin1').decode(bytes);

  // 1. Descomprime todos os objetos stream do PDF
  const streamsPorObj: Record<string, string> = {};
  const regexObjStream =
    /(\d+)\s+0\s+obj\s*<<(?:(?!endobj)[\s\S])*?>>\s*stream\r?\n([\s\S]*?)\r?\n?endstream/g;
  let matchObj: RegExpExecArray | null;

  while ((matchObj = regexObjStream.exec(latin1)) !== null) {
    const objId = matchObj[1];
    const conteudoRaw = matchObj[2];
    const streamBytes = new Uint8Array(conteudoRaw.length);
    for (let i = 0; i < conteudoRaw.length; i++) {
      streamBytes[i] = conteudoRaw.charCodeAt(i) & 0xff;
    }
    const descomprimido = await descomprimirFlate(streamBytes);
    streamsPorObj[objId] = descomprimido
      ? new TextDecoder('latin1').decode(descomprimido)
      : conteudoRaw;
  }

  // 2. Mapeia fontes (/9, /d, /e, /l, etc.) para suas tabelas ToUnicode CMap
  const fontObjParaToUnicodeObj: Record<string, string> = {};
  const reFontObj =
    /(\d+)\s+0\s+obj\s*<<(?:(?!endobj)[\s\S])*?\/ToUnicode\s+(\d+)\s+0\s+R(?:(?!endobj)[\s\S])*?>>/g;
  let mFont: RegExpExecArray | null;
  while ((mFont = reFontObj.exec(latin1)) !== null) {
    fontObjParaToUnicodeObj[mFont[1]] = mFont[2];
  }

  const fontNameParaUniObj: Record<string, string> = {};
  const reFontRes = /\/Font\s*<<([\s\S]*?)>>/g;
  let mRes: RegExpExecArray | null;
  while ((mRes = reFontRes.exec(latin1)) !== null) {
    const interno = mRes[1];
    const r2 = /(\/[0-9a-zA-Z_]+)\s+(\d+)\s+0\s+R/g;
    let m2: RegExpExecArray | null;
    while ((m2 = r2.exec(interno)) !== null) {
      const fName = m2[1];
      const fObj = m2[2];
      if (fontObjParaToUnicodeObj[fObj]) {
        fontNameParaUniObj[fName] = fontObjParaToUnicodeObj[fObj];
      }
    }
  }

  const cmaps: Record<string, Record<number, string>> = {};
  for (const [fName, uniObjId] of Object.entries(fontNameParaUniObj)) {
    const cmapText = streamsPorObj[uniObjId] || '';
    const map: Record<number, string> = {};

    const bfrangeBlocks = cmapText.match(/beginbfrange[\s\S]*?endbfrange/g) || [];
    for (const blk of bfrangeBlocks) {
      const rRange = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
      let cm: RegExpExecArray | null;
      while ((cm = rRange.exec(blk)) !== null) {
        const start = parseInt(cm[1], 16);
        const end = parseInt(cm[2], 16);
        const uni = parseInt(cm[3], 16);
        for (let c = start; c <= end; c++) {
          map[c] = String.fromCodePoint(uni + (c - start));
        }
      }
    }

    const bfcharBlocks = cmapText.match(/beginbfchar[\s\S]*?endbfchar/g) || [];
    for (const blk of bfcharBlocks) {
      const rChar = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
      let cm: RegExpExecArray | null;
      while ((cm = rChar.exec(blk)) !== null) {
        map[parseInt(cm[1], 16)] = String.fromCodePoint(parseInt(cm[2], 16));
      }
    }

    cmaps[fName] = map;
  }

  // 3. Percorre os content streams que possuem blocos BT ... ET e reconstrói as linhas por coordenada (X, Y)
  interface ItemPosicionado {
    x: number;
    y: number;
    text: string;
  }
  const itemsPosicionados: ItemPosicionado[] = [];

  for (const conteudo of Object.values(streamsPorObj)) {
    if (!conteudo.includes('BT') || conteudo.includes('begincmap')) continue;

    let curFont = '/d';
    let x = 0;
    let y = 0;
    let moveuDesdeUltimoTexto = true;

    const linhasStream = conteudo.split(/\r?\n/);
    for (const l of linhasStream) {
      const fm = l.match(/(\/[0-9a-zA-Z_]+)\s+[\d.]+\s+Tf/);
      if (fm) curFont = fm[1];

      const tm = l.match(/1\s+0\s+0\s+1\s+([-\d.]+)\s+([-\d.]+)\s+Tm/);
      if (tm) {
        x = parseFloat(tm[1]);
        y = parseFloat(tm[2]);
        moveuDesdeUltimoTexto = true;
      }

      const td = l.match(/([-\d.]+)\s+([-\d.]+)\s+T[dD]/);
      if (td) {
        x += parseFloat(td[1]);
        y += parseFloat(td[2]);
        moveuDesdeUltimoTexto = true;
      }

      if (l.includes('Tj') || l.includes('TJ')) {
        const partes: string[] = [];
        const rStr = /\((?:\\.|[^\\()])*\)/g;
        let sm: RegExpExecArray | null;
        while ((sm = rStr.exec(l)) !== null) {
          const raw = decodificarLiteralPdf(sm[0].slice(1, -1));
          const traduzido = Array.from(raw)
            .map((ch) => cmaps[curFont]?.[ch.charCodeAt(0)] ?? ch)
            .join('');
          partes.push(traduzido);
        }
        const textoOp = partes.join('');
        if (
          !moveuDesdeUltimoTexto &&
          itemsPosicionados.length > 0 &&
          Math.abs(itemsPosicionados[itemsPosicionados.length - 1].y - y) < 0.5
        ) {
          // Mesmo ponto sem Td/Tm intermediário (ex: kerning "1000452" + "111" ou "03/" + "11/2026")
          itemsPosicionados[itemsPosicionados.length - 1].text += textoOp;
        } else {
          itemsPosicionados.push({ x, y, text: textoOp });
        }
        moveuDesdeUltimoTexto = false;
      }
    }
  }

  if (itemsPosicionados.length > 0) {
    const linhasAgrupadas: { y: number; items: ItemPosicionado[] }[] = [];
    for (const it of itemsPosicionados) {
      let linha = linhasAgrupadas.find((r) => Math.abs(r.y - it.y) <= 3.5);
      if (!linha) {
        linha = { y: it.y, items: [] };
        linhasAgrupadas.push(linha);
      }
      linha.items.push(it);
    }
    linhasAgrupadas.sort((a, b) => b.y - a.y);
    return linhasAgrupadas
      .map((r) => {
        r.items.sort((a, b) => a.x - b.x);
        return r.items.map((i) => i.text.trim()).join(' ');
      })
      .join('\n');
  }

  return '';
}

/**
 * Faz o parse do texto extraído do PDF de Relatório de Comissão (padrão Âncora / Administradoras)
 */
export function analisarTextoRelatorioPDF(texto: string): DadosRelatorioPDF {
  // Normaliza quebras de linha, datas partidas por kerning ("06/ 11 /2026" -> "06/11/2026") e espaços antes de ":"
  const textoNormalizado = texto
    .replace(/\r/g, '\n')
    .replace(/(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/g, '$1/$2/$3')
    .replace(/\s+:/g, ':');

  // Metadados do cabeçalho
  const matchCodPN = textoNormalizado.match(/C[óo]digo\s+do\s+PN:\s*([A-Z0-9_-]+)/i);
  const matchNomePN = textoNormalizado.match(/Nome\s+do\s+PN:\s*([^\n]+?)(?:\s+Status:|\s+N[º°o]\s*documento:|\n|$)/i);
  const matchCnpj = textoNormalizado.match(/CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i);
  const matchNumDocHeader = textoNormalizado.match(/N[º°o]\s*documento:\s*(\d+)/i);
  const matchStatus = textoNormalizado.match(/Status:\s*([A-Za-zÀ-ÿ]+)/i);
  const matchDataGeracao = textoNormalizado.match(/Relat[óo]rio\s+gerado\s+em\s+(\d{2}\/\d{2}\/\d{4})/i);
  const matchTotalLiquido = textoNormalizado.match(/TOTAL\s+L[ÍI]QUIDO:?\s*R?\$?\s*([\d.]+,\d{2})/i);
  const matchTotalBruto = textoNormalizado.match(/TOTAL\s+BRUTO:?\s*R?\$?\s*([\d.]+,\d{2})/i);

  const itens: ItemRelatorioPDF[] = [];
  const chavesVistas = new Set<string>();

  // 1. Regex completa da linha padrão do relatório de comissão:
  // Nº doc | Repres | Data | Descrição | Tipo | Contrato (permite espaço de kerning ex: "1000452 111") | Venda | Grupo | Cota | Parcela | Valor Base | Valor
  const regexLinhaCompleta =
    /(\d{3,10})\s+(\d{3,10})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([A-Z])\s+(\d[\d\s]{4,16}\d)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2,6})\s+(\d{1,6})\s+(\d{1,3})\s+([\d.]+,\d{2})\s+(-?[\d.]+,\d{2})/g;

  let m: RegExpExecArray | null;
  while ((m = regexLinhaCompleta.exec(textoNormalizado)) !== null) {
    const numDoc = m[1].trim();
    const repres = m[2].trim();
    const dataRelBr = m[3].trim();
    const descricao = m[4].trim();
    const tipo = m[5].trim();
    const contrato = m[6].replace(/\s+/g, '');
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
      /(?:(\d{3,10})\s+(?:\d{3,10}\s+)?(\d{2}\/\d{2}\/\d{4})\s+[^\d\n]+?\s+)?(\d[\d\s]{5,16}\d)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2,6})\s+(\d{1,6})\s+(\d{1,3})\s+([\d.]+,\d{2})\s+(-?[\d.]+,\d{2})/g;

    while ((m = regexFallback.exec(textoNormalizado)) !== null) {
      const numDoc = (m[1] || matchNumDocHeader?.[1] || '').trim();
      const dataRelBr = (m[2] || matchDataGeracao?.[1] || '').trim();
      const contrato = m[3].replace(/\s+/g, '');
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
 * Lê um arquivo PDF (File) e retorna os dados estruturados do Relatório de Comissão.
 * Executa tanto o extrator nativo CMap quanto o PDF.js e escolhe o que extrair mais itens com precisão.
 */
export async function extrairDadosRelatorioPDF(arquivo: File): Promise<DadosRelatorioPDF> {
  const buffer = await arquivo.arrayBuffer();

  const textoNativo = await extrairTextoNativoFallback(buffer);
  const resultadoNativo = textoNativo ? analisarTextoRelatorioPDF(textoNativo) : null;

  // Se o extrator nativo CMap já extraiu os itens e bateu com o total líquido do relatório, retorna imediatamente
  if (
    resultadoNativo &&
    resultadoNativo.itens.length > 0 &&
    resultadoNativo.totalLiquido &&
    Math.abs(
      resultadoNativo.itens.reduce((s, i) => s + i.valorComissao, 0) - resultadoNativo.totalLiquido
    ) < 0.05
  ) {
    return resultadoNativo;
  }

  const textoPdfJs = await extrairTextoComPdfJs(buffer);
  const resultadoPdfJs = textoPdfJs ? analisarTextoRelatorioPDF(textoPdfJs) : null;

  if (resultadoPdfJs && resultadoNativo) {
    return resultadoPdfJs.itens.length >= resultadoNativo.itens.length
      ? resultadoPdfJs
      : resultadoNativo;
  }

  return resultadoPdfJs || resultadoNativo || analisarTextoRelatorioPDF('');
}
