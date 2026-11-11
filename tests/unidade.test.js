/* PCA — testes de unidade das regras de negócio, dos schemas e da persistência.
   Sem dependências. Uso, na raiz do repositório:   node --test tests/unidade.test.js
   As regras RN-01 a RN-11 são as da Especificação de Trabalho de 28/09/2026, seção 4. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const APP = path.join(__dirname, "..", "app");
const json = (rel) => JSON.parse(fs.readFileSync(path.join(APP, rel), "utf8"));

/* localStorage simulado, antes de carregar o módulo de persistência */
const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => void memoria.set(k, String(v)),
  removeItem: (k) => void memoria.delete(k),
  clear: () => memoria.clear()
};
require(path.join(APP, "js", "pca-util.js"));
require(path.join(APP, "js", "pca-regras.js"));
require(path.join(APP, "js", "pca-store.js"));
const { util: U, regras: R, store: S } = globalThis.PCA;

const SCHEMAS = Object.fromEntries(["identificacao", "dfd", "etp", "tr", "mapa"].map((a) => [a, json(`schemas/${a}.json`)]));
const CAD = json("schemas/cadastros.json");
const CASO = json("casos/baterias.json");

function estadoDoCaso() {
  const e = R.novoEstado({ id: "2026-001", quem: "teste", identificacao: U.clone(CASO.identificacao) });
  e.artefatos.dfd.campos = U.clone(CASO.dfd);
  e.artefatos.dfd.status = "rascunho";
  return e;
}

/* ---------------- utilidades ---------------- */
test("lerNumero aceita os formatos brasileiros e recusa texto", () => {
  assert.equal(U.lerNumero("110.000,50"), 110000.5);
  assert.equal(U.lerNumero("110000,5"), 110000.5);
  assert.equal(U.lerNumero("110000.5"), 110000.5);
  assert.equal(U.lerNumero("R$ 1.234,00"), 1234);
  assert.equal(U.lerNumero("1.234"), 1234);
  assert.equal(U.lerNumero("256"), 256);
  assert.equal(U.lerNumero("0,3"), 0.3);
  assert.equal(U.lerNumero(""), null);
  assert.equal(U.lerNumero("   "), null);
  assert.ok(Number.isNaN(U.lerNumero("abc")));
  assert.ok(Number.isNaN(U.lerNumero("12,3,4")));
  assert.ok(Number.isNaN(U.lerNumero("1e5")));
});

test("datas e moeda são formatadas sem depender de fuso", () => {
  assert.equal(U.dataBR("2025-07-31"), "31/07/2025");
  assert.equal(U.dataExtenso("2025-07-31"), "31 de julho de 2025");
  assert.equal(U.dataExtenso("2026-03-01"), "1º de março de 2026");
  assert.equal(U.dataBR(""), "");
  assert.equal(U.moeda(110000), "R$ 110.000,00");
  assert.equal(U.moeda(1325.7), "R$ 1.325,70");
  assert.equal(U.moeda(NaN), "");
  assert.equal(U.decimal(232), "232,00");
  assert.match(U.agoraISO(new Date(2026, 10, 12, 14, 32, 5)), /^2026-11-12T14:32:05[+-]\d{2}:\d{2}$/);
});

test("esc neutraliza marcação e urlValida exige http(s)", () => {
  assert.equal(U.esc('<img src=x onerror="a()">'), "&lt;img src=x onerror=&quot;a()&quot;&gt;");
  assert.equal(U.esc(null), "");
  assert.ok(U.urlValida("https://pncp.gov.br/app/editais/1"));
  assert.ok(!U.urlValida("javascript:alert(1)"));
  assert.ok(!U.urlValida("pncp.gov.br"));
  assert.deepEqual(U.paragrafos("a\n\n  b  \r\nc"), ["a", "b", "c"]);
  assert.equal(U.slug("Não há vinculação"), "nao_ha_vinculacao");
});

/* ---------------- schemas ---------------- */
const CLASSES = ["FIXO", "HERDADO", "USUARIO", "BUSCA", "REDIGIDO"];
const TIPOS = ["texto", "texto_longo", "numero", "moeda", "data", "selecao", "tabela"];
const TIPOS_COLUNA = ["texto", "numero", "moeda", "data", "selecao", "url"];

