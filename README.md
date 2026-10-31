# Cardápio Online

SaaS web responsivo de cardápios digitais, com gestão multiempresa, pedidos, QR Code e assinaturas administradas manualmente. Interface em português, valores em reais e identidade gastronômica creme/vermelho/amarelo.

## Acesso e primeiros passos

| Rota | Uso |
|---|---|
| `/` | Apresentação, recursos e planos cadastrados |
| `/loja/burger-da-casa` | Demonstração identificada, sem preparo ou cobrança real |
| `/cadastro` → `/configurar` | Criar conta e estabelecimento; escolher plano e exemplos opcionais |
| `/login` | Entrar como empresário ou proprietário |
| `/dono` | Empresas, planos, assinaturas, pagamentos manuais, relatórios e configurações |
| `/painel` | Produtos, categorias, pedidos, loja, relatórios e assinatura |
| `/loja/:slug` | Cardápio público, busca, galeria, carrinho e checkout |
| `/pedido/:token` | Acompanhamento privado por link aleatório |
| `/recuperar?token=…` | Recuperação por link privado, válido por 30 minutos e de uso único |

**Proprietário:** `brandonazevedo87@gmail.com`. A senha inicial é a fornecida no formulário seguro. O primeiro acesso exige uma nova senha antes de liberar o painel. A senha não aparece no código, na documentação nem na interface. O cadastro público não pode usar esse e-mail. Reiniciar o servidor não redefine a senha de uma conta existente.

**Empresário:** crie uma conta ou cadastre-o em `/dono/empresas`. Contas criadas pelo proprietário recebem senha provisória com troca obrigatória. Cada empresa tem um único empresário nesta versão; não há equipe multiusuário.

## Operação

1. Configure nome, logo, capa, WhatsApp, endereço, horários, entrega/retirada e pagamentos em **Minha loja**.
2. Revise ou exclua os produtos demonstrativos. Cadastre categorias, fotos, ingredientes, estoque, tamanhos/sabores e adicionais.
3. Compartilhe o link ou baixe o QR Code do cardápio.
4. Receba pedidos em **Pedidos**. O painel consulta atualizações a cada 10 segundos; o aviso sonoro depende de ativação pelo usuário e de o painel estar aberto.
5. Avance por recebido → confirmado → em preparação → pronto/saiu para entrega → concluído. Cancelamento devolve o estoque; pedido concluído ou cancelado não pode ser reaberto.

Preços e taxa de entrega são recalculados no servidor. Tamanhos/sabores substituem o preço base; adicionais são somados. O servidor valida disponibilidade, opções, mínimo e estoque em transação. Histórico preserva os nomes e preços do momento da compra, mesmo após exclusão de produtos.

## Planos e cobrança manual

Planos iniciais: Inicial R$ 49,90/mês; Profissional R$ 89,90/mês; Premium R$ 149,90/mês. Todos começam com 7 dias de teste. Os valores e limites são editáveis pelo proprietário. Alterar o preço de um plano não altera automaticamente o preço acordado em assinaturas existentes.

- Registre somente pagamentos de assinatura realmente verificados em **Assinaturas**.
- Atualize separadamente vencimento, preço e status da assinatura. Registrar pagamento não renova automaticamente uma assinatura.
- Configure contato e instruções de cobrança em `/dono/configuracoes`.
- Empresas suspensas, canceladas ou vencidas têm operações bloqueadas. O proprietário pode manter o cardápio para consulta, mas não novos pedidos.
- O valor dos pedidos não equivale a receita recebida. Pagamentos dos consumidores são combinados diretamente com a loja e permanecem sem confirmação automática.

**Não há cobrança recorrente integrada, processamento de Pix/cartão, envio automático de e-mail ou aprovação automática de pagamentos.** Essas integrações dependem de provedor, credenciais e regras comerciais ainda não configurados.

## Fotografias, modelos e limites

Upload direto ao Tigris por URL assinada, com prefixo isolado por empresa. JPG, PNG, WebP ou GLB de até 20 MB. O servidor confere tamanho, tipo e assinatura inicial do arquivo. Fotos públicas, até 8 por produto, podem ser enviadas ou referenciadas por URL HTTPS.

