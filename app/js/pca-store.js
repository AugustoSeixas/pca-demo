/* PCA — persistência no navegador (localStorage) e arquivo estado.json.
   RN-09: cada gravação confere a revisão; se outra aba gravou antes, devolve CONFLITO. */
(function (root) {
  "use strict";
  const P = (root.PCA = root.PCA || {});
  const U = P.util;
  const R = P.regras;
  const PREFIXO = "pca.v1.";
  const K = { indice: PREFIXO + "indice", usuario: PREFIXO + "usuario", padroes: PREFIXO + "padroes", contratacao: (id) => PREFIXO + "contratacao." + id };

  function erro(codigo, mensagem, extra) {
    const e = new Error(mensagem);
    e.codigo = codigo;
    Object.assign(e, extra || {});
    return e;
  }
  function ler(chave, padrao) {
    try {
      const t = root.localStorage.getItem(chave);
      return t == null ? padrao : JSON.parse(t);
    } catch (_) {
      return padrao;
    }
  }
  function gravar(chave, valor) {
    try {
      root.localStorage.setItem(chave, JSON.stringify(valor));
    } catch (e) {
      throw erro("ARMAZENAMENTO", "O navegador recusou a gravação (armazenamento cheio ou bloqueado).", { causa: e });
    }
  }
  function resumo(e) {
    const st = {};
    R.ORDEM.forEach((a) => (st[a] = e.artefatos[a].status));
    return { id: e.id, objeto: e.objeto, processoSei: e.processoSei, etapaAtual: e.etapaAtual, status: st, revisao: e.revisao, atualizadoEm: e.atualizadoEm };
  }

  const S = {
    PREFIXO,
    disponivel() {
      try {
        const k = PREFIXO + "teste";
        root.localStorage.setItem(k, "1");
        root.localStorage.removeItem(k);
        return true;
      } catch (_) {
        return false;
      }
    },
    indice() {
      return ler(K.indice, []).slice().sort((a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));
    },
    carregar(id) {
      const e = ler(K.contratacao(id), null);
      if (!e) throw erro("NAO_ENCONTRADO", `Contratação ${id} não encontrada neste navegador.`);
      return e;
    },
    existe(id) {
      return ler(K.contratacao(id), null) != null;
    },
    revisaoGravada(id) {
      const e = ler(K.contratacao(id), null);
      return e ? e.revisao : null;
    },
    /* Grava o estado. "revisaoLida" é a revisão que a tela tinha carregado; "forcar" ignora o conflito. */
    salvar(estado, revisaoLida, forcar) {
      const gravada = S.revisaoGravada(estado.id);
      if (gravada != null && gravada !== revisaoLida && !forcar) {
        throw erro("CONFLITO", "Esta contratação foi gravada por outra aba ou janela depois que você a abriu.", { revisaoGravada: gravada });
      }
      const novo = U.clone(estado);
      novo.revisao = Math.max(gravada || 0, revisaoLida || 0) + 1;
      novo.atualizadoEm = U.agoraISO();
      novo.objeto = novo.identificacao.campos.objeto || novo.objeto || "";
      novo.processoSei = novo.identificacao.campos.processo_sei || "";
      gravar(K.contratacao(novo.id), novo);
      const ind = ler(K.indice, []).filter((c) => c.id !== novo.id);
      ind.push(resumo(novo));
      gravar(K.indice, ind);
      return { revisao: novo.revisao, atualizadoEm: novo.atualizadoEm };
    },
    excluir(id) {
      try {
        root.localStorage.removeItem(K.contratacao(id));
      } catch (_) {}
      gravar(K.indice, ler(K.indice, []).filter((c) => c.id !== id));
    },
    usuario() {
      return ler(K.usuario, "");
    },
    definirUsuario(nome) {
      gravar(K.usuario, String(nome || "").trim());
    },
    /* Últimos valores de identificação usados neste navegador, para pré-preencher a próxima contratação. */
    padroes() {
      return ler(K.padroes, null);
    },
    definirPadroes(p) {
      gravar(K.padroes, p);
    },
    /* Texto do arquivo estado.json. */
    exportar(estado) {
      return JSON.stringify(estado, null, 2);
    },
    /* Lê o texto de um estado.json e confere a estrutura. Lança VALIDACAO se não servir. */
    lerArquivo(texto) {
      let e;
      try {
        e = JSON.parse(texto);
      } catch (_) {
        throw erro("VALIDACAO", "O arquivo não é um JSON válido.");
      }
      const prob = R.verificarEstado(e);
      if (prob.length) throw erro("VALIDACAO", "O arquivo não é um estado do PCA íntegro.", { problemas: prob });
      return e;
    },
    /* Grava um estado importado. Se "novoId" vier, importa como cópia com outro identificador. */
    importar(estado, quem, novoId) {
      const e = U.clone(estado);
      if (novoId) e.id = novoId;
      R.registrar(e, quem, "importou", "contratacao", novoId ? { idOriginal: estado.id } : null);
      return S.salvar(e, e.revisao, true);
    }
  };

  P.store = S;
})(typeof window !== "undefined" ? window : globalThis);