for (const [nome, schema] of Object.entries(SCHEMAS)) {
  test(`schema ${nome}: estrutura, classes, tipos e identificadores únicos`, () => {
    assert.equal(schema.artefato, nome);
    assert.match(schema.versao, /^2\./);
    const campos = R.todosCampos(schema);
    assert.ok(campos.length > 0);
    const ids = campos.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, "ids repetidos");
    const marcadores = campos.filter((c) => c.marcador).map((c) => c.marcador);
    assert.equal(new Set(marcadores).size, marcadores.length, "marcadores repetidos");
    for (const c of campos) {
      assert.match(c.id, /^[a-z][a-z0-9_]*$/, `id inválido: ${c.id}`);
      assert.ok(c.rotulo, `sem rótulo: ${c.id}`);
      assert.ok(CLASSES.includes(c.classe), `classe inválida em ${c.id}: ${c.classe}`);
      assert.ok(TIPOS.includes(c.tipo), `tipo inválido em ${c.id}: ${c.tipo}`);
      if (c.classe === "FIXO") assert.ok(Array.isArray(c.texto), `FIXO sem texto: ${c.id}`);
      else assert.ok(c.marcador, `campo sem marcador: ${c.id}`);
      if (c.classe === "HERDADO") assert.match(c.origem || "", /^(contratacao|dfd|etp|tr)\.[a-z_]+$/, `origem inválida em ${c.id}`);
      if (c.tipo === "selecao") assert.ok((Array.isArray(c.opcoes) && c.opcoes.length >= 2) || c.opcoes_de, `seleção sem opções: ${c.id}`);
      if (c.tipo === "tabela") {
        assert.ok(Array.isArray(c.colunas) && c.colunas.length, `tabela sem colunas: ${c.id}`);
        for (const col of c.colunas) assert.ok(TIPOS_COLUNA.includes(col.tipo), `tipo de coluna inválido em ${c.id}.${col.id}`);
      }
      for (const cond of [c.visivel_se, c.obrigatorio && c.obrigatorio.se].filter(Boolean)) assert.ok(ids.includes(cond.campo), `condição aponta para campo inexistente em ${c.id}`);
    }
  });
}

test("RN-02: toda origem de campo HERDADO existe no documento de origem", () => {
  const disponiveis = {
    contratacao: new Set([...R.todosCampos(SCHEMAS.identificacao).map((c) => c.id), "id", "unidade_sigla", "unidade_nome", "unidade_descricao"]),
    dfd: new Set(R.todosCampos(SCHEMAS.dfd).map((c) => c.id)),
    etp: new Set(R.todosCampos(SCHEMAS.etp).map((c) => c.id)),
    tr: new Set(R.todosCampos(SCHEMAS.tr).map((c) => c.id))
  };
  const ordem = ["contratacao", "dfd", "etp", "tr", "mapa"];
  for (const [nome, schema] of Object.entries(SCHEMAS)) {
    for (const c of R.todosCampos(schema).filter((x) => x.classe === "HERDADO")) {
      const [raiz, campo] = c.origem.split(".");
      assert.ok(disponiveis[raiz].has(campo), `${nome}.${c.id} herda de ${c.origem}, que não existe`);
      assert.ok(ordem.indexOf(raiz) < ordem.indexOf(nome === "identificacao" ? "contratacao" : nome), `${nome}.${c.id} herda de documento posterior`);
    }
  }
});

test("DFD cobre os oito incisos do art. 8º do Decreto nº 10.947/2022, todos obrigatórios", () => {
  const campos = R.todosCampos(SCHEMAS.dfd);
  for (const inciso of ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]) {
    const doInciso = campos.filter((c) => c.ref === `art. 8º, ${inciso}`);
    assert.ok(doInciso.length, `inciso ${inciso} sem campo`);
    assert.ok(doInciso.some((c) => c.obrigatorio === true), `inciso ${inciso} sem campo obrigatório`);
    for (const c of doInciso) assert.equal(c.fundamento, `Decreto nº 10.947/2022, art. 8º, ${inciso}`);
  }
});

test("RN-06: no ETP simplificado ficam obrigatórios só os incisos I, IV, VI, VIII e XIII", () => {
  const e = estadoDoCaso();
  e.artefatos.etp.modo = "simplificado";
  const incisos = new Set();
  for (const c of R.todosCampos(SCHEMAS.etp)) {
    const m = /^art\. 18, §1º, ([IVX]+)$/.exec(c.ref || "");
    if (m && R.obrigatorio(c, e, "etp")) incisos.add(m[1]);
  }
  assert.deepEqual([...incisos].sort(), ["I", "IV", "VI", "VIII", "XIII"].sort());
  e.artefatos.etp.modo = "completo";
  const completos = new Set();
  for (const c of R.todosCampos(SCHEMAS.etp)) {
    const m = /^art\. 18, §1º, ([IVX]+)$/.exec(c.ref || "");
    if (m && R.obrigatorio(c, e, "etp")) completos.add(m[1]);
  }
  assert.equal(completos.size, 13);
});

