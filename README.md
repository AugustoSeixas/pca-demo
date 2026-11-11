# PCA — Planejamento de Contratações Assistido

Assistente para a fase de planejamento das contratações de materiais do TRT da 17ª Região, conforme a Lei nº 14.133/2021. Percorre quatro documentos, nesta ordem: DFD, ETP, Termo de Referência e Mapa de Riscos.

Este repositório tem duas coisas diferentes:

| O quê | Onde | Endereço |
| :-- | :-- | :-- |
| **Demonstração** roteirizada, aprovada em 23/10/2026 (não grava nada, não usa IA) | `demo/` | https://augustoseixas.github.io/pca-demo/ |
| **Protótipo funcional**, em construção para 30/11/2026 | `app/` | https://augustoseixas.github.io/pca-demo/app/ |

Nenhum dos dois é sistema em produção nem documento oficial do Tribunal. Use apenas o caso anonimizado ou dados públicos.

## Protótipo (`app/`)

Página estática, sem servidor e sem etapa de compilação. Os dados ficam no navegador de quem usa (`localStorage`) e no arquivo `estado.json`, que pode ser exportado e importado em outro computador. Os documentos `.docx` são gerados no próprio navegador a partir de modelos Word.

Situação por entrega: ver `docs/entregas/`. Na entrega E1 (11/11/2026) estão prontos a identificação da contratação, o DFD completo com `DFD.docx`, a gravação e a retomada, e a página de sondagem técnica. ETP, TR e Mapa de Riscos aparecem com os campos previstos e entram nas entregas E2 e E3.

```
app/
  index.html            aplicação
  sonda.html            sondagem técnica: rede, PNCP, Groq e Gemini
  schemas/              um schema JSON por documento, mais identificação e cadastros
  modelos/              modelos Word com marcadores (DFD.docx)
  casos/                caso de referência anonimizado (baterias, 2025)
  js/                   pca-util (formatos) · pca-regras (RN-01 a RN-11) · pca-store (gravação)
                        pca-motor (formulários a partir do schema) · pca-docx (.docx) · pca-app (telas)
  css/, vendor/         estilos; bibliotecas e fontes copiadas, com versão fixa (vendor/LICENCAS.md)
tools/                  gerador do modelo Word do DFD
tests/                  testes de unidade e de ponta a ponta
docs/                   especificação funcional v2, Anexo 1 e registro das entregas
```

Conteúdo é configuração: mudar um campo ou um texto fixo é alterar o schema ou o modelo Word, sem mexer em código. Cada campo tem uma classe, mostrada na tela: FIXO (texto do modelo, não editável), HERDADO (vem de um documento anterior, somente leitura), USUÁRIO, BUSCA (valor com fonte, URL e data) e REDIGIDO (síntese sugerida por IA, sem fato novo).

### Rodar localmente

A aplicação lê schemas e modelos por HTTP; aberta direto do disco, não carrega.

```
python3 -m http.server 8765 --bind 127.0.0.1
# abrir http://127.0.0.1:8765/app/
```

### Testes

```
node --test tests/unidade.test.js                             # regras, schemas e gravação; sem dependências
NODE_PATH=$(npm root -g) node tests/navegador.test.js         # ponta a ponta; requer playwright, Chrome e o servidor acima
```

### Regenerar o modelo Word do DFD

```
NODE_PATH=$(npm root -g) node tools/gerar-modelo-dfd.js       # requer o pacote docx
```

Depois que o modelo for revisado no Word pelo coordenador, o arquivo `.docx` passa a ser a fonte e o gerador deixa de ser usado.

## Demonstração (`demo/`)

Percorre os quatro documentos com o caso real de uma aquisição de 2025 (baterias para os nobreaks do Datacenter e da automação predial), com checkpoint humano entre ETP e TR, painel de validação cruzada e exportação do DFD em `.docx`. Valores, quantidades, prazos e datas são do processo real; nomes de servidores e o número do processo foram omitidos. Não usa IA ao vivo nem acessa a internet: as telas de BUSCA mostram o resultado da pesquisa feita no processo real. Carrega fontes do Google Fonts e a biblioteca `docx` (8.5.0) do jsDelivr, portanto precisa de internet.

## Documentos

- `docs/pca-especificacao-funcional-v2.md` — especificação funcional, revisão v2 (dicionário de campos).
- `docs/ANEXO 1 - SCHEMA DE DADOS - ETP TR e Mapa de Riscos (v2 corrigida).docx` — schema de dados, revisão v2.
- `docs/entregas/` — o que cada entrega do protótipo contém, o que foi verificado e o que ficou pendente.

Fundamentos legais usados pelos schemas: Decreto nº 10.947/2022, art. 8º (DFD); Lei nº 14.133/2021, art. 18, §§ 1º e 2º (ETP), art. 6º, XXIII, e art. 40, § 1º (TR). As fontes consultadas constam de cada documento.
