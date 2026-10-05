# Zipshop

Loja online (HTML + JS puro, Supabase, Netlify). Arquivos SQL e notas internas ficam em `_interno/`.

## Ao começar cada sessão

Antes de qualquer outra coisa, leia `_interno/PDV-CHECKLIST.md` e mostre ao usuário um
resumo curto: quantos itens estão prontos, em parte e faltando em cada seção, e qual é o
próximo passo da "Ordem sugerida". Ao terminar algo da lista, marque o item no arquivo.

## Combinados

- Responder em português, de forma simples (o dono não é programador).
- Jeito de trabalhar em funcionalidades novas: (1) primeiro só analisar o pedido e o código,
  sem mudar nada; (2) mostrar os defeitos, riscos e dúvidas encontrados; (3) só implementar
  depois do OK do dono; (4) só publicar (merge na main / Netlify) quando ele pedir.
- Cargos: admin (tudo), gerente (único que edita produtos/preço/estoque), operador de caixa (só vende).
  Regras de permissão devem ficar no banco (RLS / funções), não só na tela.
