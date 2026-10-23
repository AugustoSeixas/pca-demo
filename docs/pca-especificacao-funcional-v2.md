# ESPECIFICAÇÃO TÉCNICA E FUNCIONAL: PROJETO PCA (Planejamento de Contratações Assistido)
**Dicionário de Campos e Fluxo de Dados Inteligente (DFD, ETP, TR e Mapa de Risco)**
**Tribunal Regional do Trabalho da 17ª Região (TRT-ES) — Versão 1: Aquisição de Materiais**
**Revisão v2 — 23/10/2026 (corrige numeração do ETP, completa o DFD e reposiciona campos do TR)**

---

## 0. REGISTRO DE ALTERAÇÕES (v2)

| # | Seção | Alteração | Fundamento verificado |
| :-- | :-- | :-- | :-- |
| 1 | DFD | Incluídos os campos dos incisos III (quantidade), IV (estimativa preliminar do valor) e VII (vinculação com outro DFD); campos mapeados aos 8 incisos | Decreto nº 10.947/2022, art. 8º |
| 2 | ETP | Estrutura passa de 11 para os 13 incisos do art. 18, §1º: IV e V trocados; IX e X incluídos; XI, XII e XIII renumerados | Lei nº 14.133/2021, art. 18, §1º |
| 3 | ETP | Modo simplificado: mínimo dos incisos I, IV, VI, VIII e XIII | Lei nº 14.133/2021, art. 18, §2º |
| 4 | TR | Especificação do produto sai da alínea i) e passa ao art. 40, §1º, I; alínea i) fica só com as estimativas do valor; incluídos art. 40, §1º, II e III | Lei nº 14.133/2021, art. 6º, XXIII, e art. 40, §1º |
| 5 | TR | Habilitação jurídica: art. 66; habilitações fiscal, social e trabalhista: art. 68 | Lei nº 14.133/2021, arts. 66 e 68 |
| 6 | TR | Local e horário de entrega: a versão 1 indica Almoxarifado, 12h–18h; o TR real das baterias (2025) indica Edifício Sede, 12h–19h. **A confirmar com o coordenador** | Divergência entre fonte do projeto e processo real |

As marcações numéricas entre colchetes nas linhas não alteradas vêm da versão 1 e foram mantidas. Linhas novas ou alteradas não trazem essas marcações.

---

## 1. INTRODUÇÃO E MODELO DE DADOS

Para que o assistente inteligente **PCA** opere com consistência e sem redundâncias, todo o fluxo documental foi mapeado sob uma arquitetura de dados unificada [607, 622]. O sistema transita os dados entre quatro estados de origem operacional, denominados de **Tipos PCA** [625]:

1. **`FIXO`**: Dados institucionais, legislações de referência, modelos de cláusulas (*boilerplates*) e fluxos procedimentais imutáveis do TRT-17 [625, 626].
2. **`HERDADO`**: Informações geradas em etapas anteriores do processo ou extraídas diretamente de sistemas integrados (ex: Sistema Eletrônico de Informações - SEI) [607, 625, 626].
3. **`USUÁRIO`**: Entradas manuais e decisões discricionárias que exigem a interação direta do servidor responsável pelo planejamento [625, 626].
4. **`BUSCA`**: Campos preenchidos de forma automatizada por meio de motores de busca e processamento da Inteligência Artificial (varredura de mercado, catálogos técnicos e cascata de preços) [614, 615, 625, 626].

---

## 2. MAPA DE CAMPOS: DOCUMENTO DE FORMALIZAÇÃO DA DEMANDA (DFD)

O DFD é a peça inicial que oficializa a necessidade de contratação [679, 685]. Por não envolver buscas externas, é o piloto ideal para a validação do modelo de dados [625]. Os campos seguem os 8 incisos do art. 8º do Decreto nº 10.947/2022; o DFD não é concluído sem todos eles.

