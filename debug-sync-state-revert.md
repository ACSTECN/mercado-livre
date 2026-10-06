[OPEN] Debug session: sync-state-revert

## Symptômes (pt-BR, usuário)
1. Apagar pacote / apagar saca → volta em seguida (polling 6s ou ação)
2. Alterar status / atribuir entregador → volta em seguida
3. Qualquer ação do usuário NÃO é definitiva. Visualização fica mudando de volta sozinha.

## Window de regressão
Commit mais recente: `0e03441` (ontem 5/10/2026 14:52)
Mudanças na 0e03441 que potencialmente causam:
A) `src/services/packages/PacoteService.ts#L539-L560`
→ adicionei `mesclarPreservandoNaoSincronizadosLocal(doBanco, locais) DENTRO do PacoteService.listarTodasSacas
→ ANTES: listarTodasSacas = BANCO PURO + locais inexistentes no banco
→ DEPOIS listarTodasSacas mescla preservando locais sincronizados=false
→ E a store.carregar() de novo MESCLA DE NOVO com get().pacotes
→ DUPLA MESCLAGEM, resultando em LOCAL sempre GANHA SEMPRE, mesmos que usuário deu update no banco e marcou sincronizado=true, mas os get().pacotes ainda tem o estado ANTIGO quando dá sync com bug?

B) `src/stores/pacoteStore.ts#L707-L780: definirEntregadorEmLote mudou para PacoteService.mover direto. Mas aparentemente OK. Mas o IIFE `void` pode ter problemas de corrida.

## 5 Hipóteses Falsificáveis

H1 (mais provavel). DUPLA MESCLAGEM:
- PacoteService.listarTodasSacas retorna lista mesclado
- Store.carregar(pacotes) -> MESCLA de novo com estado anterior `mesclarPreservandoNaoSincronizados(lista, get().pacotes)`
- Resultado: get().pacotes (estado antigo local NÃO sincronizado) SEMPRE GANHA, sobrescrevendo bancário dado
- Isso explica QUALQUER alteração do usuário VOLTAR, pois get().pacotes tem o estado antigo de quando foi carregado primeiro.

H2). Bug SacaService.excluir não deleta no banco Supabase. Então polling carregarSacas volta com a saca.

H3). `mesclarPreservandoNaoSincronizadosLocal em PacoteService tá rodando ANTES de adicionar o 2o loop de locais que não existem no banco. Então se banco tem novo dado que usuário excluiu.

H4). Quando chama `remover(id)` / `excluirSaca(id)`: deleta no LOCAL e BANCO, mas o próximo polling carrega do banco, retorna os dados DE NOVO se o delete falhou.

H5). Race no polling 6s `carregarSacas + carregar rodando paralelo ao mesmo tempo que ações do usuário (tipo user deleta e roda o carregar deleta no banco e depois carregar puxa do banco que ainda não atualizou?

## Instrumentation
TODO: adicionar logs em pontos de merge, ações de remover/excluir/sal.