3D é opcional, exclusivo do Premium e exige um arquivo GLB real. Nenhuma foto é apresentada como modelo 3D. Visualizador carregado sob demanda; realidade aumentada depende do modelo, navegador e aparelho. AR não foi validada em aparelhos físicos. URLs externas precisam estar acessíveis e, para GLB, permitir carregamento pelo navegador.

Horários e endereço são informativos. Não há bloqueio automático por horário, cálculo de distância ou delimitação geográfica da entrega. A taxa é fixa por loja. Relatórios usam até os 500 pedidos mais recentes; aberturas de cardápio não representam visitantes únicos. Não há notificações push nem aplicação nativa entregue.

## Recuperação de senha

O empresário solicita recuperação ao proprietário por canal externo. Depois de verificar a identidade, o proprietário abre a empresa e gera um link privado. O token é armazenado como hash, expira em 30 minutos, só pode ser usado uma vez e encerra as sessões anteriores. Não compartilhe links de recuperação publicamente.

## Stack e organização

- Bun, Vite, React 19, Wouter, TanStack Query e oRPC tipado.
- Hono, Better Auth e Drizzle com banco Turso persistente.
- Tigris para arquivos; senhas com hash; sessões autenticadas; autorização e isolamento no servidor.
- `packages/web/src/api/routes/`: conta, proprietário, catálogo, pedidos e uploads.
- `packages/web/src/api/database/`: schema do negócio e autenticação.
- `packages/web/src/web/pages/`: landing, autenticação, painéis e cardápio.
- `packages/web/src/web/queries/`: queries/mutations do cliente.
- `packages/web/public/images/`: ativos estáticos; `design.md`: direção visual.

## Executar e verificar

```bash
bun install
bun run dev
# Em outro terminal:
bun run lint
bun run build
bun --env-file=.env test packages/web/tests/integration.test.ts
```

A porta web é definida em `__ports.cjs` (4200 neste projeto); não altere arquivos `__` do template. O endpoint `/api/health` deve responder 200. Publicação e domínio são configurados pela interface da plataforma.

Variáveis ficam exclusivamente no `.env` da raiz: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `BRANDON_ADMIN_PASSWORD`, `WEBSITE_URL`, `RUNABLE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Nunca exponha segredos com prefixo `VITE_`. Ao publicar, confirme que `WEBSITE_URL` corresponde ao endereço final e que o domínio está nas origens confiáveis da autenticação. Rotação de segredos pode encerrar sessões.

Banco: `bun run db:generate` gera migrações; `bun run db:migrate` aplica migrações. `bun run db:push` sincroniza schema em desenvolvimento. A estrutura inicial já foi aplicada ao banco provisionado; faça backup antes de alterações de schema em produção.

## Testes

A suíte usa o servidor local e o mesmo banco provisionado, cria contas/lojas/planos de QA temporários e limpa somente suas próprias fixtures e arquivos ao finalizar. Rode preferencialmente em ambiente de homologação. Não interrompa o processo durante a limpeza. A suíte não troca a senha real do proprietário. Depois da primeira troca, testa a administração com conta temporária isolada.

Requisitos do navegador: Python, Playwright e Chrome (`/usr/bin/google-chrome`, ou `CHROME_PATH`). O teste cobre autenticação, primeira troca, bloqueio de acesso sem sessão, isolamento entre lojas, limites de planos/templates, upload, preços calculados no servidor, estoque, transições, cancelamento, suspensão, vencimento, pagamento manual, recuperação de uso único e revogação de sessões. A parte visual cobre desktop/celular, checkout, acompanhamento, login, CRUD, QR Code e navegação dos painéis. Capturas ficam em `tests/screenshots/`.

É uma suíte integrada de fluxo principal, não auditoria completa de segurança ou teste de carga. Os limites de autenticação podem exigir um intervalo entre execuções muito próximas.

Para testar no endereço HTTPS real da prévia, defina `QA_TEST_ORIGIN` antes do comando de testes. A suíte também foi executada com sucesso nesse endereço, incluindo ambos os tipos de acesso. `WEBSITE_URL` é normalizada para sua origem (sem barra final); a prévia E2B atual está autorizada explicitamente em `src/api/auth.ts`. Ao trocar o endereço da prévia ou configurar domínio próprio, mantenha a lista de origens atualizada. Não utilize `RUNABLE_URL` como origem de login.