| Seção / Campo do DFD | Tipo PCA | Origem / Regra de Negócio no Backend e UI | Comportamento do Assistente de IA |
| :--- | :---: | :--- | :--- |
| **Cabeçalho Institucional** | `FIXO` | Identificação padrão: "Poder Judiciário - TRT 17ª Região - SIMS" [1, 155, 626, 638]. | Renderizado automaticamente no topo da página [1, 155, 626]. |
| **Ano / Local de Exercício** | `FIXO` | Padrão: "Vitória/ES" + Ano corrente automático [1, 155, 159, 626, 638]. | Bloqueado para edição [626]. |
| **I – Justificativa da necessidade** | `USUÁRIO` | Input manual e descritivo do problema prático do TRT-17 [1, 155, 159, 626, 638, 679]. | O servidor relata a necessidade. A IA pode sugerir a redação das consequências da não contratação, se solicitada [626, 638]. |
| **II – Descrição sucinta do objeto** | `USUÁRIO` | Inserção textual do servidor no início do fluxo [626, 638]. | Campo de texto livre (ex: "Baterias para Nobreaks") [155, 159, 163, 197]. |
| **III – Quantidade a ser contratada** | `USUÁRIO` | Quantidade estimada, considerando a expectativa de consumo anual, quando aplicável. | Obrigatório. O DFD não é concluído sem este campo. |
| **IV – Estimativa preliminar do valor** | `USUÁRIO` | Estimativa por procedimento simplificado. Não aciona busca externa no DFD. | Obrigatório. O valor definitivo é apurado no ETP (inciso VI) e no TR (alínea i). |
| **V – Data pretendida para a conclusão** | `USUÁRIO` | Data em que a contratação deve estar concluída. | Obrigatório. |
| **VI – Grau de prioridade** | `USUÁRIO` | Seleção: **Alto / Médio / Baixo** [160, 626, 638]. | Se "Alto", o sistema exige justificativa de criticidade [159, 160]. |
| **VII – Vinculação ou dependência com outro DFD** | `USUÁRIO` | Indicação de dependência com objeto de outro DFD, para definir a ordem das contratações. | Obrigatório (admite "não há"). Contratos vigentes relacionados são tratados no ETP, inciso XI. |
| **VIII – Área requisitante e responsável** | `HERDADO` | Unidade puxada do login do servidor ou do processo no SEI; responsável designado [607, 626, 638]. | Auto-preenchido; busca a identificação formal do servidor na base interna [158, 160, 242]. |
| **Declaração de ausência de sobreposição** | `FIXO` | Parágrafo atestando conformidade, ausência de sobreposição de objetos e solicitação de abertura de projeto [2, 156, 161, 626, 638]. | Texto institucional fixo [156, 161, 626, 638]. |
| **Aprovação da Demanda** | `FIXO` | Parágrafo padrão de autorização assinado pela chefia da SIMS [3, 157, 161, 626, 638]. | Texto imutável [3, 157, 161, 626, 638]. |
| **Assinaturas Autorizadoras** | `HERDADO` | Cadastro das autoridades vigentes da SIMS [4, 158, 162, 626, 638]. | Gera o bloco de assinatura eletrônica do SEI [158, 162, 626, 638]. |

---

## 3. MAPA DE CAMPOS: ESTUDO TÉCNICO PRELIMINAR (ETP)

O ETP materializa a primeira busca externa da IA (levantamento de mercado) e a primeira estimativa de valores [628, 640]. Sua estrutura segue os **13 incisos do art. 18, §1º da Lei nº 14.133/2021**, na ordem da lei. No **modo simplificado** (art. 18, §2º), o ETP contém no mínimo os incisos **I, IV, VI, VIII e XIII**; a ausência dos demais exige justificativa.

