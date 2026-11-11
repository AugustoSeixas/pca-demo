/* Gera app/modelos/DFD.docx, o modelo Word do DFD com marcadores do docxtemplater.
   Estrutura: a do DFD assinado de 2025 (PROJ CPROJ 02/2025), acrescida dos incisos III, IV e VII
   do art. 8º do Decreto nº 10.947/2022, ausentes naquele documento.
   Os textos fixos são lidos de app/schemas/dfd.json, para que tela e documento tenham a mesma redação.
   Uso (só para regenerar o modelo; a aplicação não depende deste script):
     npm install docx   &&   node tools/gerar-modelo-dfd.js
   (com o pacote instalado globalmente:  NODE_PATH=$(npm root -g) node tools/gerar-modelo-dfd.js)
   Depois que o modelo for revisado no Word pelo coordenador, o arquivo .docx passa a ser a fonte. */
const fs = require("fs");
const path = require("path");
const D = require("docx");

const raiz = path.join(__dirname, "..", "app");
const schema = JSON.parse(fs.readFileSync(path.join(raiz, "schemas", "dfd.json"), "utf8"));
const campo = (id) => schema.secoes.flatMap((s) => s.campos).find((c) => c.id === id);
const fixo = (id) => campo(id).texto;

const FONTE = "Arial";
const LARGURA = 11906 - 1701 - 1134; /* A4 menos margens: 9071 DXA */
const CINZA = "5A6672";

const run = (text, o = {}) => new D.TextRun({ text, font: FONTE, size: o.size || 22, bold: !!o.bold, italics: !!o.italics, color: o.color });
const par = (filhos, o = {}) =>
  new D.Paragraph({
    alignment: o.al || D.AlignmentType.JUSTIFIED,
    spacing: { before: o.before || 0, after: o.after == null ? 120 : o.after, line: 276, lineRule: D.LineRuleType.AUTO }, /* 1,15 linha, proporcional ao tamanho da fonte */
    keepNext: !!o.keepNext,
    pageBreakBefore: !!o.quebra,
    children: (Array.isArray(filhos) ? filhos : [filhos]).map((f) => (typeof f === "string" ? run(f, o) : f))
  });
const centro = (t, o = {}) => par(t, Object.assign({ al: D.AlignmentType.CENTER }, o));
const tag = (t) => par(t, { al: D.AlignmentType.LEFT, after: 0 }); /* parágrafo só com marcador de laço: some na geração */
const h1 = (t, ref) =>
  new D.Paragraph({
    heading: D.HeadingLevel.HEADING_1,
    children: [run(t, { bold: true }), ...(ref ? [run(`  (${ref})`, { size: 18, color: CINZA })] : [])]
  });
const h2 = (t, ref) =>
  new D.Paragraph({
    heading: D.HeadingLevel.HEADING_2,
    children: [run(t, { bold: true }), ...(ref ? [run(`  (${ref})`, { size: 18, color: CINZA })] : [])]
  });
/* Texto longo: um parágrafo do Word por linha digitada. */
const laco = (m) => [tag(`{#${m}}`), par("{.}"), tag(`{/${m}}`)];

const borda = { style: D.BorderStyle.SINGLE, size: 4, color: "8A96A3" };
const bordas = { top: borda, bottom: borda, left: borda, right: borda };
const COLS = [900, 5371, 1300, 1500];
const cel = (texto, i, o = {}) =>
  new D.TableCell({
    width: { size: COLS[i], type: D.WidthType.DXA },
    borders: bordas,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: o.cab ? { type: D.ShadingType.CLEAR, fill: "E7EBEF", color: "auto" } : undefined,
    children: [par(texto, { al: o.al || D.AlignmentType.LEFT, after: 0, bold: !!o.cab, size: 20 })]
  });
const tabelaItens = new D.Table({
  width: { size: LARGURA, type: D.WidthType.DXA },
  columnWidths: COLS,
  rows: [
    new D.TableRow({ tableHeader: true, children: [cel("Item", 0, { cab: true, al: D.AlignmentType.CENTER }), cel("Descrição", 1, { cab: true }), cel("Unidade", 2, { cab: true, al: D.AlignmentType.CENTER }), cel("Quantidade", 3, { cab: true, al: D.AlignmentType.RIGHT })] }),
    new D.TableRow({ children: [cel("{#itens}{n}", 0, { al: D.AlignmentType.CENTER }), cel("{descricao}", 1), cel("{unidade}", 2, { al: D.AlignmentType.CENTER }), cel("{quantidade}{/itens}", 3, { al: D.AlignmentType.RIGHT })] })
  ]
});

