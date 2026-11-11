/* PCA — motor de formulários. Lê apenas o schema: nenhum campo é programado individualmente.
   Classes: FIXO (não editável, RN-05), HERDADO (somente leitura, com origem, RN-02), USUARIO,
   BUSCA (valor + fonte + URL + data, RN-04) e REDIGIDO (síntese sem fato novo; editável). */
(function (root) {
  "use strict";
  const P = (root.PCA = root.PCA || {});
  const U = P.util;
  const R = P.regras;
  const ROTULO_CLASSE = { FIXO: "FIXO", HERDADO: "HERDADO", USUARIO: "USUÁRIO", BUSCA: "BUSCA", REDIGIDO: "REDIGIDO" };

  function opcoesDe(campo, cadastros) {
    if (campo.opcoes_de) {
      return ((cadastros && cadastros[campo.opcoes_de]) || []).map((o) => (typeof o === "string" ? { valor: o, rotulo: o } : { valor: o.sigla, rotulo: `${o.sigla} — ${o.nome}` }));
    }
    return (campo.opcoes || []).map((o) => ({ valor: o, rotulo: o }));
  }

  /* Texto de exibição (somente leitura) de um valor, conforme o tipo. Devolve HTML. */
  function exibir(campo, valor) {
    const vazio = '<div class="fval vazio">Ainda não preenchido.</div>';
    if (campo.tipo === "tabela") {
      const linhas = Array.isArray(valor) ? valor : [];
      if (!linhas.length) return vazio;
      const cols = campo.colunas || [];
      const cel = (col, v) => (col.tipo === "moeda" ? U.decimal(v) : col.tipo === "numero" ? U.numero(v) : col.tipo === "data" ? U.dataBR(v) : U.esc(v == null ? "" : v));
      return `<div class="tbl-wrap"><table><thead><tr><th class="num">#</th>${cols.map((c) => `<th class="${c.tipo === "numero" || c.tipo === "moeda" ? "num" : ""}">${U.esc(c.rotulo)}</th>`).join("")}</tr></thead><tbody>${linhas
        .map((l, i) => `<tr><td class="num">${i + 1}</td>${cols.map((c) => `<td class="${c.tipo === "numero" || c.tipo === "moeda" ? "num" : ""}">${cel(c, l ? l[c.id] : "")}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></div>`;
    }
    if (valor == null || valor === "" || (Array.isArray(valor) && !valor.length)) return vazio;
    if (campo.tipo === "moeda") return `<div class="fval">${U.esc(U.moeda(valor))}</div>`;
    if (campo.tipo === "numero") return `<div class="fval">${U.esc(U.numero(valor))}</div>`;
    if (campo.tipo === "data") return `<div class="fval">${U.esc(U.dataBR(valor))}</div>`;
    const pars = Array.isArray(valor) ? valor : U.paragrafos(valor);
    const fmt = (t) => (campo.formato === "maiusculas" ? String(t).toLocaleUpperCase("pt-BR") : t);
    return `<div class="fval">${pars.map((p) => `<p>${U.esc(fmt(p))}</p>`).join("")}</div>`;
  }

  function celulaEditavel(campo, col, linha, i, bloqueado, art) {
    const v = linha ? linha[col.id] : "";
    const base = `data-campo="${campo.id}" data-linha="${i}" data-col="${col.id}" aria-label="${U.esc(col.rotulo)}, linha ${i + 1}" ${bloqueado ? "disabled" : ""}`;
    const cls = `col-${col.tipo}${col.largura ? " col-" + col.largura : ""}`;
    if (col.tipo === "selecao") {
      return `<td class="${cls}"><select ${base}><option value="">Selecione…</option>${(col.opcoes || []).map((o) => `<option ${o === v ? "selected" : ""}>${U.esc(o)}</option>`).join("")}</select></td>`;
    }
    if (col.tipo === "data") return `<td class="${cls}"><input type="date" ${base} value="${U.esc(v || "")}"></td>`;
    if (col.tipo === "numero" || col.tipo === "moeda") {
      const txt = v == null || (typeof v === "number" && isNaN(v)) ? "" : col.tipo === "moeda" ? U.decimal(v) : U.numero(v);
      return `<td class="${cls}"><input type="text" inputmode="decimal" ${base} value="${U.esc(txt)}"></td>`;
    }
    if (col.tipo === "url") return `<td class="${cls}"><input type="url" ${base} value="${U.esc(v || "")}" placeholder="https://"></td>`;
    return `<td class="${cls}"><input type="text" ${base} value="${U.esc(v == null ? "" : v)}"></td>`;
  }

  function tabelaEditavel(campo, valor, bloqueado, art) {
    const linhas = Array.isArray(valor) ? valor : [];
    const cols = campo.colunas || [];
    const corpo = linhas.length
      ? linhas
          .map(
            (l, i) =>
              `<tr><td class="num">${i + 1}</td>${cols.map((c) => celulaEditavel(campo, c, l, i, bloqueado, art)).join("")}<td class="acoes">` +
              `<button type="button" class="ic" data-acao="sobe" data-campo="${campo.id}" data-linha="${i}" title="Mover para cima" aria-label="Mover a linha ${i + 1} para cima" ${bloqueado || i === 0 ? "disabled" : ""}>↑</button> ` +
              `<button type="button" class="ic" data-acao="desce" data-campo="${campo.id}" data-linha="${i}" title="Mover para baixo" aria-label="Mover a linha ${i + 1} para baixo" ${bloqueado || i === linhas.length - 1 ? "disabled" : ""}>↓</button> ` +
              `<button type="button" class="ic" data-acao="remove" data-campo="${campo.id}" data-linha="${i}" title="Remover linha" aria-label="Remover a linha ${i + 1}" ${bloqueado ? "disabled" : ""}>✕</button></td></tr>`
          )
          .join("")
      : `<tr><td colspan="${cols.length + 2}" class="note">Nenhuma linha incluída.</td></tr>`;
    return (
      `<div class="tbl-wrap"><table class="edit"><thead><tr><th class="num">#</th>${cols.map((c) => `<th>${U.esc(c.rotulo)}${c.obrigatorio ? ' <span class="req">*</span>' : ""}</th>`).join("")}<th></th></tr></thead><tbody>${corpo}</tbody></table></div>` +
      `<div class="row"><button type="button" class="btn small" data-acao="inclui" data-campo="${campo.id}" ${bloqueado ? "disabled" : ""}>+ Incluir linha</button></div>`
    );
  }

  function controle(campo, valor, art, bloqueado, cadastros) {
    const idc = `c-${art}-${campo.id}`;
    const base = `id="${idc}" data-campo="${campo.id}" ${bloqueado ? "disabled" : ""}`;
    if (campo.tipo === "tabela") return tabelaEditavel(campo, valor, bloqueado, art);

    let v = valor;
    let meta = "";
    if (campo.classe === "BUSCA") {
      const b = valor || {};
      v = b.valor;
      const dis = bloqueado ? "disabled" : "";
      meta =
        `<div class="busca-meta">` +
        `<label>Fonte<input type="text" data-campo="${campo.id}" data-parte="fonte" value="${U.esc(b.fonte || "")}" ${dis}></label>` +
        `<label>URL da fonte<input type="url" data-campo="${campo.id}" data-parte="url" value="${U.esc(b.url || "")}" placeholder="https://" ${dis}></label>` +
        `<label>Data da consulta<input type="date" data-campo="${campo.id}" data-parte="data" value="${U.esc(b.data || "")}" ${dis}></label></div>`;
    }
    const parte = campo.classe === "BUSCA" ? ' data-parte="valor"' : "";
    let html;
    if (campo.tipo === "texto_longo") html = `<textarea ${base}${parte}>${U.esc(v == null ? "" : v)}</textarea>`;
    else if (campo.tipo === "selecao") {
      html = `<select ${base}${parte}><option value="">Selecione…</option>${opcoesDe(campo, cadastros)
        .map((o) => `<option value="${U.esc(o.valor)}" ${o.valor === v ? "selected" : ""}>${U.esc(o.rotulo)}</option>`)
        .join("")}</select>`;
    } else if (campo.tipo === "data") html = `<input type="date" ${base}${parte} value="${U.esc(v || "")}">`;
    else if (campo.tipo === "moeda") {
      const txt = v == null || (typeof v === "number" && isNaN(v)) ? "" : U.decimal(v);
      html = `<div class="moeda"><span>R$</span><input type="text" inputmode="decimal" class="curto" ${base}${parte} value="${U.esc(txt)}" placeholder="0,00"></div>`;
    } else if (campo.tipo === "numero") {
      const txt = v == null || (typeof v === "number" && isNaN(v)) ? "" : U.numero(v);
      html = `<input type="text" inputmode="decimal" class="curto" ${base}${parte} value="${U.esc(txt)}">`;
    } else html = `<input type="text" ${base}${parte} value="${U.esc(v == null ? "" : v)}">`;
    return html + meta;
  }

  function campoHTML(campo, estado, art, cadastros, opts) {
    const valor = R.valor(campo, estado, art, cadastros);
    const bloqueado = !!opts.somenteLeitura;
    const idc = `c-${art}-${campo.id}`;
    let corpo;
    if (campo.classe === "FIXO") {
      const txt = Array.isArray(campo.texto) ? campo.texto : U.paragrafos(campo.texto);
      corpo = txt.length ? `<div class="fval">${txt.map((p) => `<p>${U.esc(p)}</p>`).join("")}</div>` : `<div class="fval vazio">${U.esc(campo.pendente || "Texto fixo a definir no modelo Word.")}</div>`;
    } else if (campo.classe === "HERDADO") {
      const origem = R.origemDe(campo);
      const link = opts.rota ? ` · <a href="${U.esc(opts.rota(origem))}">alterar na origem</a>` : "";
      corpo = exibir(campo, valor) + `<div class="forig">Herdado de: ${U.esc(R.NOMES[origem] || origem)}${link}</div>`;
    } else corpo = controle(campo, valor, art, bloqueado, cadastros);
    const rotulo = campo.tipo === "tabela" || campo.classe === "FIXO" || campo.classe === "HERDADO" ? `<span class="lbl">${U.esc(campo.rotulo)}</span>` : `<label class="lbl" for="${idc}">${U.esc(campo.rotulo)}</label>`;
    return (
      `<div class="field" id="f-${art}-${campo.id}" data-id="${campo.id}">` +
      `<div class="fhead">${campo.ref ? `<span class="ref">${U.esc(campo.ref)}</span>` : ""}${rotulo}<span class="req" data-req title="Obrigatório" hidden>*</span>` +
      `<span class="types"><span class="ty ${campo.classe}">${ROTULO_CLASSE[campo.classe] || campo.classe}</span></span></div>` +
      `<div data-corpo>${corpo}</div>` +
      (campo.ajuda ? `<div class="fhelp">${U.esc(campo.ajuda)}</div>` : "") +
      `<div class="ferr" data-erro role="alert" hidden></div></div>`
    );
  }

  const M = {
    opcoesDe,
    exibir,

    html(schema, estado, cadastros, opts) {
      opts = opts || {};
      const art = schema.artefato;
      return (schema.secoes || [])
        .map((s) => `<div class="sec" data-secao="${U.esc(s.id)}"><h3>${U.esc(s.titulo)}</h3>${(s.campos || []).map((c) => campoHTML(c, estado, art, cadastros, opts)).join("")}</div>`)
        .join("");
    },

    /* Atualiza marcas de pendência, asterisco de obrigatório e visibilidade, sem redesenhar os campos. */
    atualizarMarcas(container, schema, estado, cadastros) {
      const art = schema.artefato;
      const pend = R.pendencias(schema, estado, cadastros);
      const porId = Object.fromEntries(pend.map((p) => [p.id, p]));
      R.todosCampos(schema).forEach((campo) => {
        const el = container.querySelector(`#f-${art}-${campo.id}`);
        if (!el) return;
        el.hidden = !R.visivel(campo, estado, art);
        const req = el.querySelector("[data-req]");
        if (req) req.hidden = !R.obrigatorio(campo, estado, art);
        const p = porId[campo.id];
        el.classList.toggle("pend", !!p);
        const err = el.querySelector("[data-erro]");
        if (err) {
          err.hidden = !p;
          err.textContent = p ? p.msgs.join(" ") : "";
        }
      });
      return pend;
    },

    /* Liga os eventos do formulário. opts.aoAlterar(campoId, imediato) é chamado a cada mudança. */
    ligar(container, schema, estado, cadastros, opts) {
      opts = opts || {};
      const art = schema.artefato;
      const campos = Object.fromEntries(R.todosCampos(schema).map((c) => [c.id, c]));
      const dados = () => R.camposDe(estado, art);
      const avisar = (id, imediato) => {
        R.tocar(estado, art);
        M.atualizarMarcas(container, schema, estado, cadastros);
        if (opts.aoAlterar) opts.aoAlterar(id, !!imediato);
      };
      const redesenharTabela = (campo, foco) => {
        const el = container.querySelector(`#f-${art}-${campo.id} [data-corpo]`);
        if (!el) return;
        el.innerHTML = tabelaEditavel(campo, dados()[campo.id], !!opts.somenteLeitura, art);
        if (foco != null) {
          const alvo = el.querySelector(`[data-linha="${foco}"][data-col]`);
          if (alvo) alvo.focus();
        }
      };
      const lerControle = (campoOuCol, el) => {
        const tipo = campoOuCol.tipo;
        if (tipo === "numero" || tipo === "moeda") {
          const n = U.lerNumero(el.value);
          return n === null ? null : n; /* NaN fica registrado e vira pendência */
        }
        return el.value;
      };

      function aplicar(el, final) {
        const id = el.dataset.campo;
        const campo = campos[id];
        if (!campo || campo.classe === "FIXO" || campo.classe === "HERDADO") return;
        const d = dados();
        if (el.dataset.linha != null && el.dataset.col) {
          const col = (campo.colunas || []).find((c) => c.id === el.dataset.col);
          const i = +el.dataset.linha;
          if (!Array.isArray(d[id])) d[id] = [];
          if (!d[id][i]) d[id][i] = {};
          d[id][i][col.id] = lerControle(col, el);
          if (final && (col.tipo === "numero" || col.tipo === "moeda")) {
            const n = d[id][i][col.id];
            if (typeof n === "number" && !isNaN(n)) el.value = col.tipo === "moeda" ? U.decimal(n) : U.numero(n);
          }
        } else if (campo.classe === "BUSCA") {
          const parte = el.dataset.parte || "valor";
          d[id] = Object.assign({ valor: "", fonte: "", url: "", data: "" }, d[id] || {});
          d[id][parte] = parte === "valor" ? lerControle(campo, el) : el.value;
        } else {
          d[id] = lerControle(campo, el);
          if (final && (campo.tipo === "numero" || campo.tipo === "moeda")) {
            const n = d[id];
            if (typeof n === "number" && !isNaN(n)) el.value = campo.tipo === "moeda" ? U.decimal(n) : U.numero(n);
          }
        }
        avisar(id, final);
      }

      container.addEventListener("input", (ev) => {
        const el = ev.target;
        if (el.dataset && el.dataset.campo && el.tagName !== "SELECT" && el.type !== "date") aplicar(el, false);
      });
      container.addEventListener("change", (ev) => {
        const el = ev.target;
        if (el.dataset && el.dataset.campo) aplicar(el, true);
      });
      container.addEventListener("click", (ev) => {
        const b = ev.target.closest("button[data-acao]");
        if (!b || b.disabled) return;
        const campo = campos[b.dataset.campo];
        if (!campo || opts.somenteLeitura) return;
        const d = dados();
        if (!Array.isArray(d[campo.id])) d[campo.id] = [];
        const lista = d[campo.id];
        const i = +b.dataset.linha;
        let foco = null;
        if (b.dataset.acao === "inclui") {
          lista.push({});
          foco = lista.length - 1;
        } else if (b.dataset.acao === "remove") lista.splice(i, 1);
        else if (b.dataset.acao === "sobe" && i > 0) lista.splice(i - 1, 0, lista.splice(i, 1)[0]);
        else if (b.dataset.acao === "desce" && i < lista.length - 1) lista.splice(i + 1, 0, lista.splice(i, 1)[0]);
        redesenharTabela(campo, foco);
        avisar(campo.id, true);
      });
      M.atualizarMarcas(container, schema, estado, cadastros);
    }
  };

  P.motor = M;
})(typeof window !== "undefined" ? window : globalThis);