/* ---------------- preenchimento e pendências ---------------- */
test("caso de referência: identificação e DFD sem pendências", () => {
  const e = estadoDoCaso();
  assert.deepEqual(R.pendencias(SCHEMAS.identificacao, e, CAD), []);
  assert.deepEqual(R.pendencias(SCHEMAS.dfd, e, CAD), []);
});

test("DFD: cada campo obrigatório vazio vira pendência com o dispositivo legal", () => {
  for (const id of ["justificativa", "objeto", "valor_estimado", "valor_base", "data_conclusao", "prioridade", "vinculacao"]) {
    const e = estadoDoCaso();
    delete e.artefatos.dfd.campos[id];
    const p = R.pendencias(SCHEMAS.dfd, e, CAD);
    assert.equal(p.length, 1, `esperada uma pendência ao apagar ${id}`);
    assert.equal(p[0].id, id);
    assert.match(p[0].fundamento, /^Decreto nº 10\.947\/2022, art\. 8º, [IVX]+$/);
  }
  const e = estadoDoCaso();
  e.artefatos.dfd.campos.itens = [];
  assert.equal(R.pendencias(SCHEMAS.dfd, e, CAD)[0].id, "itens");
});

test("DFD: quantidade e valor precisam ser números maiores que zero", () => {
  const e = estadoDoCaso();
  e.artefatos.dfd.campos.itens[0].quantidade = 0;
  assert.match(R.pendencias(SCHEMAS.dfd, e, CAD)[0].msgs[0], /maior que zero/);
  e.artefatos.dfd.campos.itens[0].quantidade = NaN;
  assert.match(R.pendencias(SCHEMAS.dfd, e, CAD)[0].msgs[0], /não é um número válido/);
  e.artefatos.dfd.campos.itens[0].quantidade = 256;
  e.artefatos.dfd.campos.itens[1].descricao = "  ";
  assert.match(R.pendencias(SCHEMAS.dfd, e, CAD)[0].msgs[0], /Linha 2/);
  e.artefatos.dfd.campos.itens[1].descricao = "Bateria";
  e.artefatos.dfd.campos.valor_estimado = -5;
  assert.equal(R.pendencias(SCHEMAS.dfd, e, CAD)[0].id, "valor_estimado");
});

test("DFD: justificativa de prioridade só é exigida no grau Alto; descrição só quando há vinculação", () => {
  const e = estadoDoCaso();
  e.artefatos.dfd.campos.prioridade_justificativa = "";
  assert.equal(R.pendencias(SCHEMAS.dfd, e, CAD)[0].id, "prioridade_justificativa");
  e.artefatos.dfd.campos.prioridade = "Médio";
  assert.deepEqual(R.pendencias(SCHEMAS.dfd, e, CAD), []);
  e.artefatos.dfd.campos.vinculacao_descricao = "";
  assert.deepEqual(R.pendencias(SCHEMAS.dfd, e, CAD), []);
  e.artefatos.dfd.campos.vinculacao = SCHEMAS.dfd.secoes.find((s) => s.id === "vinculacao").campos[0].opcoes[1];
  assert.equal(R.pendencias(SCHEMAS.dfd, e, CAD)[0].id, "vinculacao_descricao");
  e.artefatos.dfd.campos.prioridade = "Urgente";
  assert.ok(R.pendencias(SCHEMAS.dfd, e, CAD).some((p) => p.id === "prioridade" && /fora da lista/.test(p.msgs[0])));
});

test("RN-02: pendência em campo herdado manda preencher na origem", () => {
  const e = estadoDoCaso();
  e.identificacao.campos.responsavel = "";
  const p = R.pendencias(SCHEMAS.dfd, e, CAD).find((x) => x.id === "responsavel");
  assert.equal(p.origem, "identificacao");
  assert.match(p.msgs[0], /Preencha na origem: Identificação/);
  const campo = R.todosCampos(SCHEMAS.dfd).find((c) => c.id === "unidade");
  assert.equal(R.valor(campo, estadoDoCaso(), "dfd", CAD), "Coordenadoria de Projetos (CPROJ)");
});