const tabDireita = [{ type: D.TabStopType.RIGHT, position: LARGURA }];
const cabecalho = new D.Header({
  children: [
    new D.Paragraph({ tabStops: tabDireita, spacing: { after: 0 }, children: [run("SIMS/TRT 17ª Região", { size: 18, color: CINZA }), run("\tDocumento de Formalização de Demanda", { size: 18, color: CINZA })] }),
    new D.Paragraph({
      tabStops: tabDireita,
      spacing: { after: 240 },
      border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: "8A96A3", space: 4 } },
      children: [
        run("{unidade_sigla}", { size: 18, color: CINZA }),
        new D.TextRun({ font: FONTE, size: 18, color: CINZA, children: ["\t", D.PageNumber.CURRENT, "/", D.PageNumber.TOTAL_PAGES] })
      ]
    })
  ]
});
const rodape = new D.Footer({
  children: [centro("Gerado pelo PCA (protótipo) em {gerado_em} · contratação {id} · revisão {revisao}", { size: 16, color: CINZA, after: 0 })]
});

const capa = fixo("capa"); /* SIMS · Secretaria… · FORMALIZAÇÃO DE DEMANDA · Criação de Projeto… · Vitória/ES */
const corpo = [
  /* ----- capa ----- */
  centro(capa[0], { bold: true, size: 40, before: 1800, after: 60 }),
  centro(capa[1], { size: 26, after: 1800 }),
  centro(capa[2], { bold: true, size: 36, after: 120 }),
  centro(capa[3], { size: 26, after: 1500 }),
  centro("{titulo}", { bold: true, size: 30, after: 2400 }),
  centro(capa[4], { size: 24, after: 60 }),
  centro("{ano}", { size: 24, after: 0 }),

  /* ----- corpo ----- */
  par("Contratação PCA nº {id}{#tem_processo_sei} · Processo SEI nº {processo_sei}{/tem_processo_sei}", { quebra: true, al: D.AlignmentType.LEFT, size: 18, color: CINZA, after: 120 }),

  h1("1. CARACTERIZAÇÃO DA DEMANDA"),
  h2("1) Justificativa da necessidade", "Decreto nº 10.947/2022, art. 8º, I"),
  ...laco("justificativa"),
  h2("2) Descrição sucinta do objeto", "art. 8º, II"),
  ...laco("objeto"),
  h2("3) Quantidade a ser contratada", "art. 8º, III"),
  tabelaItens,
  par("", { after: 60 }),
  ...laco("quantidade_memoria"),
  h2("4) Estimativa preliminar do valor", "art. 8º, IV"),
  par("Valor estimado da contratação: {valor_estimado}."),
  ...laco("valor_base"),

  h1("2. PREVISÃO DE CONTRATAÇÃO", "art. 8º, V"),
  par("Considerando as etapas de planejamento e orçamento e, ainda, a seleção do fornecedor, a data pretendida para a conclusão da contratação é {data_conclusao_extenso}."),

  h1("3. GRAU DE PRIORIDADE", "art. 8º, VI"),
  par([run("Grau de prioridade: "), run("{prioridade}", { bold: true }), run(".")]),
  ...laco("prioridade_justificativa"),

  h1("4. VINCULAÇÃO OU DEPENDÊNCIA COM OUTRO DFD", "art. 8º, VII"),
  par("{vinculacao}."),
  ...laco("vinculacao_descricao"),

  h1("5. RESPONSÁVEIS", "art. 8º, VIII"),
  par("Área requisitante: {unidade}."),
  par(
    "Indico o(a) servidor(a) {responsavel} como responsável técnico(a), que será o(a) autor(a) da definição de solução, especificações técnicas e planejamento da contratação{#tem_equipe}, com a participação {equipe} na equipe de planejamento para atuação na revisão e aprovação dos documentos, para proposta de contratação (excluindo-se peças essencialmente técnicas){/tem_equipe}."
  ),

  h1("6. SOLICITAÇÃO DE FORMALIZAÇÃO DE DEMANDA"),
  ...fixo("declaracao").map((t) => par(t)),

  h1("7. FORMALIZAÇÃO DA DEMANDA"),
  ...fixo("aprovacao").map((t) => par(t)),

  /* ----- assinaturas: um bloco por autoridade ----- */
  tag("{#assinaturas}"),
  centro("{nome}", { bold: true, before: 600, after: 0, keepNext: true }),
  centro("{cargo}", { after: 0, keepNext: true }),
  centro("{lotacao}", { after: 0 }),
  tag("{/assinaturas}")
];

const estiloTitulo = (antes) => ({ run: { font: FONTE, size: 22, bold: true }, paragraph: { spacing: { before: antes, after: 120 }, keepNext: true } });
const doc = new D.Document({
  creator: "PCA (protótipo)",
  title: "Modelo de DFD — PCA",
  description: "Modelo Word com marcadores do docxtemplater. Schema: dfd.json " + schema.versao,
  styles: {
    default: { document: { run: { font: FONTE, size: 22 } }, heading1: estiloTitulo(360), heading2: estiloTitulo(200) }
  },
  sections: [
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1418, bottom: 1134, left: 1701, right: 1134, header: 567, footer: 567 } } },
      headers: { default: cabecalho },
      footers: { default: rodape },
      children: corpo
    }
  ]
});

D.Packer.toBuffer(doc).then((buf) => {
  const destino = path.join(raiz, "modelos", "DFD.docx");
  fs.writeFileSync(destino, buf);
  console.log("Modelo gravado:", destino, buf.length, "bytes");
});
