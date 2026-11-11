/* PCA — regras de negócio (RN-01 a RN-11), sem dependência de tela.
   Cada regra é escrita uma vez aqui; a interface e os testes chamam este módulo. */
(function (root) {
  "use strict";
  const P = (root.PCA = root.PCA || {});
  const U = P.util || (typeof require !== "undefined" ? require("./pca-util.js").util : null);

  const ORDEM = ["dfd", "etp", "tr", "mapa"];
  const STATUS = ["nao_iniciado", "rascunho", "validado", "desatualizado"];
  const NOMES = { identificacao: "Identificação", dfd: "DFD", etp: "ETP", tr: "TR", mapa: "Mapa de Riscos" };
  const SCHEMA_VERSAO = "2.0";

  const R = {
    ORDEM,
    STATUS,
    NOMES,
    SCHEMA_VERSAO,

    /* ---------- estrutura do estado (contrato de dados de 28/09, estendido com "identificacao") ---------- */
    novoEstado({ id, quem, identificacao }) {
      const agora = U.agoraISO();
      const campos = U.clone(identificacao || {});
      return {
        id,
        schemaVersao: SCHEMA_VERSAO,
        revisao: 0,
        objeto: campos.objeto || "",
        processoSei: campos.processo_sei || "",
        criadoPor: quem || "não identificado",
        criadoEm: agora,
        atualizadoEm: agora,
        etapaAtual: "dfd",
        identificacao: { campos },
        artefatos: {
          dfd: { status: "nao_iniciado", campos: {} },
          etp: { status: "nao_iniciado", modo: "completo", campos: {} },
          tr: { status: "nao_iniciado", campos: {} },
          mapa: { status: "nao_iniciado", campos: {}, riscos: [] }
        },
        eventos: [{ quando: agora, quem: quem || "não identificado", acao: "criou", artefato: "contratacao" }]
      };
    },

    /* RN-11: código anual sequencial AAAA-NNN. */
    proximoId(indice, ano) {
      const seqs = (indice || []).map((c) => /^(\d{4})-(\d{3,})$/.exec(c.id || "")).filter((m) => m && +m[1] === +ano).map((m) => +m[2]);
      const n = (seqs.length ? Math.max(...seqs) : 0) + 1;
      return `${ano}-${String(n).padStart(3, "0")}`;
    },

    /* Confere um estado importado. Devolve a lista de problemas (vazia se estiver íntegro). */
    verificarEstado(e) {
      const prob = [];
      const obj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
      const txt = (x) => typeof x === "string";
      if (!obj(e)) return ["O arquivo não contém um estado do PCA."];
      if (!txt(e.id) || !/^\d{4}-\d{3,}$/.test(e.id)) prob.push("Identificador ausente ou fora do padrão AAAA-NNN.");
      if (!/^2\./.test(String(e.schemaVersao || ""))) prob.push(`Versão de schema não suportada: ${e.schemaVersao || "ausente"} (esperada 2.x).`);
      if (!Number.isInteger(e.revisao) || e.revisao < 0) prob.push("Número de revisão inválido.");
      if (!obj(e.identificacao) || !obj(e.identificacao.campos)) prob.push("Bloco de identificação ausente.");
      if (e.etapaAtual != null && !ORDEM.includes(e.etapaAtual)) prob.push("Etapa atual desconhecida.");
      if (!obj(e.artefatos)) prob.push("Bloco de artefatos ausente.");
      else {
        let coerente = true;
        ORDEM.forEach((a, i) => {
          const art = e.artefatos[a];
          if (!obj(art)) prob.push(`Artefato ausente: ${a}.`);
          else if (!STATUS.includes(art.status)) prob.push(`Status inválido em ${a}: ${String(art.status)}.`);
          else if (!obj(art.campos)) prob.push(`Campos ausentes em ${a}.`);
          else if (i > 0 && art.status === "validado" && (!obj(e.artefatos[ORDEM[i - 1]]) || e.artefatos[ORDEM[i - 1]].status !== "validado")) coerente = false;
        });
        /* RN-01: um documento não pode chegar validado se o anterior não está validado. */
        if (!coerente) prob.push("Estado incoerente: há documento validado sem que o anterior esteja validado.");
      }
      if (!Array.isArray(e.eventos)) prob.push("Registro de eventos ausente.");
      else if (!e.eventos.every((x) => obj(x) && txt(x.quando) && txt(x.quem) && txt(x.acao) && txt(x.artefato) && (x.desatualizados == null || Array.isArray(x.desatualizados)))) prob.push("Registro de eventos com entrada malformada.");
      if (e.casoReferencia != null && !(obj(e.casoReferencia) && txt(e.casoReferencia.descricao) && Array.isArray(e.casoReferencia.procedencia) && e.casoReferencia.procedencia.every(txt))) prob.push("Bloco do caso de referência malformado.");
      return prob;
    },

    /* ---------- leitura de valores ---------- */
    camposDe(estado, artefato) {
      if (artefato === "identificacao") return estado.identificacao.campos;
      return estado.artefatos[artefato].campos;
    },

    /* Contexto usado para resolver a "origem" dos campos HERDADO: contratacao.*, dfd.*, etp.*, tr.* */
    contexto(estado, cadastros) {
      const ident = estado.identificacao.campos;
      const unidade = ((cadastros && cadastros.unidades) || []).find((u) => u.sigla === ident.unidade) || null;
      return {
        contratacao: Object.assign({}, ident, {
          id: estado.id,
          unidade_sigla: ident.unidade || "",
          unidade_nome: unidade ? unidade.nome : ident.unidade || "",
          unidade_descricao: unidade ? `${unidade.nome} (${unidade.sigla})` : ident.unidade || ""
        }),
        dfd: estado.artefatos.dfd.campos,
        etp: estado.artefatos.etp.campos,
        tr: estado.artefatos.tr.campos,
        mapa: estado.artefatos.mapa.campos
      };
    },

    /* Valor efetivo de um campo: FIXO vem do schema, HERDADO vem da origem, os demais vêm do estado. */
    valor(campo, estado, artefato, cadastros) {
      if (campo.classe === "FIXO") return campo.texto;
      if (campo.classe === "HERDADO") return U.obter(R.contexto(estado, cadastros), campo.origem);
      return R.camposDe(estado, artefato)[campo.id];
    },

    /* Nome do artefato de onde um campo herdado vem (RN-02). */
    origemDe(campo) {
      const raiz = String(campo.origem || "").split(".")[0];
      return raiz === "contratacao" ? "identificacao" : raiz;
    },

    condicao(cond, estado, artefato) {
      if (!cond) return true;
      const v = R.camposDe(estado, artefato)[cond.campo];
      if ("igual" in cond) return v === cond.igual;
      if ("diferente" in cond) return v !== cond.diferente;
      if ("em" in cond) return (cond.em || []).includes(v);
      return true;
    },

    visivel(campo, estado, artefato) {
      return R.condicao(campo.visivel_se, estado, artefato);
    },

    /* Obrigatoriedade: true/false, por modo do ETP ({completo, simplificado}) ou condicional ({se}). */
    obrigatorio(campo, estado, artefato) {
      const o = campo.obrigatorio;
      if (campo.classe === "FIXO") return false;
      if (!R.visivel(campo, estado, artefato)) return false;
      if (o === true || o === false || o == null) return !!o;
      if (typeof o === "object") {
        if ("se" in o) return R.condicao(o.se, estado, artefato);
        const modo = (estado.artefatos[artefato] && estado.artefatos[artefato].modo) || "completo";
        return !!o[modo];
      }
      return false;
    },

    /* Problemas de preenchimento de um campo. Devolve lista de mensagens (vazia = em ordem). */
    problemas(campo, valor, exigido) {
      const msgs = [];
      const vazioTxt = (v) => v == null || String(v).trim() === "";
      if (campo.classe === "FIXO") return msgs;

      if (campo.classe === "BUSCA" && campo.tipo !== "tabela") {
        /* RN-04: valor, fonte, URL e data de consulta. */
        const b = valor || {};
        const temAlgo = !vazioTxt(b.valor) || !vazioTxt(b.fonte) || !vazioTxt(b.url) || !vazioTxt(b.data);
        if (!temAlgo) {
          if (exigido) msgs.push("Campo obrigatório: informe valor, fonte, URL e data de consulta.");
          return msgs;
        }
        if (vazioTxt(b.valor)) msgs.push("Informe o valor.");
        if (vazioTxt(b.fonte)) msgs.push("Informe a fonte.");
        if (!U.urlValida(b.url)) msgs.push("Informe a URL da fonte (começando com http:// ou https://).");
        if (vazioTxt(b.data)) msgs.push("Informe a data da consulta.");
        return msgs;
      }

      if (campo.tipo === "tabela") {
        const linhas = Array.isArray(valor) ? valor : [];
        const min = campo.min_linhas != null ? campo.min_linhas : exigido ? 1 : 0;
        if (linhas.length < min) {
          msgs.push(min === 1 ? "Inclua ao menos uma linha." : `Inclua ao menos ${min} linhas.`);
          return msgs;
        }
        linhas.forEach((l, i) => {
          (campo.colunas || []).forEach((col) => {
            const v = l ? l[col.id] : undefined;
            if (col.tipo === "numero" || col.tipo === "moeda") {
              if (typeof v === "number" && isNaN(v)) msgs.push(`Linha ${i + 1}: "${col.rotulo}" não é um número válido.`);
              else if (v == null || v === "") {
                if (col.obrigatorio) msgs.push(`Linha ${i + 1}: informe "${col.rotulo}".`);
              } else if (col.positivo && !(v > 0)) msgs.push(`Linha ${i + 1}: "${col.rotulo}" deve ser maior que zero.`);
            } else if (col.tipo === "url") {
              if (vazioTxt(v)) {
                if (col.obrigatorio) msgs.push(`Linha ${i + 1}: informe "${col.rotulo}".`);
              } else if (!U.urlValida(v)) msgs.push(`Linha ${i + 1}: "${col.rotulo}" deve começar com http:// ou https://.`);
            } else if (col.obrigatorio && vazioTxt(v)) msgs.push(`Linha ${i + 1}: informe "${col.rotulo}".`);
          });
        });
        return msgs;
      }

      if (campo.tipo === "numero" || campo.tipo === "moeda") {
        if (typeof valor === "number" && isNaN(valor)) msgs.push("Número inválido: use algarismos, ponto de milhar e vírgula decimal.");
        else if (valor == null || valor === "") {
          if (exigido) msgs.push("Campo obrigatório.");
        } else if (campo.positivo && !(valor > 0)) msgs.push("O valor deve ser maior que zero.");
        return msgs;
      }

      if (campo.tipo === "selecao") {
        if (vazioTxt(valor)) {
          if (exigido) msgs.push("Selecione uma opção.");
        } else if (Array.isArray(campo.opcoes) && !campo.opcoes.includes(valor)) msgs.push("Opção fora da lista do schema.");
        return msgs;
      }

      if (campo.tipo === "data") {
        if (vazioTxt(valor)) {
          if (exigido) msgs.push("Informe a data.");
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) msgs.push("Data inválida.");
        return msgs;
      }

      if (exigido && vazioTxt(valor)) msgs.push("Campo obrigatório.");
      return msgs;
    },

    todosCampos(schema) {
      return (schema.secoes || []).flatMap((s) => s.campos || []);
    },

    /* Pendências de um artefato: cada item traz o campo, o dispositivo legal e as mensagens (FS-06). */
    pendencias(schema, estado, cadastros) {
      const art = schema.artefato;
      const lista = [];
      R.todosCampos(schema).forEach((campo) => {
        if (!R.visivel(campo, estado, art)) return;
        const exigido = R.obrigatorio(campo, estado, art);
        const v = R.valor(campo, estado, art, cadastros);
        let msgs = R.problemas(campo, v, exigido);
        if (campo.classe === "HERDADO" && msgs.length) {
          msgs = [`Preencha na origem: ${NOMES[R.origemDe(campo)] || R.origemDe(campo)}.`];
        }
        if (msgs.length) lista.push({ id: campo.id, rotulo: campo.rotulo, ref: campo.ref || "", fundamento: campo.fundamento || "", classe: campo.classe, origem: campo.classe === "HERDADO" ? R.origemDe(campo) : null, msgs });
      });
      return lista;
    },

    /* ---------- RN-01, RN-02, RN-03: ordem, checkpoint e reabertura ---------- */
    liberado(estado, artefato) {
      const i = ORDEM.indexOf(artefato);
      if (i <= 0) return true;
      return estado.artefatos[ORDEM[i - 1]].status === "validado";
    },

    editavel(estado, artefato) {
      if (artefato === "identificacao") return true;
      return R.liberado(estado, artefato) && estado.artefatos[artefato].status !== "validado";
    },

    registrar(estado, quem, acao, artefato, extra) {
      estado.eventos.push(Object.assign({ quando: U.agoraISO(), quem: quem || "não identificado", acao, artefato }, extra || {}));
    },

    /* Marca o início do preenchimento. */
    tocar(estado, artefato) {
      if (artefato === "identificacao") return;
      const a = estado.artefatos[artefato];
      if (a.status === "nao_iniciado") a.status = "rascunho";
    },

    validar(estado, artefato, quem) {
      if (!R.liberado(estado, artefato)) throw new Error("Artefato ainda não liberado: valide o anterior (RN-01).");
      estado.artefatos[artefato].status = "validado";
      const prox = ORDEM[ORDEM.indexOf(artefato) + 1];
      if (prox) estado.etapaAtual = prox;
      R.registrar(estado, quem, "validou", artefato);
    },

    /* Dependentes que já têm conteúdo passam a "desatualizado" (RN-03). */
    desatualizarDependentes(estado, artefato) {
      const i = artefato === "identificacao" ? -1 : ORDEM.indexOf(artefato);
      const afetados = [];
      ORDEM.slice(i + 1).forEach((d) => {
        const a = estado.artefatos[d];
        if (a.status === "validado" || (a.status === "rascunho" && i >= 0)) {
          a.status = "desatualizado";
          afetados.push(d);
        }
      });
      return afetados;
    },

    reabrir(estado, artefato, quem) {
      estado.artefatos[artefato].status = "rascunho";
      estado.etapaAtual = artefato;
      const afetados = R.desatualizarDependentes(estado, artefato);
      R.registrar(estado, quem, "reabriu", artefato, afetados.length ? { desatualizados: afetados } : null);
      return afetados;
    },

    /* Alterar a identificação depois de validar documentos que herdam dela exige nova validação. */
    identificacaoAlterada(estado, quem) {
      estado.objeto = estado.identificacao.campos.objeto || "";
      estado.processoSei = estado.identificacao.campos.processo_sei || "";
      const afetados = R.desatualizarDependentes(estado, "identificacao");
      if (afetados.length) R.registrar(estado, quem, "alterou_identificacao", "contratacao", { desatualizados: afetados });
      return afetados;
    },

    /* ---------- RN-07: estatísticas de cotações ---------- */
    estatisticas(valores) {
      const v = (valores || []).filter((x) => typeof x === "number" && isFinite(x)).sort((a, b) => a - b);
      const n = v.length;
      if (!n) return { n: 0, media: null, mediana: null, minimo: null, maximo: null };
      const m = Math.floor(n / 2);
      return { n, media: U.r2(v.reduce((s, x) => s + x, 0) / n), mediana: U.r2(n % 2 ? v[m] : (v[m - 1] + v[m]) / 2), minimo: v[0], maximo: v[n - 1] };
    },

    /* ---------- RN-08: grau de risco (legenda do modelo EP 3.01) ---------- */
    grauRisco(p, i) {
      const g = U.r2(p * i);
      const classe = g < 1 ? "Insignificante" : g < 2 ? "Leve" : g < 3 ? "Médio" : g < 4 ? "Alto" : "Muito alto";
      return { grau: g, classe };
    }
  };

  P.regras = R;
  if (typeof module !== "undefined" && module.exports) module.exports = P;
})(typeof window !== "undefined" ? window : globalThis);
