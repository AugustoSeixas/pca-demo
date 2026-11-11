# Bibliotecas e fontes de terceiros

Os arquivos desta pasta são cópias sem alteração dos pacotes publicados no npm, com versão fixa. Ficam no repositório para que a aplicação não dependa de CDN (a rede do Tribunal pode bloquear) e para que a versão não mude sem registro.

| Arquivo | Pacote e versão | Origem no pacote | Licença | SHA-256 |
| :-- | :-- | :-- | :-- | :-- |
| `docxtemplater-3.71.1.min.js` | docxtemplater 3.71.1 | `build/docxtemplater.min.js` | MIT ou GPL-3.0 (usada: MIT) | `b38b981e7d707c35f9c19c757006961bb4284d7fd6fdce05bb4b9ce072aa3475` |
| `pizzip-3.3.0.min.js` | pizzip 3.3.0 (inclui pako 2.1.0, MIT e Zlib) | `dist/pizzip.min.js` | MIT ou GPL-3.0 (usada: MIT) | `9b3239fb8976b004a7bfd327ffe59305344a5cc0273b33328076d0a00ff33efc` |
| `fonts/public-sans-latin-*.woff2` | @fontsource/public-sans 5.3.0 | `files/` | SIL OFL 1.1 | — |
| `fonts/source-serif-4-latin-*.woff2` | @fontsource/source-serif-4 5.3.1 | `files/` | SIL OFL 1.1 | — |
| `fonts/ibm-plex-mono-latin-*.woff2` | @fontsource/ibm-plex-mono 5.3.0 | `files/` | SIL OFL 1.1 | — |

Os textos das licenças, como vieram nos pacotes, estão em `licencas/`.

- docxtemplater: https://github.com/open-xml-templating/docxtemplater
- pizzip: https://github.com/open-xml-templating/pizzip
- Fontsource: https://github.com/fontsource/font-files

Para atualizar uma biblioteca: baixar a nova versão do npm, copiar o arquivo com o número da versão no nome, ajustar as duas páginas que a carregam (`index.html` e `sonda.html`), atualizar esta tabela e rodar os testes de `tests/`.

O modelo `modelos/DFD.docx` é gerado por `tools/gerar-modelo-dfd.js` com o pacote `docx` (MIT), que não é distribuído com a aplicação.
