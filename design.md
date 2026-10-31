# Cardápio Online — Design

## Direção aprovada
Referência gastronômica editorial: creme #fff7eb, vermelho tomate #c82d2f, amarelo #ffd33d, tinta #392322. Títulos Barlow Condensed 800 em caixa alta; corpo Poppins. Grande fotografia de hambúrguer recortado, hero assimétrico com título à esquerda e prévia de cardápio à direita, faixas vermelhas e CTAs amarelos. Espaço vertical de 80–110px, largura máxima 1240px, margens 6vw. Textura pontilhada discreta. Não copiar conteúdo da referência. Não usar depoimentos, estatísticas ou promessas comerciais inventadas.
Painéis com sidebar creme/vermelha, tabelas reais, filtros, feedback inline. Mobile com hero empilhado, navegação reduzida e carrinho fixo. Botões de pelo menos 44px, inputs rotulados, estados de carregamento, confirmação de exclusão. Galeria fotográfica real; 3D somente com modelos enviados. Demonstrações sempre identificadas.

## Escopo
Web responsiva: landing de conversão, login/cadastro, /dono e subrotas, /painel e subrotas, /loja/:slug e acompanhamento. Banco Turso/Drizzle, autenticação Better Auth, oRPC tipado, isolamento servidor por empresa. Cobrança manual transparente.

## Aplicação

- Landing: headline condensada, fotografia recortada, mockup funcional, demonstração, recursos, planos do banco e FAQ. Sem provas sociais inventadas.
- Login: composição editorial em duas colunas; formulário isolado em tela pequena.
- Painéis: sidebar persistente em desktop, gaveta em celular, dados reais, tabelas com rolagem local, CTAs vermelhos e mensagens de erro explícitas.
- Cardápio: capa, informações da loja, busca, categorias, fotos de produtos, modal acessível, carrinho fixo e checkout com total visível.
- Acompanhamento: status e linha do tempo, link privado e sem exposição de dados pessoais.

Tokens em `packages/web/src/web/styles.css`; ativos em `packages/web/public/images`. Tipografia e cores consistentes entre landing, autenticação e painéis. Telas adaptadas e verificadas em 390px e 1440px. 3D e rotas de gestão carregam sob demanda.