test("RN-04: campo de busca exige valor, fonte, URL e data", () => {
  const campo = { id: "x", classe: "BUSCA", tipo: "texto" };
  assert.deepEqual(R.problemas(campo, undefined, false), []);
  assert.equal(R.problemas(campo, undefined, true).length, 1);
  assert.equal(R.problemas(campo, { valor: "12 V", fonte: "", url: "", data: "" }, false).length, 3);
  assert.equal(R.problemas(campo, { valor: "12 V", fonte: "Fabricante", url: "fabricante.com", data: "2026-11-11" }, true).length, 1);
  assert.deepEqual(R.problemas(campo, { valor: "12 V", fonte: "Fabricante", url: "https://fabricante.com/c.pdf", data: "2026-11-11" }, true), []);
  const tabela = R.todosCampos(SCHEMAS.etp).find((c) => c.id === "cotacoes");
  const linha = { item: "Bateria", nivel: "PNCP", fonte: "PNCP", url: "sem-esquema", data: "2026-11-11", valor: 232, usar: "Sim" };
  assert.match(R.problemas(tabela, [linha], true)[0], /deve começar com http/);
});

/* ---------------- fluxo: ordem, checkpoint, reabertura ---------------- */
test("RN-01: cada documento só é liberado depois da validação do anterior, com registro de quem e quando", () => {
  const e = estadoDoCaso();
  assert.ok(R.liberado(e, "dfd"));
  assert.ok(!R.liberado(e, "etp"));
  assert.throws(() => R.validar(e, "etp", "ana"), /RN-01/);
  R.validar(e, "dfd", "ana");
  assert.equal(e.artefatos.dfd.status, "validado");
  assert.equal(e.etapaAtual, "etp");
  assert.ok(R.liberado(e, "etp"));
  assert.ok(!R.liberado(e, "tr"));
  assert.ok(!R.editavel(e, "dfd"), "documento validado não é editável");
  const ev = e.eventos[e.eventos.length - 1];
  assert.equal(ev.acao, "validou");
  assert.equal(ev.artefato, "dfd");
  assert.equal(ev.quem, "ana");
  assert.match(ev.quando, /^\d{4}-\d{2}-\d{2}T/);
});

test("RN-03: reabrir marca os dependentes como desatualizados até nova validação", () => {
  const e = estadoDoCaso();
  R.validar(e, "dfd", "ana");
  R.validar(e, "etp", "ana");
  e.artefatos.tr.status = "rascunho";
  const afetados = R.reabrir(e, "dfd", "bia");
  assert.deepEqual(afetados, ["etp", "tr"]);
  assert.equal(e.artefatos.dfd.status, "rascunho");
  assert.equal(e.artefatos.etp.status, "desatualizado");
  assert.equal(e.artefatos.tr.status, "desatualizado");
  assert.equal(e.artefatos.mapa.status, "nao_iniciado");
  assert.ok(!R.liberado(e, "etp"));
  assert.deepEqual(e.eventos[e.eventos.length - 1].desatualizados, ["etp", "tr"]);
  R.validar(e, "dfd", "bia");
  assert.ok(R.liberado(e, "etp"));
  assert.ok(R.editavel(e, "etp"));
  assert.equal(R.verificarEstado(e).length, 0);
});

test("RN-03: alterar a identificação desatualiza os documentos já validados", () => {
  const e = estadoDoCaso();
  R.validar(e, "dfd", "ana");
  const afetados = R.identificacaoAlterada(e, "ana");
  assert.deepEqual(afetados, ["dfd"]);
  assert.equal(e.artefatos.dfd.status, "desatualizado");
  assert.ok(!R.liberado(e, "etp"));
});

test("RN-07: média e mediana das cotações (conferidas com o ETP real das baterias)", () => {
  const a = R.estatisticas([283.73, 205.0, 197.31, 259.0]);
  assert.equal(a.n, 4);
  assert.equal(a.media, 236.26);
  assert.equal(a.mediana, 232.0);
  const b = R.estatisticas([1791.88, 1426.5, 1224.9, 1100.0]);
  assert.equal(b.media, 1385.82);
  assert.equal(b.mediana, 1325.7);
  assert.equal(R.estatisticas([3, 1, 2]).mediana, 2);
  assert.equal(R.estatisticas([]).media, null);
  assert.equal(U.r2(256 * a.mediana + 36 * b.mediana), 107117.2);
});

test("RN-08: grau de risco = P × I, com as faixas do modelo EP 3.01", () => {
  assert.deepEqual(R.grauRisco(0.1, 5), { grau: 0.5, classe: "Insignificante" });
  assert.deepEqual(R.grauRisco(0.3, 5), { grau: 1.5, classe: "Leve" });
  assert.deepEqual(R.grauRisco(0.5, 5), { grau: 2.5, classe: "Médio" });
  assert.deepEqual(R.grauRisco(0.7, 5), { grau: 3.5, classe: "Alto" });
  assert.deepEqual(R.grauRisco(1, 5), { grau: 5, classe: "Muito alto" });
  assert.deepEqual(R.grauRisco(0.5, 2), { grau: 1, classe: "Leve" });
});