| Campo ou Inciso do ETP | Tipo PCA | Origem / Regra de Negócio no Backend | Comportamento e Algoritmo da IA |
| :--- | :---: | :--- | :--- |
| **Identificação do Processo** | `HERDADO` | Puxado do SEI e do DFD ativo [607, 627, 639]. | Insere no cabeçalho: Número do Processo SEI, Unidade Requisitante e Responsável [163, 181, 197]. |
| **I – Descrição da necessidade** | `HERDADO` | Importação direta da justificativa do DFD (inciso I) [607, 628, 640]. | A IA ajusta a redação para o padrão de ETP, se requisitado [607, 628, 640]. |
| **II – Previsão no plano de contratações anual** | `HERDADO` / `FIXO` | Consulta ao plano anual do TRT-17 do exercício [198, 204, 240, 628]. | Se o objeto constar, herda codificação e item; se não, sugere justificativa padrão [183, 198, 240]. |
| **III – Requisitos da contratação** | `FIXO` / `USUÁRIO` | Exigências normativas padronizadas e especificidades do Tribunal [628, 640]. | **Fixo:** ME/EPP (LC nº 123/2006) e regularidade geral [168, 198]. **Usuário:** requisitos específicos (ex: INMETRO, CONAMA nº 401/2008) [190, 221, 233]. |
| **IV – Estimativa das quantidades e memórias de cálculo** | `USUÁRIO` | Entrada numérica do quantitativo pelo servidor; herda a quantidade do DFD (inciso III). | A IA propõe a redação da memória de cálculo com base no inventário técnico (ex: "reposição de baterias conforme plano de substituição de 5 anos"). |
| **V – Levantamento de mercado e justificativa da solução** | **`BUSCA`** | **1ª janela de busca externa da IA** [628, 640, 646]. | Varre a web por soluções substitutas ou concorrentes; retorna tabela com alternativas, fontes e referências técnicas [646]. O usuário escolhe a adotada [608, 616]. |
| **VI – Estimativa do valor da contratação** | **`BUSCA`** | Estimativa com preços unitários referenciais e memórias de cálculo [628, 640]. | Busca preços de referência com fonte e data de cada um e sugere o valor que subsidia a viabilidade [628, 640]. |
| **VII – Descrição da solução como um todo** | `USUÁRIO` / `IA` | Baseado na alternativa selecionada no inciso V. | A IA redige a justificativa da alternativa escolhida em relação às descartadas. |
| **VIII – Justificativa do parcelamento ou não** | `FIXO` / `USUÁRIO` | Diretrizes do art. 40 da Lei nº 14.133/2021 [201, 202, 628, 640]. | Se lote único, aciona texto padrão justificando a indivisibilidade técnica [201, 202, 628]. |
| **IX – Demonstrativo dos resultados pretendidos** | `USUÁRIO` | Resultados em termos de economicidade e de melhor aproveitamento dos recursos. | A IA pode sugerir redação a partir do objetivo da contratação. |
| **X – Providências prévias à celebração do contrato** | `USUÁRIO` | Inclui capacitação de servidores para fiscalização e gestão contratual e adequações de ambiente. | A IA lista providências usuais para a classe de objeto; o servidor confirma. |
| **XI – Contratações correlatas e/ou interdependentes** | `USUÁRIO` | Contratos em vigor ou complementares [175, 188, 237, 628, 640]. | Lista contratos vigentes relacionados (ex: contrato de manutenção dos nobreaks) [204, 210, 237]. |
| **XII – Impactos ambientais e medidas mitigadoras** | `FIXO` / `USUÁRIO` | Integração com o Guia de Contratações Sustentáveis da Justiça do Trabalho [20, 228]. | Para material poluente (ex: baterias de chumbo), insere logística reversa e descarte (Decreto nº 10.936/2022) [187, 223, 229, 230]. |
| **XIII – Posicionamento conclusivo sobre a adequação da contratação** | `FIXO` | Declaração de viabilidade técnica e econômica [629, 641]. | Texto padrão para assinatura eletrônica do responsável técnico [242, 629, 641]. |

---

## 4. MAPA DE CAMPOS: TERMO DE REFERÊNCIA (TR)

O TR herda o ETP aprovado. Para compras, contém os elementos do **art. 6º, XXIII** e as informações do **art. 40, §1º** da Lei nº 14.133/2021. A especificação técnica é buscada **exclusivamente em catálogos de fabricantes** [614, 631, 643].

| Campo ou Alínea do TR | Tipo PCA | Origem / Regra de Negócio no Backend | Comportamento e Algoritmo da IA |
| :--- | :---: | :--- | :--- |
| **a) Definição do objeto** | `HERDADO` | Objeto e quantidades do DFD e do ETP [607, 630, 642]. | Formata o objeto, a natureza (bem comum), o prazo do contrato e a possibilidade de prorrogação. |
| **b) Fundamentação da contratação** | `HERDADO` | Remissão ao ETP da mesma instância [607, 630, 642]. | Insere o número do processo SEI e o ETP de origem [953, 978]. |
| **c) Descrição da solução como um todo (ciclo de vida)** | `HERDADO` | Obrigações ambientais e de logística reversa do ETP [630, 642]. | Mantém as regras do Guia de Contratações Sustentáveis [223, 230, 1006]. |
| **d) Requisitos da contratação** | `FIXO` | Habilitação jurídica (art. 66) e habilitações fiscal, social e trabalhista (art. 68). | Insere as certidões (Fazenda Nacional, FGTS, Fazenda Estadual, CNDT) [207, 208, 984, 985]. |
| **e) Modelo de execução do objeto** | `USUÁRIO` / `FIXO` | **Usuário:** prazo e forma de fornecimento (integral ou parcelada) [608, 609, 631, 643]. **Fixo:** local e horário de recebimento — **a confirmar** (ver registro de alterações, item 6). | A IA sugere prazos com base em compras anteriores [609, 610]. |
| **f) Modelo de gestão do contrato** | `FIXO` | Clausulado padrão de recebimento e fiscalização [631, 642]. | Recebimento provisório e definitivo nos prazos padrão do TRT-17 [209, 959, 960, 1007, 1011]. |
| **g) Critérios de medição e pagamento** | `FIXO` | Execução orçamentária integrada [631, 642]. | Faturamento via SIGEO-JT e pagamento em até 30 dias [966, 967, 1013, 1021]. |
| **h) Forma e critérios de seleção do fornecedor** | `FIXO` | Critérios de julgamento [631, 642]. | Pregão eletrônico; menor preço global por lote ou por item [202, 213, 980, 992]. |
| **i) Estimativas do valor da contratação** | **`BUSCA`** | **Pesquisa de preços em cascata** [615, 631, 642]. | 1. PNCP; 2. bancos de preços; 3. lojas especializadas. Mínimo de **5 preços por item**, média, mediana e exibição para aprovação do servidor (*human-in-the-loop*) [615, 616]. |
| **j) Adequação orçamentária** | `HERDADO` | Vínculo com o plano anual e a dotação de origem [198, 631, 642]. | Preenche as chaves de adequação orçamentária do processo [603]. |
| **Art. 40, §1º, I – Especificação do produto** | **`BUSCA`** | **Busca externa restrita a catálogos de fabricantes** [614, 631, 642, 643]. | Bloqueio de e-commerce geral; extração apenas de catálogos técnicos oficiais [614, 631]. |
| **Art. 40, §1º, II – Locais de entrega e regras de recebimento** | `HERDADO` / `FIXO` | Herda as definições das alíneas e) e f). | Sem ação de IA. |
| **Art. 40, §1º, III – Garantia, manutenção e assistência técnica** | `HERDADO` | Herda a garantia definida no ETP (inciso III). | Sem ação de IA. |

