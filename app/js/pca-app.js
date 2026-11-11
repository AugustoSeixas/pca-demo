/* PCA — aplicação: navegação, telas, gravação automática (RN-09) e checkpoints (RN-01 a RN-03). */
(function () {
  "use strict";
  const P = window.PCA;
  const U = P.util, R = P.regras, S = P.store, M = P.motor, X = P.docx;

  const VERSAO = "E1";
  const ARTEFATOS = ["identificacao", "dfd", "etp", "tr", "mapa"];
  const TELAS = ["identificacao", "dfd", "etp", "tr", "mapa", "saida"];
  const TITULO_TELA = { identificacao: "Identificação", dfd: "DFD", etp: "ETP", tr: "Termo de Referência", mapa: "Mapa de Riscos", saida: "Saída" };
  const ENTREGA = { etp: "E2, prevista para 16 e 17/11", tr: "E3, prevista para 18 e 19/11", mapa: "E3, prevista para 18 e 19/11" };
  const STATUS_TXT = { nao_iniciado: "não iniciado", rascunho: "rascunho", validado: "validado", desatualizado: "desatualizado" };

  const app = {
    schemas: {},
    cadastros: null,
    caso: null,
    estado: null,
    revisaoLida: 0,
    sujo: false,
    timer: null,
    tela: "inicio",
    inicio: { novo: null, excluir: null, importar: null, msg: null },
    pedirReabrir: false,
    msgDoc: null
  };
  const $ = (s, r) => (r || document).querySelector(s);
  const main = () => $("#main");
  const quem = () => S.usuario() || "não identificado";
  const base = () => `#/c/${encodeURIComponent(app.estado.id)}/`;
  const chip = (st) => `<span class="chip ${st}">${STATUS_TXT[st] || st}</span>`;
  const tipos = (c) => `<span class="ty ${c}">${c === "USUARIO" ? "USUÁRIO" : c}</span>`;
  const callout = (tipo, titulo, corpo) => `<div class="callout ${tipo}"><b class="t">${titulo}</b><div>${corpo}</div></div>`;
  /* Troca o conteúdo só quando ele muda. Sair de um campo clicando num botão dispara "change" antes do clique;
     se o botão fosse redesenhado nesse instante, o clique se perderia. */
  const ultimoHTML = new WeakMap();
  function definirHTML(el, html) {
    if (!el || ultimoHTML.get(el) === html) return;
    el.innerHTML = html;
    ultimoHTML.set(el, html);
  }

  /* ---------- indicador e gravação automática ---------- */
  function indicar(tipo, texto) {
    const el = $("#save");
    el.className = "save " + (tipo || "");
    el.textContent = texto || "";
    el.hidden = !texto;
    el.dataset.app = tipo === "err" ? "salvar-de-novo" : "";
  }
  function marcarSujo(imediato) {
    app.sujo = true;
    indicar("busy", "salvando…");
    clearTimeout(app.timer);
    if (imediato) salvarAgora();
    else app.timer = setTimeout(salvarAgora, 2500);
  }
  function salvarAgora(forcar) {
    clearTimeout(app.timer);
    if (!app.estado || !app.sujo) return true;
    try {
      const r = S.salvar(app.estado, app.revisaoLida, forcar);
      app.estado.revisao = r.revisao;
      app.estado.atualizadoEm = r.atualizadoEm;
      app.estado.objeto = app.estado.identificacao.campos.objeto || app.estado.objeto || "";
      app.estado.processoSei = app.estado.identificacao.campos.processo_sei || "";
      app.revisaoLida = r.revisao;
      app.sujo = false;
      indicar("ok", `salvo às ${U.horaBR(r.atualizadoEm)} · rev. ${r.revisao}`);
      mostrarConflito(null);
      return true;
    } catch (e) {
      if (e.codigo === "CONFLITO") {
        indicar("err", "conflito de gravação");
        mostrarConflito(e.revisaoGravada);
      } else indicar("err", "erro — tentar novamente");
      return false;
    }
  }
  function mostrarConflito(revGravada) {
    const el = $("#conflito");
    if (revGravada == null) {
      el.hidden = true;
      definirHTML(el, "");
      return;
    }
    el.hidden = false;
    definirHTML(
      el,
      callout(
      "bad",
      "Conflito de gravação.",
      `Esta contratação foi gravada em outra aba ou janela (revisão ${revGravada}) depois que você a abriu (revisão ${app.revisaoLida}). Nada foi sobrescrito.` +
          `<div class="row" style="margin-top:8px"><button class="btn small" data-app="conflito-carregar">Carregar a versão gravada</button>` +
          `<button class="btn small danger" data-app="conflito-sobrescrever">Manter a minha versão e sobrescrever</button></div>`
      )
    );
  }

  /* ---------- navegação ---------- */
  function rotaAtual() {
    const p = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (p[0] === "c" && p[1]) return { id: decodeURIComponent(p[1]), tela: TELAS.includes(p[2]) ? p[2] : "dfd" };
    return { tela: "inicio" };
  }
  function ir(hash) {
    if (location.hash === hash) rotear();
    else location.hash = hash;
  }
  function rotear() {
    salvarAgora();
    const r = rotaAtual();
    app.pedirReabrir = false;
    app.msgDoc = null;
    if (r.tela === "inicio") {
      app.estado = null;
      app.tela = "inicio";
      mostrarConflito(null);
      indicar("", "");
      desenharInicio();
      return;
    }
    if (!app.estado || app.estado.id !== r.id) {
      try {
        app.estado = S.carregar(r.id);
        app.revisaoLida = app.estado.revisao;
        app.sujo = false;
        indicar("ok", `salvo às ${U.horaBR(app.estado.atualizadoEm)} · rev. ${app.estado.revisao}`);
      } catch (e) {
        app.inicio.msg = { tipo: "bad", titulo: "Contratação não encontrada.", texto: U.esc(e.message) };
        ir("#/");
        return;
      }
    }
    app.tela = r.tela;
    desenhar();
    window.scrollTo(0, 0);
  }

  /* ---------- tela inicial ---------- */
  /* Lotação padrão da autoridade da linha i para a unidade escolhida (vazia enquanto não há unidade). */
  function modeloLotacao(i) {
    return ((app.cadastros.autoridades_padrao || [])[i] || {}).lotacao || "";
  }
  function lotacaoPadrao(i, unidade) {
    const m = modeloLotacao(i);
    if (!m.includes("{unidade}")) return m;
    if (!unidade) return "";
    const org = app.cadastros.orgao || {};
    return unidade === org.secretaria_sigla ? `${unidade} / ${org.sigla}` : m.replace("{unidade}", unidade);
  }
  function padroesNova() {
    const p = S.padroes() || {};
    const base = p.autoridades && p.autoridades.length ? p.autoridades : app.cadastros.autoridades_padrao || [];
    /* Nome e cargo vêm da última contratação criada neste navegador; a lotação que depende da unidade é recalculada. */
    const aut = base.map((a, i) => ({ nome: a.nome || "", cargo: a.cargo || "", lotacao: modeloLotacao(i).includes("{unidade}") ? "" : a.lotacao || "" }));
    return { objeto: "", processo_sei: "", unidade: "", responsavel: "", autoridades: aut };
  }
  /* Ao trocar a unidade, atualiza a lotação que ainda está no valor padrão; o que foi digitado à mão é preservado. */
  function aplicarUnidadeNasAutoridades(campos, anterior) {
    (campos.autoridades || []).forEach((a, i) => {
      if (!modeloLotacao(i).includes("{unidade}")) return;
      if (!a.lotacao || a.lotacao === lotacaoPadrao(i, anterior)) a.lotacao = lotacaoPadrao(i, campos.unidade);
    });
  }
  function desenharInicio() {
    $("#shell").className = "shell solo";
    $("#steps").hidden = true;
    const lista = S.indice();
    const ini = app.inicio;
    const itens = lista.length
      ? lista
          .map((c) => {
            const st = R.ORDEM.map((a) => `${R.NOMES[a]} ${chip(R.STATUS.includes((c.status || {})[a]) ? c.status[a] : "nao_iniciado")}`).join(" ");
            const conf =
              ini.excluir === c.id
                ? `<div class="confirm"><span>Excluir a contratação ${U.esc(c.id)} deste navegador? Exporte o estado.json antes, se quiser guardar uma cópia.</span><button class="btn small danger" data-app="excluir-confirmar" data-id="${U.esc(c.id)}">Excluir</button><button class="btn small" data-app="excluir-cancelar">Cancelar</button></div>`
                : "";
            return `<div class="item" data-contratacao="${U.esc(c.id)}"><div><div class="t"><span class="mono">${U.esc(c.id)}</span> · ${U.esc(c.objeto || "(sem objeto)")}</div><div class="s">${st}<span>· rev. ${U.esc(c.revisao)} · ${U.esc(U.dataHoraBR(c.atualizadoEm))}</span></div></div>
              <div class="row"><a class="btn primary small" href="#/c/${encodeURIComponent(c.id)}/${R.ORDEM.includes(c.etapaAtual) ? c.etapaAtual : "dfd"}">Retomar</a><button class="btn small" data-app="exportar" data-id="${U.esc(c.id)}">Exportar estado.json</button><button class="btn small danger" data-app="excluir-pedir" data-id="${U.esc(c.id)}">Excluir</button></div>${conf}</div>`;
          })
          .join("")
      : `<p class="note">Nenhuma contratação neste navegador. Crie uma nova, importe um estado.json ou carregue o caso de referência.</p>`;

    let imp = "";
    if (ini.importar) {
      const e = ini.importar.estado;
      imp = callout(
        "warn",
        "Contratação já existe.",
        `Já há uma contratação ${U.esc(e.id)} neste navegador (revisão ${S.revisaoGravada(e.id)}). O arquivo traz a revisão ${e.revisao}.` +
          `<div class="row" style="margin-top:8px"><button class="btn small danger" data-app="import-substituir">Substituir pela do arquivo</button><button class="btn small" data-app="import-copia">Importar como cópia (${U.esc(ini.importar.novoId)})</button><button class="btn small" data-app="import-cancelar">Cancelar</button></div>`
      );
    }
    const msg = ini.msg ? callout(ini.msg.tipo, ini.msg.titulo, ini.msg.texto) : "";
    const semArmazenamento = S.disponivel() ? "" : callout("bad", "Armazenamento bloqueado.", "Este navegador não permite gravar dados locais (modo privado ou política da rede). O trabalho não será retomado depois de fechar a aba; use Exportar estado.json.");

    main().innerHTML = `
    <div class="sheet">
      <div class="eyebrow">Entrega ${VERSAO} · Camada 1 (núcleo, sem IA)</div>
      <h2>Contratações</h2>
      <p class="lede">Cada contratação percorre DFD, ETP, Termo de Referência e Mapa de Riscos, nesta ordem. O trabalho é gravado neste navegador a cada alteração e pode ser levado a outro computador pelo arquivo estado.json.</p>
      ${semArmazenamento}
      <div class="sec">
        <div class="field"><div class="fhead"><label class="lbl" for="usuario">Quem está usando</label></div>
          <input type="text" id="usuario" class="curto" style="max-width:420px" value="${U.esc(S.usuario())}" placeholder="Nome ou e-mail" autocomplete="off">
          <div class="fhelp">Identifica quem criou, validou ou reabriu cada documento no registro de eventos. Fica gravado só neste navegador.</div></div>
      </div>
      <div class="sec"><h3>Neste navegador</h3>${msg}${imp}<div class="list" id="lista">${itens}</div>
        <div class="row"><button class="btn primary" data-app="novo">Nova contratação</button><button class="btn" data-app="importar">Importar estado.json</button><button class="btn" data-app="caso">Carregar caso de referência (baterias)</button>
        <input type="file" id="arquivo" accept=".json,application/json" hidden></div>
      </div>
      <div id="nova"></div>
    </div>
    <div class="sheet">
      <div class="sec" style="margin-top:0"><h3>De onde vem cada campo</h3>
        <div class="legend">
          <div>${tipos("FIXO")}<span>Texto institucional do modelo Word. Não é editado na tela.</span></div>
          <div>${tipos("HERDADO")}<span>Vem de um documento anterior ou da identificação. Para mudar, altera-se a origem.</span></div>
          <div>${tipos("USUARIO")}<span>Informação ou decisão do servidor responsável.</span></div>
          <div>${tipos("BUSCA")}<span>Resultado de pesquisa externa, com fonte, URL e data. Entra na E2.</span></div>
          <div>${tipos("REDIGIDO")}<span>Texto de síntese sugerido por IA a partir de dados já informados. Entra na Camada 2.</span></div>
        </div>
      </div>
      <div class="sec"><h3>Apoio</h3>
        <div class="row"><a class="btn" href="sonda.html">Sondagem técnica (rede, PNCP, Groq e Gemini)</a><a class="btn" href="../demo/demonstracao-pca.html">Demonstração aprovada em 23/10</a></div>
        <p class="note">Protótipo em construção. Use apenas o caso anonimizado ou dados públicos. Não é sistema oficial do Tribunal.</p>
      </div>
    </div>`;
    if (ini.novo) desenharNova();
    ini.msg = null;
  }
  function desenharNova() {
    const rasc = app.inicio.novo;
    const schema = app.schemas.identificacao;
    const el = $("#nova");
    el.innerHTML = `<div class="sec"><h3>Nova contratação <span class="mono">${U.esc(rasc.id)}</span></h3><div id="form-nova"></div><div id="sit-nova"></div>
      <div class="row"><button class="btn primary" data-app="criar" id="btn-criar">Criar contratação e abrir o DFD</button><button class="btn" data-app="cancelar-novo">Cancelar</button></div></div>`;
    const form = $("#form-nova");
    form.innerHTML = M.html(schema, rasc, app.cadastros, {});
    let unidadeAnterior = rasc.identificacao.campos.unidade;
    const situacao = () => {
      const pend = R.pendencias(schema, rasc, app.cadastros);
      $("#btn-criar").disabled = pend.length > 0;
      $("#sit-nova").innerHTML = pend.length ? `<p class="note">Faltam ${pend.length} campo(s) obrigatório(s), marcados em vermelho.</p>` : "";
    };
    M.ligar(form, schema, rasc, app.cadastros, {
      aoAlterar: (id) => {
        if (id === "unidade") {
          aplicarUnidadeNasAutoridades(rasc.identificacao.campos, unidadeAnterior);
          unidadeAnterior = rasc.identificacao.campos.unidade;
          desenharNova();
          return;
        }
        situacao();
      }
    });
    situacao();
  }

  /* ---------- telas da contratação ---------- */
  function dotDe(tela) {
    const e = app.estado;
    if (tela === "identificacao") return R.pendencias(app.schemas.identificacao, e, app.cadastros).length ? "bad" : "ok";
    if (tela === "saida") return "";
    const st = e.artefatos[tela].status;
    return st === "validado" ? "ok" : st === "desatualizado" ? "bad" : st === "rascunho" ? "warn" : "";
  }
  function desenharNav() {
    const e = app.estado;
    const nums = { identificacao: "i", dfd: "1", etp: "2", tr: "3", mapa: "4", saida: "↓" };
    const nav = $("#steps");
    if (!nav.querySelector("#nav-links")) {
      nav.innerHTML = `<a class="step" href="#/"><span class="n">←</span><span>Contratações</span><span></span></a><div class="nav-id" id="nav-id"></div><div class="nav-links" id="nav-links"></div>`;
    }
    /* A revisão muda a cada gravação: fica em um elemento à parte, para que os links não sejam redesenhados. */
    definirHTML($("#nav-id"), `${U.esc(e.id)} · rev. ${U.esc(e.revisao)}<br>${U.esc(e.identificacao.campos.objeto || "")}`);
    definirHTML(
      $("#nav-links"),
      TELAS.map((t) => {
        const lock = R.ORDEM.includes(t) && !R.liberado(e, t);
        return `<a class="step ${lock ? "lock" : ""}" href="${base()}${t}" ${app.tela === t ? 'aria-current="step"' : ""} title="${lock ? "Liberado após validar o documento anterior" : ""}"><span class="n">${nums[t]}</span><span>${TITULO_TELA[t]}</span><span class="dot ${dotDe(t)}"></span></a>`;
      }).join("")
    );
  }
  function pager() {
    const i = TELAS.indexOf(app.tela);
    const ant = TELAS[i - 1], prox = TELAS[i + 1];
    return `<div class="pager">${ant ? `<a class="btn" href="${base()}${ant}">← ${TITULO_TELA[ant]}</a>` : `<a class="btn" href="#/">← Contratações</a>`}${prox ? `<a class="btn primary" href="${base()}${prox}">${TITULO_TELA[prox]} →</a>` : ""}</div>`;
  }
  function ultimoEvento(acao, artefato) {
    const ev = app.estado.eventos.filter((x) => x.acao === acao && x.artefato === artefato);
    return ev[ev.length - 1] || null;
  }
  function desenhar() {
    $("#shell").className = "shell";
    $("#steps").hidden = false;
    desenharNav();
    if (app.tela === "saida") return desenharSaida();
    if (app.tela === "identificacao" || app.tela === "dfd") return desenharFormulario(app.tela);
    return desenharFuturo(app.tela);
  }

  function identTravada() {
    return R.ORDEM.some((a) => app.estado.artefatos[a].status === "validado");
  }

  function desenharFormulario(art) {
    const e = app.estado;
    const schema = app.schemas[art];
    const ehIdent = art === "identificacao";
    const editavel = ehIdent ? !identTravada() : R.editavel(e, art);
    const pos = R.ORDEM.indexOf(art) + 1;
    const cab = ehIdent
      ? `<div class="eyebrow">Contratação ${U.esc(e.id)}</div><h2>Identificação da contratação</h2><p class="lede">Dados que identificam a contratação e alimentam os campos herdados dos quatro documentos.</p>`
      : `<div class="eyebrow">Documento ${pos} de 4 · ${U.esc(schema.fundamento)} · ${chip(e.artefatos[art].status)}</div><h2>${U.esc(schema.titulo)}</h2><p class="lede">${U.esc(schema.resumo || "")}</p>`;
    let avisos = "";
    if (!ehIdent && e.casoReferencia) {
      avisos += callout("info", "Caso de referência.", `${U.esc(e.casoReferencia.descricao)}<ul>${(Array.isArray(e.casoReferencia.procedencia) ? e.casoReferencia.procedencia : []).map((p) => `<li>${U.esc(p)}</li>`).join("")}</ul>`);
    }
    if (ehIdent && !editavel) {
      avisos += callout(
        "warn",
        "Identificação travada.",
        `Há documento validado que herda estes dados. Alterar a identificação marca os documentos validados como desatualizados, até nova validação.<div class="row" style="margin-top:8px"><button class="btn small" data-app="destravar-ident">Alterar a identificação</button></div>`
      );
    }
    main().innerHTML = `<div class="sheet">${cab}<div class="sec" style="margin-top:16px">${avisos}</div><div id="form"></div><div class="sec" id="situacao"></div>${pager()}</div>`;
    const form = $("#form");
    form.innerHTML = M.html(schema, e, app.cadastros, { somenteLeitura: !editavel, rota: (origem) => base() + origem });
    M.ligar(form, schema, e, app.cadastros, {
      somenteLeitura: !editavel,
      aoAlterar: (id, imediato) => {
        if (R.ORDEM.includes(art)) e.etapaAtual = art;
        marcarSujo(imediato);
        desenharSituacao(art);
        desenharNav();
      }
    });
    desenharSituacao(art);
  }

  function listaPendencias(art, pend) {
    return `<ul>${pend.map((p) => `<li><a href="#" data-app="foco" data-alvo="f-${art}-${p.id}">${p.ref ? U.esc(p.ref) + " · " : ""}${U.esc(p.rotulo)}</a>: ${U.esc(p.msgs.join(" "))}${p.fundamento ? ` <span class="mono">(${U.esc(p.fundamento)})</span>` : ""}</li>`).join("")}</ul>`;
  }

  function desenharSituacao(art) {
    const e = app.estado;
    const schema = app.schemas[art];
    const pend = R.pendencias(schema, e, app.cadastros);
    const el = $("#situacao");
    if (!el) return;
    if (art === "identificacao") {
      definirHTML(
        el,
        pend.length ? callout("bad", `${pend.length} pendência(s).`, listaPendencias(art, pend)) : callout("ok", "Identificação completa.", `Os dados seguem para os documentos como campos herdados.`)
      );
      return;
    }
    const a = e.artefatos[art];
    const nome = schema.sigla;
    let html = "";
    if (a.status === "validado") {
      const ev = ultimoEvento("validou", art);
      const prox = R.ORDEM[R.ORDEM.indexOf(art) + 1];
      html += callout("ok", `${nome} validado.`, `Validado por ${U.esc(ev ? ev.quem : "—")} em ${U.esc(ev ? U.dataHoraBR(ev.quando) : "—")}. ${prox ? `O ${R.NOMES[prox]} está liberado.` : ""} Para alterar qualquer campo, reabra o documento.`);
      if (app.pedirReabrir) {
        const dep = R.ORDEM.slice(R.ORDEM.indexOf(art) + 1).filter((d) => ["validado", "rascunho"].includes(e.artefatos[d].status));
        html += `<div class="confirm"><span>Reabrir o ${nome}? ${dep.length ? `Ficarão desatualizados: ${dep.map((d) => R.NOMES[d]).join(", ")}.` : "Nenhum documento seguinte será afetado."} A reabertura fica no registro de eventos.</span><button class="btn small danger" data-app="reabrir-confirmar">Reabrir</button><button class="btn small" data-app="reabrir-cancelar">Cancelar</button></div>`;
      }
      html += `<div class="row"><button class="btn primary" data-app="gerar" ${pend.length ? "disabled" : ""}>Gerar ${nome}.docx</button><button class="btn" data-app="reabrir-pedir">Reabrir ${nome}</button></div>`;
    } else {
      if (a.status === "desatualizado") html += callout("bad", `${nome} desatualizado.`, "Um dado de origem mudou depois da validação. Confira os campos e valide de novo.");
      html += pend.length
        ? callout("bad", `${pend.length} pendência(s) impedem a validação.`, listaPendencias(art, pend))
        : callout("warn", "Pronto para validar.", `Todos os campos obrigatórios estão preenchidos. A validação é o ponto de controle humano: registra quem validou e quando, e libera o documento seguinte.`);
      const semUsuario = !S.usuario();
      if (semUsuario && !pend.length) html += callout("warn", "Quem está validando?", `Informe seu nome na <a href="#/">tela inicial</a> para que a validação fique identificada no registro de eventos.`);
      html += `<div class="row"><button class="btn primary" data-app="validar" ${pend.length ? "disabled" : ""}>Validar ${nome}</button><button class="btn" data-app="gerar" ${pend.length ? "disabled" : ""}>Gerar prévia do ${nome}.docx</button></div>`;
    }
    if (app.msgDoc) html += callout(app.msgDoc.tipo, app.msgDoc.titulo, app.msgDoc.texto);
    definirHTML(el, html);
  }

  /* ETP, TR e Mapa: nesta entrega, a tela mostra a situação (RN-01), o que será herdado e os campos previstos. */
  function desenharFuturo(art) {
    const e = app.estado;
    const schema = app.schemas[art];
    const pos = R.ORDEM.indexOf(art) + 1;
    const anterior = R.ORDEM[pos - 2];
    const liberado = R.liberado(e, art);
    const ctx = R.contexto(e, app.cadastros);
    const campos = R.todosCampos(schema);
    const herdados = campos.filter((c) => c.classe === "HERDADO");
    const linhaHerd = herdados
      .map((c) => {
        const origem = R.origemDe(c);
        const pronto = origem === "identificacao" || origem === "dfd";
        return `<tr><td class="mono">${U.esc(c.ref || "")}</td><td>${U.esc(c.rotulo)}</td><td>${U.esc(R.NOMES[origem] || origem)}</td><td>${pronto ? M.exibir(c, U.obter(ctx, c.origem)) : `<span class="note">Disponível quando o ${U.esc(R.NOMES[origem] || origem)} for construído.</span>`}</td></tr>`;
      })
      .join("");
    const obrig = (c) => {
      const o = c.obrigatorio;
      if (c.classe === "FIXO") return "—";
      if (o && typeof o === "object" && "completo" in o) return o.completo && o.simplificado ? "sim" : o.completo ? "só no completo" : "não";
      if (o && typeof o === "object") return "condicional";
      return o ? "sim" : "não";
    };
    const linhaCampos = campos.map((c) => `<tr><td class="mono">${U.esc(c.ref || "")}</td><td>${U.esc(c.rotulo)}</td><td>${tipos(c.classe)}</td><td>${obrig(c)}</td></tr>`).join("");
    main().innerHTML = `<div class="sheet">
      <div class="eyebrow">Documento ${pos} de 4 · ${U.esc(schema.fundamento)} · ${chip(e.artefatos[art].status)}</div>
      <h2>${U.esc(schema.titulo)}</h2>
      <div class="sec" style="margin-top:16px">
        ${liberado ? callout("ok", "Liberado.", `O ${R.NOMES[anterior]} está validado.`) : callout("warn", "Bloqueado.", `Este documento só é liberado depois da validação do ${R.NOMES[anterior]} (ponto de controle humano).`)}
        ${callout("info", "Em construção.", `O formulário e o modelo Word deste documento entram na entrega ${ENTREGA[art]}. Abaixo, o que já está definido no schema (${U.esc(schema.versao)}).`)}
      </div>
      <div class="sec"><h3>Campos que este documento herda</h3>
        <div class="tbl-wrap"><table><thead><tr><th>Dispositivo</th><th>Campo</th><th>Origem</th><th>Valor atual</th></tr></thead><tbody>${linhaHerd || '<tr><td colspan="4" class="note">Nenhum campo herdado.</td></tr>'}</tbody></table></div>
      </div>
      <div class="sec"><h3>Campos previstos</h3>
        <div class="tbl-wrap"><table><thead><tr><th>Dispositivo</th><th>Campo</th><th>Classe</th><th>Obrigatório</th></tr></thead><tbody>${linhaCampos}</tbody></table></div>
        <p class="note">${U.esc(schema.situacao || "")}</p>
      </div>
      ${pager()}</div>`;
  }

  function desenharSaida() {
    const e = app.estado;
    const linhas = R.ORDEM.map((art) => {
      const schema = app.schemas[art];
      if (art === "dfd") {
        const pend = R.pendencias(schema, e, app.cadastros);
        const st = pend.length ? `${pend.length} pendência(s) no formulário.` : e.artefatos.dfd.status === "validado" ? "Validado. Pronto para gerar." : "Preenchido, ainda não validado: o arquivo sai como prévia.";
        return `<div class="item"><div><div class="t">${U.esc(schema.sigla)} · ${U.esc(schema.titulo)} ${chip(e.artefatos[art].status)}</div><div class="s">${st}</div></div><button class="btn primary" data-app="gerar" ${pend.length ? "disabled" : ""}>Gerar ${U.esc(schema.sigla)}.docx</button></div>`;
      }
      return `<div class="item"><div><div class="t">${U.esc(schema.sigla)} · ${U.esc(schema.titulo)} ${chip(e.artefatos[art].status)}</div><div class="s">Entrega ${ENTREGA[art]}.</div></div><button class="btn" disabled>Em construção</button></div>`;
    }).join("");
    const log = e.eventos
      .slice()
      .reverse()
      .map((x) => `${U.dataHoraBR(x.quando)}  ${x.acao}  ${x.artefato}  por ${x.quem}${x.desatualizados ? "  (desatualizados: " + x.desatualizados.join(", ") + ")" : ""}${x.arquivo ? "  " + x.arquivo + " (rev. " + x.revisao + ")" : ""}${x.caso ? "  caso: " + x.caso : ""}`)
      .join("\n");
    main().innerHTML = `<div class="sheet">
      <div class="eyebrow">Contratação ${U.esc(e.id)}</div><h2>Saída</h2>
      <p class="lede">Documentos em .docx editável, gerados no navegador a partir dos modelos Word, e o arquivo estado.json, que leva a contratação para outro computador.</p>
      <div class="sec"><h3>Documentos</h3><div class="list">${linhas}</div><div id="situacao"></div></div>
      <div class="sec"><h3>Estado da contratação</h3>
        <dl class="kv"><dt>Identificador</dt><dd class="mono">${U.esc(e.id)}</dd><dt>Revisão</dt><dd class="mono">${e.revisao}</dd><dt>Última gravação</dt><dd class="mono">${U.esc(U.dataHoraBR(e.atualizadoEm))}</dd><dt>Schema</dt><dd class="mono">${U.esc(e.schemaVersao)}</dd><dt>Criada por</dt><dd>${U.esc(e.criadoPor)}</dd></dl>
        <div class="row"><button class="btn" data-app="exportar" data-id="${U.esc(e.id)}">Exportar estado.json</button></div>
      </div>
      <div class="sec"><h3>Registro de eventos</h3><div class="log" id="log">${U.esc(log)}</div></div>
      ${pager()}</div>`;
    if (app.msgDoc) $("#situacao").innerHTML = callout(app.msgDoc.tipo, app.msgDoc.titulo, app.msgDoc.texto);
  }

  /* ---------- ações ---------- */
  async function gerarDocumento(art) {
    const schema = app.schemas[art];
    const e = app.estado;
    if (!salvarAgora()) return;
    try {
      const res = await X.gerar(schema, e, app.cadastros);
      X.baixar(res.blob, res.nome);
      R.registrar(e, quem(), "gerou_documento", art, { arquivo: res.nome, revisao: e.revisao });
      marcarSujo(true);
      const previa = e.artefatos[art].status !== "validado";
      app.msgDoc = res.remanescentes.length
        ? { tipo: "warn", titulo: "Arquivo gerado com ressalva.", texto: `${U.esc(res.nome)} foi baixado, mas restaram marcadores sem valor no modelo: <span class="mono">${U.esc(res.remanescentes.join(" "))}</span>.` }
        : { tipo: "ok", titulo: "Arquivo gerado.", texto: `${U.esc(res.nome)} foi enviado para a pasta de downloads do navegador${previa ? " (prévia: o documento ainda não foi validado)" : ""}.` };
    } catch (err) {
      app.msgDoc = { tipo: "bad", titulo: "Não foi possível gerar o arquivo.", texto: U.esc(err.message || String(err)) };
    }
    if (app.tela === "saida") desenharSaida();
    else desenharSituacao(app.tela);
  }

  function criarContratacao(campos, extra) {
    const id = R.proximoId(S.indice(), new Date().getFullYear());
    const e = R.novoEstado({ id, quem: quem(), identificacao: campos });
    Object.assign(e, extra || {});
    const r = S.salvar(e, 0, true);
    S.definirPadroes({ autoridades: campos.autoridades });
    return { id, revisao: r.revisao };
  }

  function exportarEstado(id) {
    if (app.estado && app.estado.id === id) salvarAgora();
    const e = S.carregar(id);
    X.baixar(new Blob([S.exportar(e)], { type: "application/json" }), `estado_${id}.json`);
  }

  function lerArquivoImportado(arquivo) {
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const e = S.lerArquivo(String(leitor.result));
        if (S.existe(e.id)) {
          app.inicio.importar = { estado: e, novoId: R.proximoId(S.indice(), e.id.slice(0, 4)) };
        } else {
          S.importar(e, quem());
          app.inicio.msg = { tipo: "ok", titulo: "Importada.", texto: `Contratação ${U.esc(e.id)} (revisão do arquivo: ${e.revisao}) gravada neste navegador.` };
        }
      } catch (err) {
        app.inicio.msg = { tipo: "bad", titulo: "Arquivo recusado.", texto: U.esc(err.message) + (err.problemas ? `<ul>${err.problemas.map((p) => `<li>${U.esc(p)}</li>`).join("")}</ul>` : "") };
      }
      desenharInicio();
    };
    leitor.onerror = () => {
      app.inicio.msg = { tipo: "bad", titulo: "Arquivo recusado.", texto: "Não foi possível ler o arquivo." };
      desenharInicio();
    };
    leitor.readAsText(arquivo, "utf-8");
  }

  const ACOES = {
    novo() {
      app.inicio.novo = R.novoEstado({ id: R.proximoId(S.indice(), new Date().getFullYear()), quem: quem(), identificacao: padroesNova() });
      desenharNova();
      $("#nova").scrollIntoView({ behavior: "smooth", block: "start" });
    },
    "cancelar-novo"() {
      app.inicio.novo = null;
      $("#nova").innerHTML = "";
    },
    criar() {
      const rasc = app.inicio.novo;
      if (!rasc || R.pendencias(app.schemas.identificacao, rasc, app.cadastros).length) return;
      const r = criarContratacao(rasc.identificacao.campos);
      app.inicio.novo = null;
      ir(`#/c/${encodeURIComponent(r.id)}/dfd`);
    },
    caso() {
      const c = app.caso;
      const id = R.proximoId(S.indice(), new Date().getFullYear());
      const e = R.novoEstado({ id, quem: quem(), identificacao: U.clone(c.identificacao) });
      e.artefatos.dfd.campos = U.clone(c.dfd);
      e.artefatos.dfd.status = "rascunho";
      e.casoReferencia = { id: c.id, descricao: c.descricao, procedencia: c.procedencia };
      e.eventos[0].caso = c.id;
      S.salvar(e, 0, true);
      ir(`#/c/${encodeURIComponent(id)}/dfd`);
    },
    importar() {
      $("#arquivo").click();
    },
    "import-substituir"() {
      const e = app.inicio.importar.estado;
      S.importar(e, quem());
      app.inicio.importar = null;
      app.inicio.msg = { tipo: "ok", titulo: "Substituída.", texto: `Contratação ${U.esc(e.id)} substituída pela versão do arquivo.` };
      desenharInicio();
    },
    "import-copia"() {
      const imp = app.inicio.importar;
      S.importar(imp.estado, quem(), imp.novoId);
      app.inicio.importar = null;
      app.inicio.msg = { tipo: "ok", titulo: "Importada como cópia.", texto: `Contratação gravada como ${U.esc(imp.novoId)}.` };
      desenharInicio();
    },
    "import-cancelar"() {
      app.inicio.importar = null;
      desenharInicio();
    },
    exportar(b) {
      exportarEstado(b.dataset.id);
    },
    "excluir-pedir"(b) {
      app.inicio.excluir = b.dataset.id;
      desenharInicio();
    },
    "excluir-cancelar"() {
      app.inicio.excluir = null;
      desenharInicio();
    },
    "excluir-confirmar"(b) {
      S.excluir(b.dataset.id);
      app.inicio.excluir = null;
      desenharInicio();
    },
    validar() {
      const art = app.tela;
      const e = app.estado;
      if (R.pendencias(app.schemas[art], e, app.cadastros).length) return;
      R.validar(e, art, quem());
      app.msgDoc = null;
      marcarSujo(true);
      desenhar();
    },
    "reabrir-pedir"() {
      app.pedirReabrir = true;
      desenharSituacao(app.tela);
    },
    "reabrir-cancelar"() {
      app.pedirReabrir = false;
      desenharSituacao(app.tela);
    },
    "reabrir-confirmar"() {
      R.reabrir(app.estado, app.tela, quem());
      app.pedirReabrir = false;
      app.msgDoc = null;
      marcarSujo(true);
      desenhar();
    },
    "destravar-ident"() {
      R.identificacaoAlterada(app.estado, quem());
      marcarSujo(true);
      desenhar();
    },
    gerar() {
      gerarDocumento(app.tela === "saida" ? "dfd" : app.tela);
    },
    foco(b) {
      const alvo = document.getElementById(b.dataset.alvo);
      if (!alvo) return;
      alvo.scrollIntoView({ behavior: "smooth", block: "center" });
      const c = alvo.querySelector("input,textarea,select,button");
      if (c) c.focus({ preventScroll: true });
    },
    "conflito-carregar"() {
      app.estado = S.carregar(app.estado.id);
      app.revisaoLida = app.estado.revisao;
      app.sujo = false;
      mostrarConflito(null);
      indicar("ok", `versão gravada carregada · rev. ${app.estado.revisao}`);
      desenhar();
    },
    "conflito-sobrescrever"() {
      salvarAgora(true);
      desenharNav();
    },
    "salvar-de-novo"() {
      salvarAgora();
    }
  };

  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-app]");
    if (!b || !b.dataset.app || b.disabled) return;
    const f = ACOES[b.dataset.app];
    if (!f) return;
    if (b.tagName === "A") ev.preventDefault();
    f(b);
  });
  document.addEventListener("change", (ev) => {
    if (ev.target.id === "arquivo" && ev.target.files && ev.target.files[0]) lerArquivoImportado(ev.target.files[0]);
    if (ev.target.id === "usuario") S.definirUsuario(ev.target.value);
  });
  document.addEventListener("input", (ev) => {
    if (ev.target.id === "usuario") S.definirUsuario(ev.target.value);
  });
  window.addEventListener("hashchange", rotear);
  window.addEventListener("pagehide", () => salvarAgora());
  window.addEventListener("beforeunload", () => salvarAgora());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") salvarAgora();
  });
  /* Outra aba gravou a mesma contratação. */
  window.addEventListener("storage", (ev) => {
    if (!app.estado || ev.key !== S.PREFIXO + "contratacao." + app.estado.id || !ev.newValue) return;
    let novo;
    try {
      novo = JSON.parse(ev.newValue);
    } catch (_) {
      return;
    }
    if (novo.revisao === app.revisaoLida) return;
    if (app.sujo) mostrarConflito(novo.revisao);
    else {
      app.estado = novo;
      app.revisaoLida = novo.revisao;
      indicar("ok", `atualizado por outra aba · rev. ${novo.revisao}`);
      desenhar();
    }
  });

  async function iniciar() {
    const json = async (u) => {
      const r = await fetch(u, { cache: "no-cache" });
      if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`);
      return r.json();
    };
    try {
      const [cad, caso, ...schemas] = await Promise.all([json("schemas/cadastros.json"), json("casos/baterias.json"), ...ARTEFATOS.map((a) => json(`schemas/${a}.json`))]);
      app.cadastros = cad;
      app.caso = caso;
      ARTEFATOS.forEach((a, i) => (app.schemas[a] = schemas[i]));
    } catch (e) {
      main().innerHTML = `<div class="sheet">${callout("bad", "A configuração não carregou.", `${U.esc(e.message || String(e))}<br>Se a página foi aberta direto do disco, use o endereço do GitHub Pages ou um servidor HTTP local: os schemas e os modelos são lidos por HTTP.`)}</div>`;
      return;
    }
    P.app = app;
    rotear();
  }
  iniciar();
})();
