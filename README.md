# PCA — Planejamento de Contratações Assistido (demonstração)

Protótipo navegável do PCA, assistente para a fase de planejamento das contratações de materiais do TRT da 17ª Região, conforme a Lei nº 14.133/2021.

A demonstração percorre os quatro documentos do planejamento com o caso real de uma aquisição de 2025 (baterias para os nobreaks do Datacenter e da automação predial):

1. **DFD** — 8 incisos do art. 8º do Decreto nº 10.947/2022; o documento só é concluído com todos.
2. **ETP** — 13 incisos do art. 18, §1º da Lei nº 14.133/2021, com modo completo e simplificado (§2º).
3. **Checkpoint humano** — o TR só é liberado após aprovação do ETP.
4. **TR** — art. 6º, XXIII e art. 40, §1º, com painel de validação cruzada.
5. **Mapa de Risco** — por fase, na estrutura do modelo EP 3.01 (probabilidade × impacto).
6. **Saída** — exportação do DFD em .docx.

## Procedência dos dados

- Valores, quantidades, prazos e datas são do processo real de 2025.
- Nomes de servidores e o número do processo foram omitidos.
- Cada campo indica o tipo (FIXO, HERDADO, USUÁRIO, BUSCA) e a procedência: dado real, simulado, ilustrativo, pendente ou parcial.
- A demonstração não usa IA ao vivo nem acessa a internet. As telas de BUSCA mostram o resultado da pesquisa feita no processo real.

## Como abrir

- **Online:** https://augustoseixas.github.io/pca-demo/ (GitHub Pages).
- **Local:** abra `demo/demonstracao-pca.html` em um navegador.

A página carrega fontes do Google Fonts e a biblioteca `docx` (8.5.0) do jsDelivr; precisa de internet.

O botão **Baixar .docx** (tela Saída) gera o DFD no próprio navegador. No GitHub Pages ou aberto localmente, o download é direto; dentro do claude.ai, usa o recurso de download do claude.ai, que pede confirmação.

## Documentos

- `docs/pca-especificacao-funcional-v2.md` — especificação funcional, revisão v2.
- `docs/ANEXO 1 - SCHEMA DE DADOS - ETP TR e Mapa de Riscos (v2 corrigida).docx` — schema de dados, revisão v2.

A revisão v2 corrige a numeração dos incisos do ETP, completa os incisos do DFD e reposiciona campos do TR. As fontes legais constam de cada documento.

## Aviso

Demonstração com dados de uma contratação pública do TRT-17, anonimizados. Não é sistema em produção nem documento oficial do Tribunal.
