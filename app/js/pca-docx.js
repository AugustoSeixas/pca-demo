/* PCA — geração de .docx no navegador, a partir do modelo Word de cada artefato (docxtemplater + PizZip).
   O modelo traz os textos fixos (RN-05); este módulo só fornece os valores dos marcadores.
   Marcadores gerados para cada campo do schema (m = atributo "marcador" ou o id do campo):
     texto        {m}                          tem_m (verdadeiro se preenchido)
     texto_longo  {#m}{.}{/m} (um parágrafo por linha)   {m_texto} (tudo em uma linha)   tem_m
     data         {m} = dd/mm/aaaa             {m_extenso} = 31 de julho de 2025
     moeda        {m} = R$ 1.234,56            {m_numero} = 1.234,56
     numero       {m}
     selecao      {m}
     tabela       {#m}{n}{coluna}…{/m}         tem_m
     BUSCA        {m} {m_fonte} {m_url} {m_data}
   Marcadores gerais: {id} {revisao} {ano} {gerado_em} {processo_sei} tem_processo_sei {unidade_sigla} {unidade_nome} */
(function (root) {
  "use strict";
  const P = (root.PCA = root.PCA || {});
  const U = P.util;
  const R = P.regras;
  const MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const cacheModelos = {};

  function formatarCelula(col, v) {
    if (col.tipo === "moeda") return U.moeda(v);
    if (col.tipo === "numero") return U.numero(v);
    if (col.tipo === "data") return U.dataBR(v);
    return v == null ? "" : String(v);
  }

  const X = {
    MIME,

    dados(schema, estado, cadastros) {
      const ctx = R.contexto(estado, cadastros);
      const agora = U.agoraISO();
      const d = {
        id: estado.id,
        revisao: estado.revisao,
        ano: agora.slice(0, 4),
        gerado_em: U.dataHoraBR(agora),
        processo_sei: ctx.contratacao.processo_sei || "",
        tem_processo_sei: !!(ctx.contratacao.processo_sei || "").trim(),
        unidade_sigla: ctx.contratacao.unidade_sigla,
        unidade_nome: ctx.contratacao.unidade_nome
      };
      R.todosCampos(schema).forEach((campo) => {
        if (campo.classe === "FIXO") return;
        const m = campo.marcador || campo.id;
        let v = R.valor(campo, estado, schema.artefato, cadastros);
        if (campo.classe === "BUSCA" && campo.tipo !== "tabela") {
          const b = v || {};
          d[m + "_fonte"] = b.fonte || "";
          d[m + "_url"] = b.url || "";
          d[m + "_data"] = U.dataBR(b.data);
          v = b.valor;
        }
        if (campo.tipo === "tabela") {
          const linhas = Array.isArray(v) ? v : [];
          d[m] = linhas.map((l, i) => {
            const o = { n: i + 1 };
            (campo.colunas || []).forEach((c) => (o[c.id] = formatarCelula(c, l ? l[c.id] : "")));
            return o;
          });
          d["tem_" + m] = linhas.length > 0;
        } else if (campo.tipo === "texto_longo") {
          const pars = Array.isArray(v) ? v : U.paragrafos(v);
          d[m] = pars;
          d[m + "_texto"] = pars.join(" ");
          d["tem_" + m] = pars.length > 0;
        } else if (campo.tipo === "data") {
          d[m] = U.dataBR(v);
          d[m + "_extenso"] = U.dataExtenso(v);
          d["tem_" + m] = !!v;
        } else if (campo.tipo === "moeda") {
          d[m] = U.moeda(v);
          d[m + "_numero"] = U.decimal(v);
          d["tem_" + m] = typeof v === "number" && !isNaN(v);
        } else if (campo.tipo === "numero") {
          d[m] = U.numero(v);
          d["tem_" + m] = typeof v === "number" && !isNaN(v);
        } else {
          let t = v == null ? "" : String(v).trim();
          if (campo.formato === "maiusculas") t = t.toLocaleUpperCase("pt-BR");
          d[m] = t;
          d["tem_" + m] = t !== "";
        }
      });
      return d;
    },

    async modelo(schema) {
      const url = `${schema.modelo}?v=${encodeURIComponent(schema.versao)}`;
      if (!cacheModelos[url]) {
        const r = await fetch(url, { cache: "no-cache" });
        if (!r.ok) throw new Error(`Não foi possível carregar o modelo ${schema.modelo} (HTTP ${r.status}).`);
        cacheModelos[url] = await r.arrayBuffer();
      }
      return cacheModelos[url];
    },

    /* Preenche um modelo (ArrayBuffer) com os dados. Devolve { blob, remanescentes }. */
    preencher(bufferModelo, dados) {
      if (!root.PizZip || !root.docxtemplater) throw new Error("As bibliotecas de geração do .docx não carregaram. Recarregue a página.");
      let doc;
      try {
        doc = new root.docxtemplater(new root.PizZip(bufferModelo), { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
        doc.render(dados);
      } catch (e) {
        const det = e && e.properties && e.properties.errors ? e.properties.errors.map((x) => (x.properties && x.properties.explanation) || x.message).join(" | ") : (e && e.message) || String(e);
        throw new Error("O modelo Word tem um marcador com problema: " + det);
      }
      const texto = doc.getFullText();
      const remanescentes = (texto.match(/\{[#/^]?[A-Za-z_.][A-Za-z0-9_.]*\}/g) || []).filter((v, i, a) => a.indexOf(v) === i);
      const blob = doc.getZip().generate({ type: "blob", mimeType: MIME, compression: "DEFLATE" });
      return { blob, remanescentes };
    },

    nomeArquivo(schema, estado) {
      return String(schema.arquivo_saida || `${schema.sigla || schema.artefato}_{id}.docx`).replace("{id}", estado.id);
    },

    async gerar(schema, estado, cadastros) {
      const buffer = await X.modelo(schema);
      const res = X.preencher(buffer, X.dados(schema, estado, cadastros));
      res.nome = X.nomeArquivo(schema, estado);
      return res;
    },

    baixar(blob, nome) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  };

  P.docx = X;
})(typeof window !== "undefined" ? window : globalThis);