/* ---------------- persistência ---------------- */
test("RN-11: código anual sequencial AAAA-NNN", () => {
  assert.equal(R.proximoId([], 2026), "2026-001");
  assert.equal(R.proximoId([{ id: "2026-001" }, { id: "2026-007" }, { id: "2025-030" }], 2026), "2026-008");
  assert.equal(R.proximoId([{ id: "2026-999" }], 2026), "2026-1000");
});

test("RN-09: gravação aumenta a revisão e recusa sobrescrever versão mais nova", () => {
  memoria.clear();
  const e = estadoDoCaso();
  const r1 = S.salvar(e, 0, true);
  assert.equal(r1.revisao, 1);
  assert.equal(S.indice().length, 1);
  assert.equal(S.indice()[0].objeto, CASO.identificacao.objeto);
  /* duas abas leram a revisão 1 */
  const abaA = S.carregar("2026-001"), abaB = S.carregar("2026-001");
  abaA.artefatos.dfd.campos.valor_base = "Aba A";
  assert.equal(S.salvar(abaA, 1).revisao, 2);
  abaB.artefatos.dfd.campos.valor_base = "Aba B";
  assert.throws(() => S.salvar(abaB, 1), (err) => err.codigo === "CONFLITO" && err.revisaoGravada === 2);
  assert.equal(S.carregar("2026-001").artefatos.dfd.campos.valor_base, "Aba A", "nada foi sobrescrito");
  assert.equal(S.salvar(abaB, 1, true).revisao, 3);
  assert.equal(S.carregar("2026-001").artefatos.dfd.campos.valor_base, "Aba B");
  S.excluir("2026-001");
  assert.equal(S.indice().length, 0);
  assert.throws(() => S.carregar("2026-001"), (err) => err.codigo === "NAO_ENCONTRADO");
});

test("estado.json: exportar e importar preserva o conteúdo; arquivo estranho é recusado", () => {
  memoria.clear();
  const e = estadoDoCaso();
  R.validar(e, "dfd", "ana");
  S.salvar(e, 0, true);
  const texto = S.exportar(S.carregar("2026-001"));
  memoria.clear();
  const lido = S.lerArquivo(texto);
  S.importar(lido, "bia");
  const de_volta = S.carregar("2026-001");
  assert.deepEqual(de_volta.artefatos, e.artefatos);
  assert.deepEqual(de_volta.identificacao, e.identificacao);
  assert.equal(de_volta.eventos[de_volta.eventos.length - 1].acao, "importou");
  S.importar(lido, "bia", "2026-002");
  assert.equal(S.carregar("2026-002").id, "2026-002");
  assert.equal(S.indice().length, 2);

  assert.throws(() => S.lerArquivo("isto não é json"), (err) => err.codigo === "VALIDACAO");
  for (const estragar of [
    (x) => delete x.artefatos,
    (x) => (x.id = "abc"),
    (x) => (x.id = 2026),
    (x) => (x.schemaVersao = "1.0"),
    (x) => (x.revisao = -1),
    (x) => (x.artefatos.dfd.status = "aprovado"),
    (x) => (x.artefatos.etp.campos = null),
    (x) => (x.identificacao.campos = null),
    (x) => (x.eventos = "nenhum"),
    (x) => (x.eventos = [null]),
    (x) => (x.etapaAtual = '"><img src=x onerror=alert(1)>'),
    (x) => (x.casoReferencia = { descricao: "x", procedencia: "y" })
  ]) {
    const ruim = JSON.parse(texto);
    estragar(ruim);
    assert.throws(() => S.lerArquivo(JSON.stringify(ruim)), (err) => err.codigo === "VALIDACAO" && err.problemas.length > 0);
  }
  assert.deepEqual(R.verificarEstado([]), ["O arquivo não contém um estado do PCA."]);
});

test("RN-01 na importação: arquivo com documento validado sem o anterior validado é recusado", () => {
  const e = estadoDoCaso();
  e.artefatos.etp.status = "validado";
  assert.ok(R.verificarEstado(e).some((p) => /incoerente/.test(p)));
  e.artefatos.dfd.status = "validado";
  assert.deepEqual(R.verificarEstado(e), []);
});
