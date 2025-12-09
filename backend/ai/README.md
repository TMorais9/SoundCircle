# CSP matcher (Python)

Algoritmo em Python (`ai.py`) que usa resolucao de CSP (Constraint Satisfaction Problem) para sugerir musicos de acordo com:
- anos de experiencia pedidos
- instrumento indicado
- localizacao pretendida
- caracteristicas selecionadas (as mesmas do ecrã de conta)

## Como funciona
- Tenta primeiro satisfazer todas as restricoes (instrumento, localizacao, pelo menos 50% das caracteristicas e anos de experiencia >= pedido).
- Se nada corresponder, relaxa as restricoes (proximidade de localizacao, parte das caracteristicas e diferenca de anos aceitavel) e devolve as sugestoes mais proximas em ordem de pontuacao.

## Utilizacao rapida
```bash
python backend/ai/ai.py
```

Ou importa diretamente:
```python
from ai.ai import CSPMatcher, Preferencias

matcher = CSPMatcher(lista_de_musicos)  # ver formato no docstring do modulo
prefs = Preferencias(
    instrumento="Guitarra",
    anos_experiencia=3,
    localizacao="Lisboa",
    caracteristicas=["Pontual", "Criativo", "Rock"],
)
resultado = matcher.resolver(prefs, max_resultados=5)
```

## Integracao com a app
1. Obter os musicos da base de dados (por exemplo, via endpoint existente `/users`) e montar o formato esperado:
   - `instrumentos`: lista de dicts com `nome`, `anos_experiencia`, `nivel`
   - `caracteristicas`: lista de nomes ou ids das tags escolhidas no ecrã de conta
2. Chamar `CSPMatcher.resolver` com as preferencias que o utilizador indicar no chat de AI.
3. Se quiser expor via API, crie um pequeno endpoint em Node que invoque este modulo Python (ex.: `python -m ai.csp_matcher`) e devolva o JSON das sugestoes ao front-end.
