/* PCA — utilidades sem dependência de tela. Funciona no navegador e no Node (testes). */
(function (root) {
  "use strict";
  const P = (root.PCA = root.PCA || {});

  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDec = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtNum = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

  const U = {
    esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    },
    clone(o) {
      return o === undefined ? undefined : JSON.parse(JSON.stringify(o));
    },
    /* Lê "a.b.c" em um objeto; devolve undefined se o caminho não existir. */
    obter(obj, caminho) {
      return String(caminho).split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
    },
    /* Data e hora locais em ISO 8601 com deslocamento (ex.: 2026-11-12T14:32:00-03:00). */
    agoraISO(d) {
      d = d || new Date();
      const p = (n) => String(n).padStart(2, "0");
      const off = -d.getTimezoneOffset();
      const sinal = off >= 0 ? "+" : "-";
      const a = Math.abs(off);
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sinal}${p(Math.floor(a / 60))}:${p(a % 60)}`;
    },
    /* "2025-07-31" -> "31/07/2025". Não usa Date, para não sofrer com fuso. */
    dataBR(iso) {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
      return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
    },
    /* "2025-07-31" -> "31 de julho de 2025". */
    dataExtenso(iso) {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
      return m ? `${+m[3] === 1 ? "1º" : +m[3]} de ${MESES[+m[2] - 1]} de ${m[1]}` : "";
    },
    dataHoraBR(iso) {
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || "");
      return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : "";
    },
    horaBR(iso) {
      const m = /T(\d{2}):(\d{2})/.exec(iso || "");
      return m ? `${m[1]}:${m[2]}` : "";
    },
    moeda(n) {
      return typeof n === "number" && isFinite(n) ? fmtMoeda.format(n).replace(/ /g, " ") : "";
    },
    decimal(n) {
      return typeof n === "number" && isFinite(n) ? fmtDec.format(n) : "";
    },
    numero(n) {
      return typeof n === "number" && isFinite(n) ? fmtNum.format(n) : "";
    },
    /* Converte texto digitado em número. Aceita "110.000,50", "110000,5", "110000.5" e "R$ 1.234,00".
       Devolve null se vazio e NaN se não for número. */
    lerNumero(txt) {
      let s = String(txt == null ? "" : txt).replace(/[R$\s ]/g, "");
      if (s === "") return null;
      if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
      else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
      return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
    },
    /* Quebra um texto longo em parágrafos (linhas não vazias). */
    paragrafos(txt) {
      return String(txt == null ? "" : txt).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    },
    /* "Não há vinculação" -> "nao_ha_vinculacao": usado para gerar marcadores condicionais. */
    slug(txt) {
      return String(txt).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    },
    urlValida(u) {
      return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(String(u || "").trim());
    },
    r2(n) {
      return Math.round((n + Number.EPSILON) * 100) / 100;
    }
  };

  P.util = U;
  if (typeof module !== "undefined" && module.exports) module.exports = P;
})(typeof window !== "undefined" ? window : globalThis);