---

## 5. MAPA DE CAMPOS: MAPA DE RISCO (ANÁLISE DE RISCO)

Sem alterações em relação à versão 1. O PCA adota a **estruturação por fase** (Planejamento → Seleção/Licitação → Gestão do Contrato), distinta da matriz de riscos contratual [632, 644].

| Campo do Mapa de Risco | Tipo PCA | Origem / Regra de Negócio no Backend | Comportamento e Algoritmo da IA |
| :--- | :---: | :--- | :--- |
| **Identificação** | `HERDADO` | DFD e ETP vigentes [607, 633, 645]. | Auto-preenche o objeto e as unidades envolvidas [603]. |
| **Riscos da Fase 1: Planejamento** | `FIXO` | Riscos comuns da base histórica para a classe de objeto [611, 612]. | Ex.: "estimativa de preços incorreta", "divergência textual entre documentos base" [194, 196]. |
| **Riscos da Fase 2: Licitação (Seleção)** | `FIXO` | Riscos de certame [611, 612]. | Ex.: "ausência de propostas válidas", "desistência do adjudicatário" [604]. |
| **Riscos da Fase 3: Gestão do Contrato** | `FIXO` | Riscos de execução [611, 612]. | Ex.: "atraso logístico na entrega", "descumprimento de critérios de sustentabilidade" [195, 196]. |
| **Cálculo do grau (Probabilidade × Impacto)** | `FIXO` | Grau = P × I, com P de 0,1 a 1,0 e I de 1 a 5 [177, 191, 633, 645]. | Classificação pela legenda do modelo EP 3.01: < 1 insignificante; 1–2 leve; 2–3 médio; 3–4 alto; 4–5 muito alto. |
| **Ações de controle e mitigação** | `FIXO` / `USUÁRIO` | Medidas associadas aos riscos [756, 757]. | A IA preenche contramedidas padrão; o usuário pode alterar ou incluir novas [25, 604, 612, 615]. |
| **Responsável pelo controle** | `HERDADO` | Equipe de planejamento ou fiscais cadastrados [160, 180, 219, 242]. | Atribui o responsável por fase [180, 193, 219, 242, 685]. |

---

## 6. FLUXO DE INTEGRAÇÃO DE DADOS

```
[ PROCESSO SEI / CADASTROS DO TRT-17 ]
        │ (identificação, autoridades, assinaturas)
        ▼
1. DFD — 8 incisos do art. 8º do Decreto nº 10.947/2022 (usuário)
        │ (necessidade, objeto, quantidade herdados)
        ▼
2. ETP — 13 incisos do art. 18, §1º (levantamento de mercado: busca; quantitativos: usuário)
        │
        ▼
   CHECKPOINT HUMANO (aprovação do ETP)
        │ (solução, parâmetros ambientais e valor herdados)
        ▼
3. TR — art. 6º, XXIII + art. 40, §1º (prazos: usuário; especificação: catálogos; preços: cascata)
        │ (objeto e responsáveis herdados)
        ▼
4. MAPA DE RISCO — riscos por fase, P × I, medidas mitigadoras (validação humana)
```

---

**Fontes da revisão v2:** Lei nº 14.133/2021, art. 6º, XXIII; art. 18, §§1º e 2º; art. 40, §1º; arts. 66 e 68. Decreto nº 10.947/2022, art. 8º. Textos consultados em legjur.com.br em 23/10/2026; recomenda-se conferência final no Planalto.

*(Fim da Especificação Funcional do Módulo de Aquisição de Materiais — v2)*
