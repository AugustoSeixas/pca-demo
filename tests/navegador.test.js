/* PCA — teste de ponta a ponta em navegador sem interface (Playwright + Chrome).
   Percorre o que o roteiro manual da E1 pede e mais os casos de borda:
   criar, preencher, gravar, fechar e retomar, validar, gerar o DFD.docx, exportar e importar o estado.json,
   reabrir, conflito entre abas, identificação travada, entrada hostil e a página de sondagem.

   Uso, na raiz do repositório (com um servidor HTTP servindo a raiz):
     python3 -m http.server 8765 --bind 127.0.0.1 &
     NODE_PATH=$(npm root -g) node tests/navegador.test.js [http://127.0.0.1:8765]
   Requer o pacote playwright e um Chrome/Chromium (variável CHROME, padrão /usr/bin/google-chrome). */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE = (process.argv[2] || "http://127.0.0.1:8765").replace(/\/$/, "");
const APP = BASE + "/app/";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "pca-e2e-"));
const ANO = new Date().getFullYear();
const ID1 = `${ANO}-001`;

let passo = 0;
const ok = (msg) => console.log(`ok ${String(++passo).padStart(2, "0")}  ${msg}`);
const problemas = [];

function vigiar(page, nome, tolerarRede) {
  page.on("console", (m) => {
    /* Na sondagem, falhas de rede e recusas 401/403 são resultados esperados dos testes, não defeitos. */
    if (m.type() === "error" && !(tolerarRede && /Failed to load resource/.test(m.text()))) problemas.push(`[${nome}] console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problemas.push(`[${nome}] erro de página: ${e.message}`));
  page.on("requestfailed", (r) => {
    if (r.url().startsWith(BASE)) problemas.push(`[${nome}] requisição falhou: ${r.url()}`);
  });
  page.on("response", (r) => {
    if (r.url().startsWith(BASE) && r.status() >= 400) problemas.push(`[${nome}] HTTP ${r.status()}: ${r.url()}`);
  });
}
const salvo = (page) => page.waitForFunction(() => /^salvo às/.test(document.querySelector("#save").textContent), null, { timeout: 8000 });
const texto = (page, sel) => page.locator(sel).innerText();
const revisao = (page) => page.evaluate(() => PCA.app.estado.revisao);
const gravado = (page, id) => page.evaluate((i) => JSON.parse(localStorage.getItem("pca.v1.contratacao." + i)), id);
async function digitar(page, sel, valor) {
  await page.fill(sel, valor);
  await page.press(sel, "Tab");
}
/* Digita no fim do campo e permanece nele (não dispara "change"), como quem ainda está escrevendo. */
async function acrescentar(page, sel, valor) {
  await page.focus(sel);
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    el.setSelectionRange(el.value.length, el.value.length);
  }, sel);
  await page.keyboard.type(valor);
}
async function baixar(page, acao) {
  const [d] = await Promise.all([page.waitForEvent("download"), acao()]);
  const destino = path.join(TMP, d.suggestedFilename());
  await d.saveAs(destino);
  return { nome: d.suggestedFilename(), caminho: destino };
}
/* Abre um .docx dentro da página (PizZip já está carregado) e devolve o texto e a boa formação do XML. */
async function lerDocx(page, caminho) {
  const b64 = fs.readFileSync(caminho).toString("base64");
  return page.evaluate((b) => {
    const zip = new PizZip(atob(b));
    const partes = {};
    Object.keys(zip.files).forEach((n) => {
      if (/^word\/(document|header\d*|footer\d*)\.xml$/.test(n)) partes[n] = zip.files[n].asText();
    });
    const malformado = Object.entries(partes).filter(([, x]) => new DOMParser().parseFromString(x, "application/xml").getElementsByTagName("parsererror").length).map(([n]) => n);
    const limpo = (x) => x.replace(/<w:tab\/>/g, "\t").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
    return { arquivos: Object.keys(zip.files), malformado, corpo: limpo(partes["word/document.xml"]), todos: Object.values(partes).map(limpo).join("\n") };
  }, b64);
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, locale: "pt-BR" });
  const page = await ctx.newPage();
  vigiar(page, "A");

  /* ---------- tela inicial e nova contratação ---------- */
  await page.goto(APP);
  await page.waitForSelector("#usuario");
  assert.match(await texto(page, "#lista"), /Nenhuma contratação neste navegador/);
  await page.fill("#usuario", "Servidora de Teste");
  await page.click("[data-app=novo]");
  await page.waitForSelector("#form-nova .field");
  assert.ok(await page.isDisabled("#btn-criar"), "não cria com a identificação incompleta");
  assert.match(await texto(page, "#sit-nova"), /Faltam 3 campo/);
  assert.equal(await page.inputValue("#form-nova [data-campo=autoridades][data-linha='1'][data-col=lotacao]"), "", "sem unidade escolhida, a lotação que depende dela fica em branco");
  await digitar(page, "#c-identificacao-objeto", "Baterias para os nobreaks do Ed. Sede");
  await page.selectOption("#c-identificacao-unidade", "CMOPE");
  await page.waitForFunction(() => document.querySelector("#form-nova [data-campo=autoridades][data-linha='1'][data-col=lotacao]").value === "CMOPE / SIMS");
  await page.selectOption("#c-identificacao-unidade", "CPROJ");
  await page.waitForFunction(() => document.querySelector("#form-nova [data-campo=autoridades][data-linha='1'][data-col=lotacao]").value !== "CMOPE / SIMS");
  assert.equal(await page.inputValue("#form-nova [data-campo=autoridades][data-linha='1'][data-col=lotacao]"), "CPROJ / SIMS", "a lotação acompanha a unidade escolhida");
  assert.equal(await page.inputValue("#c-identificacao-objeto"), "Baterias para os nobreaks do Ed. Sede", "trocar a unidade não apaga o que já foi digitado");
  await digitar(page, "#c-identificacao-responsavel", "Fulano de Tal");
  assert.ok(!(await page.isDisabled("#btn-criar")));
  await page.click("#btn-criar");
  await page.waitForSelector("#form #f-dfd-justificativa");
  assert.equal(await page.evaluate(() => location.hash), `#/c/${ID1}/dfd`);
  ok(`RN-11: contratação criada com o código ${ID1} e aberta no DFD`);

  /* ---------- DFD vazio: pendências e bloqueio ---------- */
  assert.match(await texto(page, "#situacao"), /8 pendência\(s\) impedem a validação/);
  assert.ok(await page.isDisabled("[data-app=validar]"));
  assert.ok(await page.isDisabled("[data-app=gerar]"));
  assert.match(await texto(page, "#situacao"), /Decreto nº 10\.947\/2022, art\. 8º, III/);
  assert.equal(await page.locator("#steps a.step.lock").count(), 3, "ETP, TR e Mapa bloqueados");
  assert.equal(await page.locator("#form textarea, #form input, #form select").evaluateAll((els) => els.filter((e) => e.closest(".field").querySelector(".ty.FIXO, .ty.HERDADO")).length), 0, "RN-02 e RN-05: campos FIXO e HERDADO não têm controle de edição");
  assert.match(await texto(page, "#f-dfd-titulo"), /BATERIAS PARA OS NOBREAKS DO ED\. SEDE/);
  assert.match(await texto(page, "#f-dfd-titulo"), /Herdado de: Identificação/);
  assert.match(await texto(page, "#f-dfd-unidade"), /Coordenadoria de Projetos \(CPROJ\)/);
  ok("DFD novo: 8 pendências com o dispositivo legal, validação e geração bloqueadas, herdados e fixos sem edição");

  /* ---------- preenchimento ---------- */
  await digitar(page, "#c-dfd-justificativa", "Primeiro parágrafo da justificativa.\nSegundo parágrafo, com acentuação: órgão, ação, à.");
  await digitar(page, "#c-dfd-objeto", "Aquisição de baterias para nobreaks de 40 kVA e 60 kVA.");
  await page.click("[data-acao=inclui][data-campo=itens]");
  await digitar(page, "[data-campo=itens][data-linha='0'][data-col=descricao]", "Bateria 12 V 200 W");
  await digitar(page, "[data-campo=itens][data-linha='0'][data-col=unidade]", "un");
  await digitar(page, "[data-campo=itens][data-linha='0'][data-col=quantidade]", "abc");
  assert.match(await texto(page, "#f-dfd-itens [data-erro]"), /não é um número válido/);
  await digitar(page, "[data-campo=itens][data-linha='0'][data-col=quantidade]", "36");
  await page.click("[data-acao=inclui][data-campo=itens]");
  await digitar(page, "[data-campo=itens][data-linha='1'][data-col=descricao]", "Bateria 12 V 580 W");
  await digitar(page, "[data-campo=itens][data-linha='1'][data-col=unidade]", "un");
  await digitar(page, "[data-campo=itens][data-linha='1'][data-col=quantidade]", "1.256");
  assert.equal(await page.inputValue("[data-campo=itens][data-linha='1'][data-col=quantidade]"), "1.256");
  await digitar(page, "[data-campo=itens][data-linha='1'][data-col=quantidade]", "256");
  /* reordenar e remover linhas */
  await page.click("[data-acao=sobe][data-campo=itens][data-linha='1']");
  assert.equal(await page.inputValue("[data-campo=itens][data-linha='0'][data-col=descricao]"), "Bateria 12 V 580 W");
  await page.click("[data-acao=inclui][data-campo=itens]");
  assert.equal(await page.locator("#f-dfd-itens tbody tr").count(), 3);
  await page.click("[data-acao=remove][data-campo=itens][data-linha='2']");
  assert.equal(await page.locator("#f-dfd-itens tbody tr").count(), 2);
  await digitar(page, "#c-dfd-valor_estimado", "110000");
  assert.equal(await page.inputValue("#c-dfd-valor_estimado"), "110.000,00", "valor reformatado ao sair do campo");
  await digitar(page, "#c-dfd-valor_base", "Consulta simplificada de mercado.");
  await digitar(page, "#c-dfd-data_conclusao", `${ANO + 1}-07-31`);
  await page.selectOption("#c-dfd-prioridade", "Alto");
  assert.ok(await page.locator("#f-dfd-prioridade_justificativa [data-req]").isVisible(), "grau Alto torna a justificativa obrigatória");
  assert.match(await texto(page, "#situacao"), /2 pendência/);
  await digitar(page, "#c-dfd-prioridade_justificativa", "Risco de interrupção dos sistemas críticos.");
  await page.selectOption("#c-dfd-vinculacao", { index: 1 });
  assert.ok(!(await page.locator("#f-dfd-vinculacao_descricao [data-req]").isVisible()));
  await digitar(page, "#c-dfd-equipe", "da coordenadora da CPROJ");
  assert.match(await texto(page, "#situacao"), /Pronto para validar/);
  assert.ok(!(await page.isDisabled("[data-app=validar]")));
  await salvo(page);
  const g1 = await gravado(page, ID1);
  assert.equal(g1.artefatos.dfd.status, "rascunho");
  assert.deepEqual(g1.artefatos.dfd.campos.itens, [
    { descricao: "Bateria 12 V 580 W", unidade: "un", quantidade: 256 },
    { descricao: "Bateria 12 V 200 W", unidade: "un", quantidade: 36 }
  ]);
  assert.equal(g1.artefatos.dfd.campos.valor_estimado, 110000);
  assert.equal(g1.artefatos.dfd.campos.data_conclusao, `${ANO + 1}-07-31`);
  ok("DFD preenchido: tabela (incluir, reordenar, remover), números, data, obrigatoriedade condicional; gravado como rascunho");

  /* ---------- gravação por digitação (sem sair do campo) e retomada ---------- */
  await acrescentar(page, "#c-dfd-valor_base", " Digitado sem sair do campo.");
  assert.match(await texto(page, "#save"), /salvando/);
  await salvo(page);
  await page.close();
  const page2 = await ctx.newPage();
  vigiar(page2, "A2");
  await page2.goto(APP);
  await page2.waitForSelector(`[data-contratacao='${ID1}']`);
  assert.match(await texto(page2, `[data-contratacao='${ID1}']`), /Baterias para os nobreaks do Ed\. Sede/);
  assert.match(await texto(page2, `[data-contratacao='${ID1}']`), /DFD\s+rascunho/);
  await page2.click(`[data-contratacao='${ID1}'] a.btn.primary`);
  await page2.waitForSelector("#c-dfd-valor_base");
  assert.equal(await page2.inputValue("#c-dfd-valor_base"), "Consulta simplificada de mercado. Digitado sem sair do campo.");
  assert.equal(await page2.inputValue("#c-dfd-justificativa"), "Primeiro parágrafo da justificativa.\nSegundo parágrafo, com acentuação: órgão, ação, à.");
  assert.equal(await page2.inputValue("[data-campo=itens][data-linha='0'][data-col=quantidade]"), "256");
  assert.equal(await page2.inputValue("#c-dfd-data_conclusao"), `${ANO + 1}-07-31`);
  assert.match(await texto(page2, "#situacao"), /Pronto para validar/);
  ok("RN-09: fechar a aba e reabrir retoma o DFD com tudo o que foi digitado");

  /* ---------- prévia, validação (checkpoint) e DFD.docx ---------- */
  const p = page2;
  const previa = await baixar(p, () => p.click("[data-app=gerar]"));
  assert.equal(previa.nome, `DFD_${ID1}.docx`);
  await p.waitForFunction(() => /prévia: o documento ainda não foi validado/.test(document.querySelector("#situacao").textContent));
  await salvo(p);
  await p.click("[data-app=validar]");
  await p.waitForFunction(() => /DFD validado/.test(document.querySelector("#situacao").textContent));
  assert.match(await texto(p, "#situacao"), /Validado por Servidora de Teste em \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
  assert.equal(await p.locator("#form textarea:not([disabled]), #form input:not([disabled]), #form select:not([disabled]), #form button:not([disabled])").count(), 0, "documento validado fica somente leitura");
  assert.equal(await p.locator("#steps a.step.lock").count(), 2, "ETP liberado; TR e Mapa bloqueados");
  await salvo(p);
  const g2 = await gravado(p, ID1);
  assert.equal(g2.artefatos.dfd.status, "validado");
  assert.equal(g2.etapaAtual, "etp");
  const evVal = g2.eventos.find((x) => x.acao === "validou");
  assert.equal(evVal.quem, "Servidora de Teste");
  ok("RN-01: validação registrada com quem e quando; DFD travado; ETP liberado");

  const revAntes = await revisao(p);
  const doc = await baixar(p, () => p.click("[data-app=gerar]"));
  await p.waitForFunction(() => /Arquivo gerado\./.test(document.querySelector("#situacao").textContent));
  assert.doesNotMatch(await texto(p, "#situacao"), /ressalva|prévia/);
  const d = await lerDocx(p, doc.caminho);
  assert.deepEqual(d.malformado, [], "XML bem formado");
  for (const esperado of ["[Content_Types].xml", "word/document.xml", "word/styles.xml"]) assert.ok(d.arquivos.includes(esperado), `falta ${esperado}`);
  assert.doesNotMatch(d.todos, /\{[#/^]?[A-Za-z_.][A-Za-z0-9_.]*\}/, "nenhum marcador remanescente");
  assert.doesNotMatch(d.todos, /undefined|\[object|NaN/);
  for (const trecho of [
    "FORMALIZAÇÃO DE DEMANDA",
    "BATERIAS PARA OS NOBREAKS DO ED. SEDE",
    String(ANO),
    "Primeiro parágrafo da justificativa.\n",
    "Segundo parágrafo, com acentuação: órgão, ação, à.\n",
    "Aquisição de baterias para nobreaks de 40 kVA e 60 kVA.",
    "Bateria 12 V 580 W",
    "256",
    "Valor estimado da contratação: R$ 110.000,00.",
    `a data pretendida para a conclusão da contratação é 31 de julho de ${ANO + 1}.`,
    "Grau de prioridade: Alto.",
    "Risco de interrupção dos sistemas críticos.",
    "Não há vinculação ou dependência com o objeto de outro documento de formalização de demanda.",
    "Área requisitante: Coordenadoria de Projetos (CPROJ).",
    "Indico o(a) servidor(a) Fulano de Tal como responsável técnico(a)",
    "com a participação da coordenadora da CPROJ na equipe de planejamento",
    "Atesto ter sido verificada lista de projetos cadastrados",
    "Fica autorizada a formalização de demanda",
    "Secretário(a)",
    "CPROJ / SIMS",
    `contratação ${ID1}`,
    `revisão ${revAntes}`
  ])
    assert.ok(d.todos.includes(trecho), `o DFD.docx deveria conter: ${trecho}`);
  assert.doesNotMatch(d.corpo, /Processo SEI/, "sem número de processo, o trecho condicional some");
  await salvo(p);
  const g3 = await gravado(p, ID1);
  const evDoc = g3.eventos.filter((x) => x.acao === "gerou_documento");
  assert.equal(evDoc.length, 2);
  assert.equal(evDoc[1].arquivo, `DFD_${ID1}.docx`);
  ok("DFD.docx gerado do modelo Word: conteúdo conferido, sem marcador remanescente, geração registrada");

  /* ---------- textos fixos: tela, schema e modelo dizem o mesmo (RN-05) ---------- */
  const fixos = await p.evaluate(async () => {
    const schema = PCA.app.schemas.dfd;
    return PCA.regras.todosCampos(schema).filter((c) => c.classe === "FIXO").flatMap((c) => c.texto);
  });
  assert.ok(fixos.length >= 10);
  for (const t of fixos) assert.ok(d.todos.includes(t), `texto fixo do schema ausente do documento: ${t.slice(0, 50)}`);
  ok(`RN-05: os ${fixos.length} parágrafos fixos do schema estão no documento gerado`);

  /* ---------- telas seguintes e saída ---------- */
  await p.click("#steps a.step[href$='/etp']");
  await p.waitForFunction(() => /Estudo Técnico Preliminar/.test(document.querySelector("#main h2").textContent));
  assert.match(await texto(p, "#main"), /Liberado\./);
  assert.match(await texto(p, "#main"), /Primeiro parágrafo da justificativa\./, "o ETP já mostra o que herdará do DFD");
  await p.click("#steps a.step[href$='/tr']");
  await p.waitForFunction(() => /Termo de Referência/.test(document.querySelector("#main h2").textContent));
  assert.match(await texto(p, "#main"), /Bloqueado\./);
  await p.click("#steps a.step[href$='/saida']");
  await p.waitForSelector("#log");
  assert.match(await texto(p, "#log"), /validou\s+dfd\s+por Servidora de Teste/);
  const exp = await baixar(p, () => p.click("[data-app=exportar]"));
  assert.equal(exp.nome, `estado_${ID1}.json`);
  const estadoExportado = JSON.parse(fs.readFileSync(exp.caminho, "utf8"));
  assert.equal(estadoExportado.id, ID1);
  assert.equal(estadoExportado.schemaVersao, "2.0");
  assert.equal(estadoExportado.artefatos.dfd.status, "validado");
  assert.deepEqual(estadoExportado, await gravado(p, ID1));
  ok("ETP mostra a herança e TR segue bloqueado; estado.json exportado é idêntico ao gravado");

  /* ---------- identificação travada e reabertura (RN-03) ---------- */
  await p.click("#steps a.step[href$='/identificacao']");
  await p.waitForFunction(() => /Identificação travada/.test(document.querySelector("#main").textContent));
  assert.equal(await p.locator("#form input:not([disabled]), #form select:not([disabled])").count(), 0);
  await p.click("#steps a.step[href$='/dfd']");
  await p.waitForSelector("[data-app=reabrir-pedir]");
  await p.click("[data-app=reabrir-pedir]");
  assert.match(await texto(p, "#situacao"), /Reabrir o DFD\?/);
  await p.click("[data-app=reabrir-cancelar]");
  assert.equal((await gravado(p, ID1)).artefatos.dfd.status, "validado");
  await p.click("[data-app=reabrir-pedir]");
  await p.click("[data-app=reabrir-confirmar]");
  await p.waitForSelector("#c-dfd-justificativa:not([disabled])");
  await salvo(p);
  const g4 = await gravado(p, ID1);
  assert.equal(g4.artefatos.dfd.status, "rascunho");
  assert.equal(g4.eventos[g4.eventos.length - 1].acao, "reabriu");
  assert.equal(await p.locator("#steps a.step.lock").count(), 3, "reaberto o DFD, o ETP volta a ficar bloqueado");
  ok("RN-03: identificação travada após a validação; reabertura pede confirmação, fica registrada e bloqueia o ETP");

  /* ---------- clique direto depois de digitar, sem sair do campo ----------
     Sair de um campo clicando em um botão dispara "change" antes do clique. Se o botão ou o link
     for redesenhado nesse instante, o clique se perde (defeito encontrado e corrigido na E1). */
  await acrescentar(p, "#c-dfd-valor_base", " Revisto.");
  await p.click("#steps a.step[href$='/saida']");
  await p.waitForSelector("#log", { timeout: 5000 });
  assert.match((await gravado(p, ID1)).artefatos.dfd.campos.valor_base, / Revisto\.$/, "o que foi digitado é gravado antes de trocar de tela");
  await p.click("#steps a.step[href$='/dfd']");
  await p.waitForSelector("#c-dfd-equipe");
  await acrescentar(p, "#c-dfd-equipe", " e do secretário");
  await p.click("[data-app=validar]");
  await p.waitForFunction(() => /DFD validado/.test(document.querySelector("#situacao").textContent), null, { timeout: 5000 });
  await salvo(p);
  assert.match((await gravado(p, ID1)).artefatos.dfd.campos.equipe, / e do secretário$/);
  await p.click("[data-app=reabrir-pedir]");
  await p.click("[data-app=reabrir-confirmar]");
  await p.waitForSelector("#c-dfd-justificativa:not([disabled])");
  await salvo(p);
  ok("clicar em um link ou em Validar logo depois de digitar funciona no primeiro clique e grava o que foi digitado");

  /* ---------- conflito entre duas abas (RN-09) ---------- */
  const b = await ctx.newPage();
  vigiar(b, "B");
  await b.goto(`${APP}#/c/${ID1}/dfd`);
  await b.waitForSelector("#c-dfd-objeto");
  await acrescentar(p, "#c-dfd-objeto", " [aba A]");
  await b.selectOption("#c-dfd-prioridade", "Médio");
  await salvo(b);
  await p.waitForSelector("#conflito:not([hidden])");
  assert.match(await texto(p, "#conflito"), /Conflito de gravação/);
  await p.waitForFunction(() => /conflito de gravação/.test(document.querySelector("#save").textContent), null, { timeout: 8000 });
  let g = await gravado(p, ID1);
  assert.equal(g.artefatos.dfd.campos.prioridade, "Médio");
  assert.doesNotMatch(g.artefatos.dfd.campos.objeto, /aba A/, "a aba A não sobrescreveu a gravação da aba B");
  await p.click("[data-app=conflito-carregar]");
  await p.waitForSelector("#conflito", { state: "hidden" });
  assert.equal(await p.inputValue("#c-dfd-prioridade"), "Médio");
  assert.doesNotMatch(await p.inputValue("#c-dfd-objeto"), /aba A/);
  /* segunda rodada: a aba A decide sobrescrever */
  await acrescentar(p, "#c-dfd-objeto", " [aba A]");
  await b.selectOption("#c-dfd-prioridade", "Baixo");
  await salvo(b);
  await p.waitForSelector("#conflito:not([hidden])");
  await p.click("[data-app=conflito-sobrescrever]");
  await salvo(p);
  g = await gravado(p, ID1);
  assert.match(g.artefatos.dfd.campos.objeto, /\[aba A\]$/);
  assert.equal(g.artefatos.dfd.campos.prioridade, "Médio", "ao sobrescrever, vale o estado inteiro da aba A");
  await b.waitForFunction(() => /atualizado por outra aba/.test(document.querySelector("#save").textContent));
  assert.match(await b.inputValue("#c-dfd-objeto"), /\[aba A\]$/);
  await b.close();
  ok("RN-09: conflito entre abas avisado, nada sobrescrito sem decisão; recarregar e sobrescrever funcionam");

  /* ---------- importação ---------- */
  await p.click("#steps a.step[href='#/']");
  await p.waitForSelector(`[data-contratacao='${ID1}']`);
  await p.setInputFiles("#arquivo", exp.caminho);
  await p.waitForFunction(() => /Contratação já existe/.test(document.querySelector("#main").textContent));
  await p.click("[data-app=import-copia]");
  await p.waitForSelector(`[data-contratacao='${ANO}-002']`);
  assert.equal((await gravado(p, `${ANO}-002`)).artefatos.dfd.status, "validado");
  assert.equal((await gravado(p, ID1)).artefatos.dfd.status, "rascunho", "a cópia não alterou a original");
  await p.click(`[data-contratacao='${ID1}'] [data-app=excluir-pedir]`);
  await p.click("[data-app=excluir-confirmar]");
  await p.waitForSelector(`[data-contratacao='${ID1}']`, { state: "detached" });
  await p.setInputFiles("#arquivo", exp.caminho);
  await p.waitForSelector(`[data-contratacao='${ID1}']`);
  assert.match(await texto(p, "#main"), /Importada\./);
  assert.match(await texto(p, `[data-contratacao='${ID1}']`), /DFD\s+validado/);
  const ruim = path.join(TMP, "ruim.json");
  fs.writeFileSync(ruim, JSON.stringify(Object.assign({}, estadoExportado, { id: `${ANO}-050`, etapaAtual: '"><img src=x onerror="window.__xss=1">', artefatos: Object.assign({}, estadoExportado.artefatos, { tr: { status: "validado", campos: {} } }) })));
  await p.setInputFiles("#arquivo", ruim);
  await p.waitForFunction(() => /Arquivo recusado/.test(document.querySelector("#main").textContent));
  assert.match(await texto(p, "#main"), /Etapa atual desconhecida/);
  assert.match(await texto(p, "#main"), /Estado incoerente/);
  const lixo = path.join(TMP, "lixo.json");
  fs.writeFileSync(lixo, "isto não é json");
  await p.setInputFiles("#arquivo", lixo);
  await p.waitForFunction(() => /não é um JSON válido/.test(document.querySelector("#main").textContent));
  assert.equal(await p.locator("[data-contratacao]").count(), 2);
  ok("estado.json: importar como cópia, excluir e reimportar; arquivo adulterado ou inválido é recusado com o motivo");

  /* ---------- caso de referência ---------- */
  await p.click("[data-app=caso]");
  await p.waitForSelector("#c-dfd-justificativa");
  assert.match(await texto(p, "#main"), /Caso de referência\./);
  assert.match(await texto(p, "#situacao"), /Pronto para validar/);
  const idCaso = await p.evaluate(() => PCA.app.estado.id);
  assert.equal(idCaso, `${ANO}-003`);
  await p.click("[data-app=validar]");
  await p.waitForFunction(() => /DFD validado/.test(document.querySelector("#situacao").textContent));
  const docCaso = await baixar(p, () => p.click("[data-app=gerar]"));
  const dc = await lerDocx(p, docCaso.caminho);
  assert.deepEqual(dc.malformado, []);
  assert.doesNotMatch(dc.todos, /\{[#/^]?[A-Za-z_.][A-Za-z0-9_.]*\}/);
  assert.ok(dc.todos.includes("BATERIAS E VENTILADORES PARA OS NOBREAKS DE AUTOMAÇÃO E DO DATACENTER DO ED. SEDE"));
  assert.ok(dc.todos.includes("a data pretendida para a conclusão da contratação é 31 de julho de 2025."));
  assert.ok(dc.todos.includes("[nome omitido]"));
  fs.copyFileSync(docCaso.caminho, path.join(TMP, "DFD_caso_baterias.docx"));
  /* destravar a identificação desatualiza o DFD validado */
  await p.click("#steps a.step[href$='/identificacao']");
  await p.click("[data-app=destravar-ident]");
  await p.waitForSelector("#c-identificacao-objeto:not([disabled])");
  await digitar(p, "#c-identificacao-processo_sei", "0000000-00.2026.5.17.0500");
  await salvo(p);
  const gc = await gravado(p, idCaso);
  assert.equal(gc.artefatos.dfd.status, "desatualizado");
  assert.equal(gc.processoSei, "0000000-00.2026.5.17.0500");
  await p.click("#steps a.step[href$='/dfd']");
  await p.waitForFunction(() => /DFD desatualizado/.test(document.querySelector("#situacao").textContent));
  await p.click("[data-app=validar]");
  await p.waitForFunction(() => /DFD validado/.test(document.querySelector("#situacao").textContent));
  const docSei = await baixar(p, () => p.click("[data-app=gerar]"));
  assert.ok((await lerDocx(p, docSei.caminho)).corpo.includes("Processo SEI nº 0000000-00.2026.5.17.0500"));
  ok("caso das baterias: carrega pronto, valida e gera; alterar a identificação desatualiza o DFD até nova validação");

  /* ---------- entrada hostil ---------- */
  await p.click("#steps a.step[href='#/']");
  await p.click("[data-app=novo]");
  await p.waitForSelector("#form-nova .field");
  const hostil = '<img src=x onerror="window.__xss=1"> & "aspas" </w:t>{#itens}';
  await digitar(p, "#c-identificacao-objeto", hostil);
  await p.selectOption("#c-identificacao-unidade", "SIMS");
  await p.waitForFunction(() => document.querySelector("#form-nova [data-campo=autoridades][data-linha='1'][data-col=lotacao]").value === "SIMS / TRT 17ª Região");
  await digitar(p, "#c-identificacao-responsavel", "<script>window.__xss=1</script>");
  await p.click("#btn-criar");
  await p.waitForSelector("#c-dfd-justificativa");
  await digitar(p, "#c-dfd-justificativa", hostil);
  await digitar(p, "#c-dfd-objeto", hostil);
  await p.click("[data-acao=inclui][data-campo=itens]");
  await digitar(p, "[data-campo=itens][data-linha='0'][data-col=descricao]", hostil);
  await digitar(p, "[data-campo=itens][data-linha='0'][data-col=unidade]", "un");
  await digitar(p, "[data-campo=itens][data-linha='0'][data-col=quantidade]", "1");
  await digitar(p, "#c-dfd-valor_estimado", "1,5");
  await digitar(p, "#c-dfd-valor_base", hostil);
  await digitar(p, "#c-dfd-data_conclusao", `${ANO + 1}-01-01`);
  await p.selectOption("#c-dfd-prioridade", "Baixo");
  await p.selectOption("#c-dfd-vinculacao", { index: 2 });
  assert.match(await texto(p, "#situacao"), /1 pendência/);
  await digitar(p, "#c-dfd-vinculacao_descricao", hostil);
  await p.click("[data-app=validar]");
  await p.waitForFunction(() => /DFD validado/.test(document.querySelector("#situacao").textContent));
  const docHostil = await baixar(p, () => p.click("[data-app=gerar]"));
  const dh = await lerDocx(p, docHostil.caminho);
  assert.deepEqual(dh.malformado, [], "o .docx continua bem formado com entrada hostil");
  assert.ok(dh.corpo.includes(hostil), "o texto digitado sai literal no documento");
  for (const rota of ["etp", "saida", "identificacao"]) {
    await p.click(`#steps a.step[href$='/${rota}']`);
    await p.waitForTimeout(100);
  }
  await p.click("#steps a.step[href='#/']");
  await p.waitForSelector("[data-contratacao]");
  assert.equal(await p.evaluate(() => window.__xss), undefined, "nenhum script injetado executou");
  assert.equal(await p.locator("img[src='x']").count(), 0);
  assert.equal(await p.locator("main script").count(), 0);
  ok("entrada hostil: tratada como texto na tela e no .docx (sem execução de script, XML íntegro)");

  /* ---------- página de sondagem (rede simulada) ---------- */
  const s = await ctx.newPage();
  vigiar(s, "sonda", true);
  const CHAVE_GROQ = "gsk_CHAVEDETESTE1234567890", CHAVE_GEM = "AIzaCHAVEDETESTE1234567890";
  const jsonResp = (route, status, corpo) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(corpo) });
  await s.route("https://pncp.gov.br/**", (route) => {
    const u = route.request().url();
    if (u.includes("/api/consulta/v1/contratacoes/publicacao")) return jsonResp(route, 200, { data: [{ orgaoEntidade: { cnpj: "00000000000191" }, anoCompra: 2026, sequencialCompra: 7, numeroControlePNCP: "00000000000191-1-000007/2026" }], totalRegistros: 123 });
    if (u.includes("/itens")) return jsonResp(route, 200, [{ descricao: "Bateria estacionária 12 V", valorUnitarioEstimado: 232 }]);
    if (u.includes("/api/search/")) return route.abort("failed");
    return route.abort("failed");
  });
  await s.route("https://api.groq.com/**", (route) => {
    const r = route.request();
    if (r.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (r.headers()["authorization"] !== "Bearer " + CHAVE_GROQ) return jsonResp(route, 401, { error: { message: "Invalid API Key" } });
    if (r.url().endsWith("/models")) return jsonResp(route, 200, { data: [{ id: "llama-3.3-70b-versatile" }, { id: "groq/compound" }, { id: "whisper-large-v3" }] });
    const corpo = JSON.parse(r.postData());
    if (corpo.model === "groq/compound") return jsonResp(route, 200, { choices: [{ message: { content: "12 V, 200 W por célula.", executed_tools: [{ type: "search", search_results: { results: [{ url: "https://www.csb-battery.com/hrl12200w.pdf" }, { url: "https://loja-qualquer.example/bateria" }] } }] } }] });
    return jsonResp(route, 200, { choices: [{ message: { content: `As baterias têm cinco anos. (eco indevido da chave: ${CHAVE_GROQ})` } }], usage: { prompt_tokens: 30, completion_tokens: 20 } });
  });
  await s.route("https://generativelanguage.googleapis.com/**", (route) => {
    const r = route.request();
    if (r.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (r.headers()["x-goog-api-key"] !== CHAVE_GEM) return jsonResp(route, 403, { error: { message: "Method doesn't allow unregistered callers" } });
    if (r.url().includes("/models?")) return jsonResp(route, 200, { models: [{ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }] });
    const corpo = JSON.parse(r.postData());
    if (corpo.tools) return jsonResp(route, 200, { candidates: [{ content: { parts: [{ text: "Tensão nominal de 12 V." }] }, groundingMetadata: { webSearchQueries: ["CSB HRL 12200W"], groundingChunks: [{ web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", title: "csb-battery.com" } }] } }] });
    return jsonResp(route, 200, { candidates: [{ content: { parts: [{ text: "As baterias dos nobreaks têm cinco anos." }] } }] });
  });
  await s.goto(APP + "sonda.html");
  await s.click("#rodar-a");
  await s.waitForFunction(() => !document.querySelector("#rodar-a").disabled && document.querySelectorAll("#tb-a tr").length >= 8, null, { timeout: 60000 });
  const relA = await s.inputValue("#relatorio");
  for (const linha of [/\[OK\] GitHub Pages/, /\[OK\] Gravação no navegador/, /\[OK\] Geração de \.docx no navegador: arquivo de \d+ bytes gerado$/m, /\[OK\] PNCP · API de consulta .*123 pregões/, /\[OK\] PNCP · itens e preços .*R\$ 232,00/, /\[FALHOU\] PNCP · busca textual/, /\[OK\] Groq · alcance .*HTTP 401/, /\[OK\] Gemini · alcance .*HTTP 403/]) assert.match(relA, linha);
  const docSonda = await baixar(s, () => s.click("#baixar-docx"));
  assert.deepEqual((await lerDocx(s, docSonda.caminho)).malformado, []);
  await s.fill("#k-groq", CHAVE_GROQ);
  await s.fill("#k-gemini", CHAVE_GEM);
  await s.click("#rodar-b");
  await s.waitForFunction(() => !document.querySelector("#rodar-b").disabled && document.querySelectorAll("#tb-b tr").length >= 6, null, { timeout: 60000 });
  const relB = await s.inputValue("#relatorio");
  for (const linha of [/\[OK\] Groq · modelos disponíveis/, /\[OK\] Groq · redação .*llama-3\.3-70b-versatile/, /\[ATENÇÃO\] Groq · busca na web .*2 URLs devolvidas, 1 fora de csb-battery\.com/, /\[OK\] Gemini · modelos disponíveis/, /\[OK\] Gemini · redação/, /\[OK\] Gemini · busca no Google .*1 fontes/]) assert.match(relB, linha);
  const visivel = (await s.locator("body").innerText()) + relB;
  assert.ok(!visivel.includes(CHAVE_GROQ) && !visivel.includes(CHAVE_GEM), "as chaves não aparecem na tela nem no relatório");
  assert.match(relB, /eco indevido da chave: \[chave\]/);
  assert.equal(await s.evaluate(() => Object.keys(localStorage).filter((k) => /chave|key|groq|gemini/i.test(k)).length), 0, "nenhuma chave gravada no navegador");
  await s.close();
  ok("sondagem: testes sem chave e com chave leem as respostas simuladas; chaves não aparecem nem ficam gravadas");

  await browser.close();
  if (problemas.length) {
    console.error("\nPROBLEMAS registrados pelo navegador:\n" + problemas.join("\n"));
    process.exit(1);
  }
  console.log(`\n${passo} blocos aprovados, nenhum erro de console ou de rede. Arquivos gerados em ${TMP}`);
})().catch((e) => {
  console.error("\nFALHOU depois do bloco " + passo + ":\n" + (e && e.stack ? e.stack : e));
  if (problemas.length) console.error("\nProblemas do navegador:\n" + problemas.join("\n"));
  process.exit(1);
});
