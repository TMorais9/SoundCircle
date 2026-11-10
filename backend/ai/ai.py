# Motor de recomendação do Circle AI.
#
# Este script é chamado pelo backend (aiController.js) uma vez por pedido. Recebe pelo stdin um JSON
# com os músicos, as bandas, o texto que o utilizador escreveu, as características escolhidas nos
# chips, o perfil de quem está a pedir e o contexto da conversa. Devolve pelo stdout as sugestões.
#
# Toda a procura é feita como um CSP (Constraint Satisfaction Problem):
#   1. Primeiro lemos a frase e tiramos dali o pedido (instrumentos, distrito, anos, características).
#   2. Com esse pedido montamos um CSP: variáveis, domínios e restrições.
#   3. Resolvemos o CSP com propagação de restrições (AC-3), backtracking com a heurística MRV e,
#      como queremos as melhores soluções e não só uma qualquer, branch & bound sobre uma função objetivo.
#   4. Se não houver solução nenhuma, relaxamos as restrições aos poucos e voltamos a resolver.
#
# Há três tipos de problema, cada um com o seu modelo:
#   - procurar um músico                -> CSP1Solver (variável principal "musico")
#   - procurar uma banda para integrar  -> BandasExistentesSolver (o mesmo modelo, variável "banda")
#   - formar uma banda                  -> BandCSPSolver (uma variável por cada lugar da banda)
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from itertools import combinations, product
import json
import re
import sys
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple
import unicodedata
import math
from difflib import SequenceMatcher


# =====================================================================================
# Motor genérico de CSP
# Não sabe nada de músicos nem de bandas: só conhece variáveis, domínios e restrições.
# Os solvers mais abaixo é que montam cada problema concreto e chamam este motor.
# =====================================================================================
#
# Uma restrição do CSP: tem um nome (para se perceber o que é quando estamos a depurar), as variáveis
# em que mexe e uma função que recebe os valores dessas variáveis e diz se a combinação é permitida.
# Pode ser unária (1 variável), binária (2) ou de qualquer aridade.
@dataclass
class Restricao:
    nome: str
    variaveis: Tuple[str, ...]
    funcao: Callable[..., bool]


class CSP:
    # dominios: para cada variável, a lista de valores que ainda pode tomar
    # _restricoes_por_variavel: índice para encontrar depressa as restrições de cada variável
    def __init__(self) -> None:
        self.dominios: Dict[str, List[Any]] = {}
        self.restricoes: List[Restricao] = []
        self._restricoes_por_variavel: Dict[str, List[Restricao]] = {}

    # Regista uma variável e o seu domínio inicial.
    def adicionar_variavel(self, nome: str, dominio: Iterable[Any]) -> None:
        self.dominios[nome] = list(dominio)
        self._restricoes_por_variavel.setdefault(nome, [])

    # Regista uma restrição e liga-a a cada uma das variáveis que ela envolve.
    def adicionar_restricao(self, nome: str, variaveis: Tuple[str, ...], funcao: Callable[..., bool]) -> None:
        restricao = Restricao(nome, tuple(variaveis), funcao)
        self.restricoes.append(restricao)
        for var in restricao.variaveis:
            self._restricoes_por_variavel.setdefault(var, []).append(restricao)

    # É o "revise" do AC-3, generalizado para restrições com qualquer número de variáveis (GAC).
    # Para cada valor de `var` procuramos pelo menos uma combinação de valores das outras variáveis
    # da restrição que a satisfaça (um "suporte"). Os valores sem suporte são retirados do domínio.
    # Devolve True se o domínio encolheu.
    def _rever(self, dominios: Dict[str, List[Any]], var: str, restricao: Restricao) -> bool:
        posicao = restricao.variaveis.index(var)
        outras = [dominios[v] for v in restricao.variaveis if v != var]
        suportados = []
        for valor in dominios[var]:
            for combinacao in product(*outras):
                argumentos = list(combinacao)
                argumentos.insert(posicao, valor)
                if restricao.funcao(*argumentos):
                    suportados.append(valor)
                    break
        if len(suportados) == len(dominios[var]):
            return False
        dominios[var] = suportados
        return True

    # Algoritmo AC-3. Mantemos uma fila de pares (variável, restrição) para rever. Sempre que o domínio
    # de uma variável encolhe, as restrições dos vizinhos voltam para a fila, porque esses vizinhos podem
    # ter perdido o suporte que tinham. Se algum domínio ficar vazio, este ramo não tem solução e
    # devolvemos False.
    def _propagar(self, dominios: Dict[str, List[Any]], arcos: Iterable[Tuple[str, Restricao]]) -> bool:
        fila: deque = deque()
        pendentes: set = set()

        # evita meter o mesmo arco duas vezes na fila
        def agendar(var: str, restricao: Restricao) -> None:
            chave = (var, id(restricao))
            if chave not in pendentes:
                pendentes.add(chave)
                fila.append((var, restricao))

        for var, restricao in arcos:
            agendar(var, restricao)

        while fila:
            var, restricao = fila.popleft()
            pendentes.discard((var, id(restricao)))
            if not self._rever(dominios, var, restricao):
                continue
            if not dominios[var]:
                return False
            for outra in self._restricoes_por_variavel[var]:
                if outra is restricao:
                    continue
                for vizinha in outra.variaveis:
                    if vizinha != var:
                        agendar(vizinha, outra)
        return True

    # Heurística MRV (minimum remaining values): escolhemos a variável com menos valores possíveis,
    # porque é a que falha mais depressa se o ramo não tiver saída. Em caso de empate usamos o grau,
    # ou seja, a variável ligada a mais variáveis que ainda não têm valor.
    def _escolher_variavel(self, atribuicao: Dict[str, Any], dominios: Dict[str, List[Any]]) -> str:
        livres = [v for v in dominios if v not in atribuicao]

        def grau(var: str) -> int:
            return sum(
                1
                for r in self._restricoes_por_variavel[var]
                if any(outra != var and outra not in atribuicao for outra in r.variaveis)
            )

        return min(livres, key=lambda v: (len(dominios[v]), -grau(v)))

    # Ponto de entrada da procura. Faz uma primeira propagação com todas as restrições (as unárias também
    # entram na fila, por isso isto já faz a consistência de nó) e depois arranca o backtracking.
    #   ao_encontrar    -> chamada para cada solução completa (se devolver False, a procura pára)
    #   ordenar_valores -> ordem pela qual se experimentam os valores de uma variável
    #   podar           -> permite cortar ramos que já se sabe que não vão dar nada melhor (branch & bound)
    def procurar(
        self,
        ao_encontrar: Callable[[Dict[str, Any]], Optional[bool]],
        ordenar_valores: Optional[Callable[[str, List[Any], Dict[str, Any]], List[Any]]] = None,
        podar: Optional[Callable[[Dict[str, Any], Dict[str, List[Any]]], bool]] = None,
    ) -> None:
        dominios = {var: list(dominio) for var, dominio in self.dominios.items()}
        arcos = [(var, r) for r in self.restricoes for var in r.variaveis]
        if self._propagar(dominios, arcos):
            self._retroceder({}, dominios, ao_encontrar, ordenar_valores, podar)

    # Backtracking recursivo com manutenção de consistência de arco (MAC): escolhe uma variável,
    # experimenta cada valor do domínio, propaga as consequências pelas restrições e só desce na árvore
    # se nenhum domínio ficar vazio.
    def _retroceder(
        self,
        atribuicao: Dict[str, Any],
        dominios: Dict[str, List[Any]],
        ao_encontrar: Callable[[Dict[str, Any]], Optional[bool]],
        ordenar_valores: Optional[Callable[[str, List[Any], Dict[str, Any]], List[Any]]],
        podar: Optional[Callable[[Dict[str, Any], Dict[str, List[Any]]], bool]],
    ) -> bool:
        # se este ramo já não consegue chegar às melhores soluções guardadas, nem vale a pena continuar
        if podar is not None and podar(atribuicao, dominios):
            return True
        # todas as variáveis têm valor: encontrámos uma solução
        if len(atribuicao) == len(dominios):
            return ao_encontrar(dict(atribuicao)) is not False

        var = self._escolher_variavel(atribuicao, dominios)
        valores = ordenar_valores(var, dominios[var], atribuicao) if ordenar_valores else dominios[var]
        for valor in valores:
            # copiamos os domínios para podermos desfazer tudo quando voltarmos atrás
            reduzidos = dict(dominios)
            reduzidos[var] = [valor]
            atribuicao[var] = valor
            # só é preciso rever as restrições que envolvem a variável que acabámos de fixar
            arcos = [(v, r) for r in self._restricoes_por_variavel[var] for v in r.variaveis if v != var]
            continuar = True
            if self._propagar(reduzidos, arcos):
                continuar = self._retroceder(atribuicao, reduzidos, ao_encontrar, ordenar_valores, podar)
            del atribuicao[var]
            if not continuar:
                return False
        return True

    # Consistência de nó: aplica só as restrições unárias e devolve os domínios que sobram.
    # Usamos isto nos diagnósticos, por exemplo para saber que lugares da banda ficaram sem nenhum
    # candidato (domínio vazio) e explicar isso ao utilizador.
    def consistencia_de_no(self) -> Dict[str, List[Any]]:
        dominios = {var: list(dominio) for var, dominio in self.dominios.items()}
        for restricao in self.restricoes:
            if len(restricao.variaveis) == 1:
                var = restricao.variaveis[0]
                dominios[var] = [valor for valor in dominios[var] if restricao.funcao(valor)]
        return dominios

    # Versão de otimização do CSP: em vez de parar na primeira solução, guarda as k melhores segundo a
    # função `objetivo`, usando branch & bound.
    #   limite_superior -> estimativa otimista do melhor valor que ainda se pode obter a partir de uma
    #                      atribuição parcial. Se nem isso chega à pior das k guardadas, o ramo é cortado.
    #   identificar     -> diz quando duas soluções são "a mesma" (por exemplo as mesmas pessoas em
    #                      lugares trocados), para não aparecerem repetidas.
    #   desempate       -> critério extra quando duas soluções têm o mesmo valor.
    def otimizar(
        self,
        objetivo: Callable[[Dict[str, Any]], float],
        k: int,
        limite_superior: Optional[Callable[[Dict[str, Any], Dict[str, List[Any]]], float]] = None,
        ordenar_valores: Optional[Callable[[str, List[Any], Dict[str, Any]], List[Any]]] = None,
        identificar: Optional[Callable[[Dict[str, Any]], Any]] = None,
        desempate: Optional[Callable[[Dict[str, Any]], Any]] = None,
    ) -> List[Tuple[float, Dict[str, Any]]]:
        if k <= 0:
            return []
        melhores: List[Tuple[float, Any, Any, Dict[str, Any]]] = []

        def ordem(item: Tuple[float, Any, Any, Dict[str, Any]]) -> Tuple[float, Any]:
            return (-item[0], item[2])

        def guardar(solucao: Dict[str, Any]) -> None:
            valor = objetivo(solucao)
            chave = identificar(solucao) if identificar else tuple(sorted(solucao.items(), key=str))
            criterio = desempate(solucao) if desempate else 0
            novo = (valor, chave, criterio, solucao)
            # se já tínhamos esta solução, ficamos só com a melhor das duas versões
            for posicao, existente in enumerate(melhores):
                if existente[1] == chave:
                    if ordem(novo) < ordem(existente):
                        melhores[posicao] = novo
                        melhores.sort(key=ordem)
                    return
            melhores.append(novo)
            melhores.sort(key=ordem)
            if len(melhores) > k:
                melhores.pop()

        def podar(atribuicao: Dict[str, Any], dominios: Dict[str, List[Any]]) -> bool:
            # só podemos cortar ramos depois de já termos k soluções guardadas
            if limite_superior is None or len(melhores) < k:
                return False
            limite = limite_superior(atribuicao, dominios)
            pior = melhores[-1][0]
            return limite < pior or (desempate is None and limite <= pior)

        self.procurar(guardar, ordenar_valores=ordenar_valores, podar=podar)
        return [(valor, solucao) for valor, _, _, solucao in melhores]


# =====================================================================================
# Funções auxiliares de texto e de localização
# =====================================================================================
#
# Põe o texto em minúsculas e tira acentos e hífenes, para "Évora" e "evora" serem a mesma coisa.
def _normalize(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text or "")
    cleaned = "".join(c for c in nfkd if not unicodedata.combining(c)).lower()
    cleaned = cleaned.replace("-", " ").replace("_", " ")
    return " ".join(cleaned.split())


# Semelhança entre dois textos (de 0 a 1). Serve para aceitar pequenos erros, como "guitarista".
def _safe_ratio(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, _normalize(a), _normalize(b)).ratio()


# Vários nomes para o mesmo instrumento: "baterista", "bateria" e "Baterista" vão todos dar à chave "bateria".
INSTRUMENT_ALIASES = {
    "pianista": "piano",
    "piano": "piano",
    "baixista": "baixo",
    "baixo": "baixo",
    "baterista": "bateria",
    "bateria": "bateria",
    "guitarrista": "guitarra",
    "guitarra": "guitarra",
    "vocalista": "voz",
    "cantor": "voz",
    "cantora": "voz",
    "voz": "voz",
    "violinista": "violino",
    "violino": "violino",
    "saxofonista": "saxofone",
    "saxofone": "saxofone",
    "sax": "saxofone",
    "teclista": "teclado",
    "teclado": "teclado",
}


# Chave única de um instrumento, para comparar instrumentos escritos de maneiras diferentes.
def _instrument_key(name: str) -> str:
    norm = _normalize(name)
    return INSTRUMENT_ALIASES.get(norm, norm)


# Converte para inteiro sem rebentar quando o valor vem vazio ou mal escrito.
def _parse_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


# Os distritos de Portugal continental. É aqui que procuramos a localização que aparece no texto.
DISTRITOS_PT = [
    "Aveiro",
    "Beja",
    "Braga",
    "Bragança",
    "Castelo Branco",
    "Coimbra",
    "Évora",
    "Faro",
    "Guarda",
    "Leiria",
    "Lisboa",
    "Portalegre",
    "Porto",
    "Santarém",
    "Setúbal",
    "Viana do Castelo",
    "Vila Real",
    "Viseu",
]

# Distritos que fazem fronteira entre si. Com isto sabemos que Coimbra fica perto de Leiria e longe de Faro.
_FRONTEIRAS_DISTRITOS = [
    ("viana do castelo", "braga"),
    ("braga", "porto"),
    ("braga", "vila real"),
    ("porto", "aveiro"),
    ("porto", "vila real"),
    ("vila real", "braganca"),
    ("vila real", "viseu"),
    ("vila real", "guarda"),
    ("braganca", "guarda"),
    ("aveiro", "viseu"),
    ("aveiro", "coimbra"),
    ("viseu", "guarda"),
    ("viseu", "coimbra"),
    ("viseu", "castelo branco"),
    ("guarda", "castelo branco"),
    ("coimbra", "castelo branco"),
    ("coimbra", "leiria"),
    ("castelo branco", "portalegre"),
    ("castelo branco", "santarem"),
    ("leiria", "santarem"),
    ("santarem", "portalegre"),
    ("santarem", "lisboa"),
    ("santarem", "setubal"),
    ("santarem", "evora"),
    ("portalegre", "evora"),
    ("lisboa", "setubal"),
    ("setubal", "evora"),
    ("setubal", "beja"),
    ("evora", "beja"),
    ("beja", "faro"),
]


# Transforma a lista de fronteiras num grafo: para cada distrito, os seus vizinhos.
def _construir_adjacencia_distritos() -> Dict[str, set]:
    adjacencia: Dict[str, set] = {}
    for a, b in _FRONTEIRAS_DISTRITOS:
        adjacencia.setdefault(a, set()).add(b)
        adjacencia.setdefault(b, set()).add(a)
    return adjacencia


ADJACENCIA_DISTRITOS = _construir_adjacencia_distritos()

# Quanto vale a proximidade conforme os distritos que é preciso atravessar: o mesmo distrito vale 1, um vizinho 0.8 e a dois saltos 0.6.
_PONTUACAO_POR_SALTOS = {0: 1.0, 1: 0.8, 2: 0.6}


# Pesquisa em largura (BFS) no grafo de distritos para saber a quantos "saltos" estão dois distritos. Acima do limite devolve None, que quer dizer "longe".
def _distrito_hops(a: str, b: str, limite: int = 2) -> Optional[int]:
    origem = _normalize(a)
    destino = _normalize(b)
    if not origem or not destino:
        return None
    if origem == destino:
        return 0
    if origem not in ADJACENCIA_DISTRITOS or destino not in ADJACENCIA_DISTRITOS:
        return None

    visitados = {origem}
    fila = deque([(origem, 0)])
    while fila:
        atual, dist = fila.popleft()
        if dist >= limite:
            continue
        for vizinho in ADJACENCIA_DISTRITOS.get(atual, ()):
            if vizinho == destino:
                return dist + 1
            if vizinho not in visitados:
                visitados.add(vizinho)
                fila.append((vizinho, dist + 1))
    return None


# Converte o número de saltos numa pontuação de proximidade.
def _proximidade_geografica(a: str, b: str) -> Optional[float]:
    hops = _distrito_hops(a, b)
    if hops is None:
        return None
    return _PONTUACAO_POR_SALTOS.get(hops)


# Semelhança entre duas localizações: o máximo entre a semelhança do nome (para apanhar erros de escrita) e a proximidade no mapa.
def _localizacao_ratio(a: str, b: str) -> float:
    ratio = _safe_ratio(a, b)
    proximidade = _proximidade_geografica(a, b)
    if proximidade is not None:
        ratio = max(ratio, proximidade)
    return ratio


# Cache das proximidades, porque ao formar bandas comparamos os mesmos pares de distritos muitas vezes.
_CACHE_PROXIMIDADE: Dict[Tuple[str, str], float] = {}


def _proximidade_locais(a: str, b: str) -> float:
    chave = (a, b) if a <= b else (b, a)
    if chave not in _CACHE_PROXIMIDADE:
        _CACHE_PROXIMIDADE[chave] = _localizacao_ratio(*chave)
    return _CACHE_PROXIMIDADE[chave]


# Para perceber quantidades escritas por extenso, como "dois guitarristas" ou "três anos".
NUMEROS_EXTENSO = {
    "zero": 0, "um": 1, "uma": 1, "dois": 2, "duas": 2, "tres": 3, "quatro": 4,
    "cinco": 5, "seis": 6, "sete": 7, "oito": 8, "nove": 9, "dez": 10,
    "onze": 11, "doze": 12, "treze": 13, "catorze": 14, "quatorze": 14,
    "quinze": 15, "dezasseis": 16, "dezesseis": 16, "dezassete": 17,
    "dezessete": 17, "dezoito": 18, "dezanove": 19, "dezenove": 19,
    "vinte": 20,
}


# Passa palavras para o singular ("guitarristas" -> "guitarrista") para o texto bater certo com o catálogo.
def _singularize(word: str) -> str:
    w = word
    if len(w) <= 3:
        return w
    for suf, repl in (("oes", "ao"), ("aes", "ao"), ("ais", "al"), ("eis", "el"), ("ois", "ol"), ("uis", "ul")):
        if w.endswith(suf):
            return w[: -len(suf)] + repl
    if w.endswith("ns"):
        return w[:-2] + "m"
    if w.endswith("zes") or w.endswith("res") or w.endswith("ses") and not w.endswith("esses"):
        return w[:-2]
    if w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    return w


# Parte o texto em palavras já normalizadas.
def _tokenize(texto: str) -> List[str]:
    norm = _normalize(texto)
    return re.findall(r"[a-z0-9]+", norm)


# Forma "canónica" de uma expressão: normalizada e no singular.
def _canonical_phrase(phrase: str) -> str:
    norm = _normalize(phrase)
    return " ".join(_singularize(p) for p in norm.split(" ") if p)


# Procura no texto um elemento de um catálogo (por exemplo um distrito). Primeiro tenta correspondências
# exatas com grupos de até `max_ngram` palavras ("castelo branco") e, se não houver, aceita a mais
# parecida desde que passe o limiar.
def _match_from_catalog(
    tokens: List[str],
    catalogo: List[str],
    max_ngram: int = 1,
    limiar_fuzzy: float = 0.82,
) -> Optional[str]:
    if not catalogo or not tokens:
        return None

    canonicos: Dict[str, str] = {}
    normalizados: Dict[str, str] = {}
    for item in catalogo:
        canonicos.setdefault(_canonical_phrase(item), item)
        normalizados.setdefault(_normalize(item), item)

    n_tokens = len(tokens)
    max_n = min(max_ngram, n_tokens)

    for n in range(max_n, 0, -1):
        for i in range(0, n_tokens - n + 1):
            frase = " ".join(tokens[i : i + n])
            canon = _canonical_phrase(frase)
            if canon in canonicos:
                return canonicos[canon]

    melhor_item: Optional[str] = None
    melhor_score = 0.0
    for n in range(max_n, 0, -1):
        for i in range(0, n_tokens - n + 1):
            frase_norm = _normalize(" ".join(tokens[i : i + n]))
            for item_norm, item_original in normalizados.items():
                ratio = _safe_ratio(frase_norm, item_norm)
                if ratio > melhor_score and ratio >= limiar_fuzzy:
                    melhor_score = ratio
                    melhor_item = item_original
    return melhor_item


# =====================================================================================
# Leitura do pedido escrito pelo utilizador
# Esta parte não é o CSP: só transforma a frase nos dados que depois servem para montar as
# variáveis e as restrições do CSP.
# =====================================================================================
#
# Número máximo de lugares numa banda e peso que a proximidade entre os membros tem na pontuação.
MAX_PAPEIS_BANDA = 8
PESO_COESAO_BANDA = 2.5


# Vê se uma palavra é um instrumento conhecido, também no plural ("baixistas").
def _alias_instrumento(tok: str) -> Optional[str]:
    candidatos = [tok, _singularize(tok)]
    if tok.endswith("es"):
        candidatos.append(tok[:-2])
    for candidato in candidatos:
        if candidato in INSTRUMENT_ALIASES:
            return INSTRUMENT_ALIASES[candidato]
    return None


# Lê o número que vem antes do instrumento: "dois guitarristas" dá 2. Se não houver número, é 1.
def _quantidade_antes(tokens: List[str], posicao: int) -> int:
    if posicao == 0:
        return 1
    anterior = tokens[posicao - 1]
    if anterior.isdigit():
        return max(1, int(anterior))
    return max(1, NUMEROS_EXTENSO.get(anterior, 1))


# Palavras que ajudam a perceber a frase:
#   "sou"/"toco" antes de um instrumento     -> é o instrumento do próprio utilizador
#   "tenho"/"temos"/"somos"                 -> a banda já tem esse lugar ocupado
#   ligações ("e", "o", "um"...)            -> podem aparecer pelo meio sem mudar o sentido
#   as restantes servem para detetar a intenção (formar banda, entrar numa banda, etc.)
MARCADORES_PROPRIO = {"sou", "toco"}
MARCADORES_OCUPADO = {"tenho", "temos", "somos"}
LIGACOES_PROPRIO = {"e", "o", "a", "os", "as", "um", "uma", "ja", "tambem", "eu", "nos", "so"}
PALAVRAS_BANDA = {"banda", "grupo"}
PALAVRAS_FORMAR = {"formar", "criar", "montar", "fundar", "comecar"}
PALAVRAS_DONO = {"minha", "nossa", "meu", "nosso"}
PALAVRAS_INTEGRAR = {"entrar", "integrar", "juntar", "aderir", "participar", "parte"}
PALAVRAS_ADICIONAR = {"tambem", "acrescenta", "acrescentar", "adiciona", "adicionar"}
PALAVRAS_MUSICO = {"musico", "alguem", "pessoa"}
# Formação base de uma banda. É usada quando o utilizador diz o instrumento dele mas não diz o que lhe falta.
FORMACAO_BASE = ("voz", "guitarra", "baixo", "bateria")
# Peso da afinidade entre um músico e as características do perfil do utilizador.
PESO_PERFIL_BANDA = 1.5
# Valores especiais no domínio dos lugares da banda: "tu" é o próprio utilizador e "ocupado" é um lugar que ele já tem preenchido.
TU = "tu"
OCUPADO = "ocupado"


# Decide a quem pertence um instrumento mencionado. Andamos para trás na frase, saltando ligações e
# outros instrumentos, até encontrar "sou/toco" (é teu) ou "tenho/temos/somos" (já está ocupado).
# Um "não" antes inverte isto: "não tenho baterista" quer dizer que falta um baterista.
def _dono_da_mencao(tokens: List[str], posicao: int, ocupadas: set) -> Optional[str]:
    i = posicao - 1
    while i >= 0 and posicao - i <= 8:
        tok = tokens[i]
        if tok in MARCADORES_PROPRIO or tok in MARCADORES_OCUPADO:
            if i > 0 and tokens[i - 1] in ("nao", "nem"):
                return None
            return TU if tok in MARCADORES_PROPRIO else OCUPADO
        if i in ocupadas or tok in LIGACOES_PROPRIO or tok in NUMEROS_EXTENSO or tok.isdigit():
            i -= 1
            continue
        return None
    return None


# Nome do instrumento a mostrar, usando o nome que existe na base de dados para essa chave.
def _nome_instrumento(chave: str, instrumentos_conhecidos: List[str]) -> str:
    return next((c for c in instrumentos_conhecidos if _instrument_key(c) == chave), chave.capitalize())


# Junta listas de instrumentos sem repetir o mesmo instrumento.
def _unir_por_instrumento(*listas: Optional[List[str]]) -> List[str]:
    vistos: set = set()
    out: List[str] = []
    for lista in listas:
        for nome in lista or []:
            chave = _instrument_key(nome or "")
            if chave and chave not in vistos:
                vistos.add(chave)
                out.append(nome)
    return out


# Encontra todos os instrumentos da frase e separa-os em três grupos: os que o utilizador procura
# (com a quantidade), os que são dele e os que a banda já tem.
def _extrair_instrumentos(
    tokens: List[str], instrumentos_conhecidos: List[str]
) -> Tuple[List[str], List[str], List[str]]:
    mencoes: List[Tuple[int, str]] = []
    usados: set = set()

    # primeiro: nomes conhecidos (aliases), como "baterista" ou "guitarras"
    for i, tok in enumerate(tokens):
        chave = _alias_instrumento(tok)
        if not chave:
            continue
        usados.add(i)
        mencoes.append((i, _nome_instrumento(chave, instrumentos_conhecidos)))

    # depois: nomes do catálogo da base de dados, aceitando pequenos erros de escrita
    canonicos: Dict[str, str] = {}
    normalizados: Dict[str, str] = {}
    for item in instrumentos_conhecidos:
        canonicos.setdefault(_canonical_phrase(item), item)
        normalizados.setdefault(_normalize(item), item)

    for n in (2, 1):
        for i in range(0, len(tokens) - n + 1):
            if any(idx in usados for idx in range(i, i + n)):
                continue
            frase = " ".join(tokens[i : i + n])
            item = canonicos.get(_canonical_phrase(frase))
            if not item and len(frase) >= 4:
                item = next(
                    (original for norm, original in normalizados.items() if _safe_ratio(frase, norm) >= 0.82),
                    None,
                )
            if item:
                usados.update(range(i, i + n))
                mencoes.append((i, _nome_instrumento(_instrument_key(item), instrumentos_conhecidos)))

    # por fim: decidir a quem pertence cada instrumento encontrado
    proprios: List[str] = []
    ocupados: List[str] = []
    quantidades: Dict[str, int] = {}
    nomes: Dict[str, str] = {}
    for posicao, item in sorted(mencoes):
        dono = _dono_da_mencao(tokens, posicao, usados)
        if dono == TU:
            proprios.append(item)
            continue
        if dono == OCUPADO:
            ocupados.append(item)
            continue
        chave = _instrument_key(item)
        nomes.setdefault(chave, item)
        quantidades[chave] = max(quantidades.get(chave, 0), _quantidade_antes(tokens, posicao))
    pedidos = [nomes[chave] for chave, n in quantidades.items() for _ in range(n)][:MAX_PAPEIS_BANDA]
    return pedidos, _unir_por_instrumento(proprios), _unir_por_instrumento(ocupados)


# Distrito mencionado no texto (aceita nomes com até 3 palavras e pequenos erros).
def _extrair_localizacao(tokens: List[str]) -> Optional[str]:
    return _match_from_catalog(tokens, DISTRITOS_PT, max_ngram=3, limiar_fuzzy=0.8)


# Características do catálogo que aparecem no texto, como "pontual" ou "rock".
def _extrair_caracteristicas(tokens: List[str], caracteristicas_conhecidas: List[str]) -> List[str]:
    if not caracteristicas_conhecidas or not tokens:
        return []

    canonicos: Dict[str, str] = {}
    normalizados: Dict[str, str] = {}
    for item in caracteristicas_conhecidas:
        canonicos.setdefault(_canonical_phrase(item), item)
        normalizados.setdefault(_normalize(item), item)

    encontradas: List[str] = []
    usados_idx: set = set()
    n_tokens = len(tokens)
    max_n = min(2, n_tokens)

    for n in range(max_n, 0, -1):
        for i in range(0, n_tokens - n + 1):
            if any(idx in usados_idx for idx in range(i, i + n)):
                continue
            frase = " ".join(tokens[i : i + n])
            canon = _canonical_phrase(frase)
            item = canonicos.get(canon)
            if not item:
                frase_norm = _normalize(frase)
                for item_norm, item_original in normalizados.items():
                    if _safe_ratio(frase_norm, item_norm) >= 0.86:
                        item = item_original
                        break
            if item and item not in encontradas:
                encontradas.append(item)
                usados_idx.update(range(i, i + n))

    return encontradas


# Anos de experiência: procuramos a palavra "ano(s)" e o número que vem antes. "Anos de idade" é ignorado.
def _extrair_anos_experiencia(tokens: List[str]) -> Optional[int]:
    for i, tok in enumerate(tokens):
        if _singularize(tok) != "ano":
            continue
        seguinte = tokens[i + 1 : i + 3]
        if "idade" in seguinte:
            continue
        janela = tokens[max(0, i - 3) : i]
        for cand in reversed(janela):
            if cand.isdigit():
                return int(cand)
            if cand in NUMEROS_EXTENSO:
                return NUMEROS_EXTENSO[cand]
    return None


# Descobre o que o utilizador quer fazer:
#   formar_banda   -> pede dois ou mais instrumentos, ou usa um verbo como "formar" ou "criar"
#   musico         -> procura um músico (inclui "baterista para a minha banda")
#   integrar_banda -> quer entrar numa banda que já existe
def _detetar_intencao(tokens: List[str], instrumentos: List[str]) -> str:
    if len(instrumentos) >= 2 or any(tok in PALAVRAS_FORMAR for tok in tokens):
        return "formar_banda"

    posicoes = [i for i, tok in enumerate(tokens) if _singularize(tok) in PALAVRAS_BANDA]
    if not posicoes:
        return "musico"
    for i in posicoes:
        anteriores = tokens[max(0, i - 3) : i]
        if any(tok in PALAVRAS_DONO for tok in anteriores):
            return "musico"
        if instrumentos and any(tok in ("para", "pra") for tok in anteriores):
            return "musico"
    if instrumentos and not any(tok in PALAVRAS_INTEGRAR or tok.startswith("precis") for tok in tokens):
        return "musico"
    return "integrar_banda"


# Junta tudo o que se consegue tirar da frase. É este resultado que depois dá origem às variáveis e restrições do CSP.
def interpretar_texto(
    texto: str,
    instrumentos_conhecidos: Optional[List[str]] = None,
    caracteristicas_conhecidas: Optional[List[str]] = None,
) -> Dict[str, Any]:
    tokens = _tokenize(texto or "")
    instrumentos, proprios, ocupados = _extrair_instrumentos(tokens, instrumentos_conhecidos or [])
    intencao = _detetar_intencao(tokens, instrumentos)
    return {
        "intencao": intencao,
        "instrumento": instrumentos[0] if instrumentos else None,
        "instrumentos": instrumentos,
        "proprios": proprios,
        "ocupados": ocupados,
        # "formar", "criar"... começa uma banda nova
        "nova_banda": any(tok in PALAVRAS_FORMAR for tok in tokens),
        # "e um pianista" ou "também..." acrescenta à banda que já estava a ser montada
        "aditivo": bool(instrumentos)
        and (tokens[:1] == ["e"] or any(tok in PALAVRAS_ADICIONAR for tok in tokens)),
        # a frase traz um pedido próprio, não é só uma continuação da conversa
        "explicita": intencao != "musico"
        or bool(instrumentos)
        or any(_singularize(tok) in PALAVRAS_MUSICO for tok in tokens),
        "localizacao": _extrair_localizacao(tokens),
        "anos_experiencia": _extrair_anos_experiencia(tokens),
        "caracteristicas": _extrair_caracteristicas(tokens, caracteristicas_conhecidas or []),
    }


# =====================================================================================
# O pedido já organizado e as funções que avaliam cada músico
# =====================================================================================
#
# Tudo o que o utilizador pediu, depois de juntar o texto, os chips, a conversa e o perfil.
# É a partir daqui que os solvers montam o CSP.
@dataclass
class Preferencias:
    instrumento: Optional[str] = None
    anos_experiencia: Optional[int] = None
    localizacao: Optional[str] = None
    caracteristicas: List[str] = field(default_factory=list)

    # lugares que é preciso preencher quando se forma uma banda
    instrumentos_requeridos: List[str] = field(default_factory=list)

    # exigências específicas de um instrumento (usado pelo endpoint /ai/match)
    requisitos_por_instrumento: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    # "proximos": preferir membros perto uns dos outros; "todos_igual": todos no mesmo sítio; "livre": tanto faz
    politica_localizacao_banda: str = "proximos"

    # lugares da banda como (instrumento, tipo), em que o tipo é "livre", "tu" ou "ocupado"
    lugares: List[Tuple[str, str]] = field(default_factory=list)

    # perfil de quem está a pedir (instrumentos, distrito e características)
    perfil: Optional[Dict[str, Any]] = None


# Funções que avaliam um músico (ou uma banda) face a um pedido. São usadas dentro das restrições do
# CSP, para dizer se um valor é permitido, e na função objetivo, para dizer quão bom é esse valor.
class Matcher:
    def __init__(self, musicos: Iterable[Dict[str, Any]]) -> None:
        self.musicos = list(musicos)

    # Anos de experiência do músico em cada um dos seus instrumentos.
    def _anos_por_chave(self, musico: Dict[str, Any]) -> Dict[str, Optional[int]]:
        tabela: Dict[str, Optional[int]] = {}
        for entrada in musico.get("instrumentos", []) or []:
            chave = _instrument_key(entrada.get("nome", ""))
            if chave in tabela:
                continue
            anos = entrada.get("anos_experiencia")
            if anos is None:
                continue
            try:
                v = int(anos)
            except (TypeError, ValueError):
                continue
            tabela[chave] = v if v >= 0 else None
        return tabela

    # Anos de experiência num instrumento em concreto.
    def _anos_por_instrumento(self, musico: Dict[str, Any], instrumento: str) -> Optional[int]:
        return self._anos_por_chave(musico).get(_instrument_key(instrumento))

    # Anos de experiência gerais do músico (o controller calcula este valor).
    def _anos_globais(self, musico: Dict[str, Any]) -> Optional[int]:
        anos = musico.get("anos_experiencia")
        try:
            v = int(anos)
            return v if v >= 0 else None
        except (TypeError, ValueError):
            return None

    # Características do músico já normalizadas.
    def _caracteristicas_normalizadas(self, musico: Dict[str, Any]) -> List[str]:
        caracs = musico.get("caracteristicas") or []
        return [_normalize(c) for c in caracs if c is not None]

    # Conta quantas das características pedidas o músico tem (aceita nomes parecidos). Devolve (encontradas, pedidas, proporção).
    def _caracteristicas_match(
        self, musico: Dict[str, Any], desejadas: List[str], relax: bool
    ) -> Tuple[int, int, float]:
        desejadas_norm = [_normalize(c) for c in desejadas if c]
        if not desejadas_norm:
            return (0, 0, 0.0)

        existentes = self._caracteristicas_normalizadas(musico)
        usados = set()
        match_count = 0

        for wanted in desejadas_norm:
            best = 0.0
            best_idx = None
            for idx, exist in enumerate(existentes):
                if idx in usados:
                    continue
                r = _safe_ratio(wanted, exist)
                if r > best:
                    best = r
                    best_idx = idx
            if best_idx is not None and (best >= (0.75 if relax else 0.85)):
                match_count += 1
                usados.add(best_idx)

        total = len(desejadas_norm)
        return (match_count, total, (match_count / total if total else 0.0))

    # Restrição das características: o músico tem de ter pelo menos 80% das pedidas (60% quando relaxamos).
    def _caracteristicas_ok(self, musico: Dict[str, Any], desejadas: List[str], relax: bool) -> bool:
        match_count, total, _ = self._caracteristicas_match(musico, desejadas, relax)
        minimo = max(1, math.ceil(total * (0.6 if relax else 0.8)))
        return match_count >= minimo

    # Restrição do instrumento: o músico toca o instrumento pedido? Quando relaxamos aceitamos nomes menos parecidos.
    def _instrumento_match(self, musico: Dict[str, Any], instrumento: str, relax: bool) -> bool:
        alvo = _instrument_key(instrumento)
        for entrada in musico.get("instrumentos", []) or []:
            inst_key = _instrument_key(entrada.get("nome", ""))
            ratio = _safe_ratio(inst_key, alvo)
            if ratio >= (0.95 if not relax else 0.78):
                return True
        return False

    # Quão bem o instrumento do músico corresponde ao pedido (0 a 1). Entra na pontuação.
    def _instrumento_score(self, musico: Dict[str, Any], instrumento: str) -> float:
        alvo = _instrument_key(instrumento)
        best = 0.0
        for entrada in musico.get("instrumentos", []) or []:
            inst_key = _instrument_key(entrada.get("nome", ""))
            best = max(best, _safe_ratio(inst_key, alvo))
        return best

    # Qual dos instrumentos do músico corresponde ao pedido, e com quantos anos de experiência.
    def _melhor_instrumento(
        self, musico: Dict[str, Any], instrumento: Optional[str]
    ) -> Tuple[Optional[str], Optional[int], float]:
        if not instrumento:
            entrada = (musico.get("instrumentos") or [None])[0] or {}
            return entrada.get("nome"), entrada.get("anos_experiencia"), 0.0

        alvo_norm = _instrument_key(instrumento)
        for entrada in musico.get("instrumentos", []) or []:
            inst_key = _instrument_key(entrada.get("nome", ""))
            ratio = _safe_ratio(inst_key, alvo_norm)
            if ratio >= 0.78:
                return entrada.get("nome"), entrada.get("anos_experiencia"), ratio

        return (None, None, 0.0)

    # Restrição da localização: o músico está no distrito pedido ou perto dele (aceitamos mais longe quando relaxamos).
    def _localizacao_match(self, musico: Dict[str, Any], localizacao: str, relax: bool) -> bool:
        ratio = _localizacao_ratio(musico.get("localizacao", ""), localizacao)
        return ratio >= (0.75 if relax else 0.85)

    # Verifica todas as restrições de um músico de uma só vez. A procura não usa esta função (lá cada
    # restrição está separada); serve para marcar no resultado se um membro cumpre tudo o que foi pedido.
    def _satisfaz_constraints_1(self, musico: Dict[str, Any], prefs: Preferencias, relax: bool) -> bool:
        if prefs.instrumento and not self._instrumento_match(musico, prefs.instrumento, relax):
            return False

        if prefs.localizacao and not self._localizacao_match(musico, prefs.localizacao, relax):
            return False

        if prefs.caracteristicas and not self._caracteristicas_ok(musico, prefs.caracteristicas, relax):
            return False

        if prefs.anos_experiencia is not None:
            return self._anos_ok(musico, prefs, relax)

        return True

    # Restrição dos anos: exatamente os anos pedidos, ou até 4 anos de diferença quando relaxamos.
    def _anos_ok(self, musico: Dict[str, Any], prefs: Preferencias, relax: bool) -> bool:
        anos = (
            self._anos_por_instrumento(musico, prefs.instrumento)
            if prefs.instrumento
            else self._anos_globais(musico)
        )
        if anos is None:
            return False
        if relax:
            return abs(anos - prefs.anos_experiencia) <= 4
        return anos == prefs.anos_experiencia

    # Função objetivo de um músico: soma pesada de quão bem cumpre cada critério (instrumento 4,
    # características 3.5, localização e anos 2.5), mais um pequeno bónus se cumprir 3 ou mais critérios.
    # É com isto que o branch & bound escolhe as melhores soluções.
    def _pontuacao_1(self, musico: Dict[str, Any], prefs: Preferencias) -> Dict[str, float]:
        score = 0.0
        detalhes: Dict[str, float] = {}

        if prefs.instrumento:
            inst = self._instrumento_score(musico, prefs.instrumento)
            detalhes["instrumento"] = round(inst, 3)
            score += 4.0 * inst

        if prefs.anos_experiencia is not None:
            anos = (
                self._anos_por_instrumento(musico, prefs.instrumento)
                if prefs.instrumento
                else self._anos_globais(musico)
            )
            if anos is not None:
                diff = abs(anos - prefs.anos_experiencia)
                detalhes["anos_experiencia"] = 1.0 if diff == 0 else max(0.0, 1 - (diff / 4.0))
                score += 2.5 * detalhes["anos_experiencia"]
            else:
                detalhes["anos_experiencia"] = 0.2
                score += 0.5 * detalhes["anos_experiencia"]

        if prefs.localizacao:
            r = _localizacao_ratio(musico.get("localizacao", ""), prefs.localizacao)
            detalhes["localizacao"] = round(r, 3)
            score += 2.5 * r

        if prefs.caracteristicas:
            match_count, total, ratio = self._caracteristicas_match(musico, prefs.caracteristicas, relax=True)
            detalhes["caracteristicas"] = round(ratio, 3)
            cobertura = (match_count / total) if total else 0.0
            score += 3.5 * max(ratio, cobertura)

        criterios = sum(1 for k in ["instrumento", "anos_experiencia", "localizacao", "caracteristicas"] if detalhes.get(k, 0) > 0)
        if criterios >= 3:
            score += 0.5

        detalhes["score_total"] = round(score, 3)
        return detalhes

# =====================================================================================
# CSP para procurar um músico (ou, com variavel="banda", uma banda para integrar)
# =====================================================================================
#
# Variáveis:
#   musico       -> índice do músico na lista (domínio: todos os músicos)
#   instrumento  -> instrumento que ele toca (só existe se o pedido tiver instrumento)
#   localizacao  -> distrito onde ele está (só se o pedido tiver distrito)
#   anos         -> anos de experiência (só se o pedido tiver anos)
#
# Restrições:
#   instrumento_pedido, localizacao_pedida, anos_pedidos (unárias) -> o valor tem de bater com o pedido
#   toca(musico, instrumento) e reside(musico, localizacao)         -> ligam o músico aos seus dados
#   experiencia(musico, instrumento, anos)                         -> ternária: os anos têm de ser os desse instrumento
#   caracteristicas(musico) (unária)                                -> tem as características pedidas
class CSP1Solver:
    def __init__(self, matcher: Matcher, variavel: str = "musico") -> None:
        self.m = matcher
        self.variavel = variavel

    # Monta o CSP para um nível de exigência (relax=True aceita valores aproximados).
    def _construir_csp(self, prefs: Preferencias, relax: bool) -> CSP:
        musicos = self.m.musicos
        v = self.variavel
        csp = CSP()
        csp.adicionar_variavel(v, range(len(musicos)))

        # instrumento: variável com todos os instrumentos que existem e restrição a ligar o músico ao que toca
        if prefs.instrumento:
            alvo = _instrument_key(prefs.instrumento)
            limiar_instrumento = 0.78 if relax else 0.95
            chaves = [
                {_instrument_key(entrada.get("nome", "")) for entrada in (mus.get("instrumentos") or [])}
                for mus in musicos
            ]
            csp.adicionar_variavel("instrumento", sorted(set().union(*chaves)))
            csp.adicionar_restricao(
                "instrumento_pedido",
                ("instrumento",),
                lambda i: _safe_ratio(i, alvo) >= limiar_instrumento,
            )
            csp.adicionar_restricao("toca", (v, "instrumento"), lambda m, i: i in chaves[m])

        # localização: variável com os distritos dos músicos e restrição a dizer onde cada um vive
        if prefs.localizacao:
            limiar_localizacao = 0.75 if relax else 0.85
            locais = [_normalize(mus.get("localizacao") or "") for mus in musicos]
            csp.adicionar_variavel("localizacao", sorted({local for local in locais if local}))
            csp.adicionar_restricao(
                "localizacao_pedida",
                ("localizacao",),
                lambda local: _localizacao_ratio(local, prefs.localizacao) >= limiar_localizacao,
            )
            csp.adicionar_restricao("reside", (v, "localizacao"), lambda m, local: locais[m] == local)

        # anos: se houver instrumento, os anos têm de ser os desse instrumento (restrição ternária)
        if prefs.anos_experiencia is not None:
            pedido = prefs.anos_experiencia

            def anos_aceitaveis(anos: int) -> bool:
                return abs(anos - pedido) <= 4 if relax else anos == pedido

            if prefs.instrumento:
                anos_por_chave = [self.m._anos_por_chave(mus) for mus in musicos]
                valores = {anos for tabela in anos_por_chave for anos in tabela.values() if anos is not None}
                csp.adicionar_variavel("anos", sorted(valores))
                csp.adicionar_restricao("anos_pedidos", ("anos",), anos_aceitaveis)
                csp.adicionar_restricao(
                    "experiencia",
                    (v, "instrumento", "anos"),
                    lambda m, i, anos: anos_por_chave[m].get(i) == anos,
                )
            else:
                anos_globais = [self.m._anos_globais(mus) for mus in musicos]
                csp.adicionar_variavel("anos", sorted({anos for anos in anos_globais if anos is not None}))
                csp.adicionar_restricao("anos_pedidos", ("anos",), anos_aceitaveis)
                csp.adicionar_restricao("experiencia", (v, "anos"), lambda m, anos: anos_globais[m] == anos)

        # características: restrição unária sobre o próprio músico
        if prefs.caracteristicas:
            csp.adicionar_restricao(
                "caracteristicas",
                (v,),
                lambda m: self.m._caracteristicas_ok(musicos[m], prefs.caracteristicas, relax),
            )

        return csp

    # Resolve o CSP como problema de otimização: das soluções possíveis ficamos com as k de maior
    # pontuação. O limite superior para o branch & bound é a melhor pontuação que ainda existe no domínio
    # da variável principal.
    def _melhores(self, prefs_nivel: Preferencias, prefs: Preferencias, relax: bool, k: int) -> List[int]:
        musicos = self.m.musicos
        v = self.variavel
        cache: Dict[int, float] = {}

        def pontuacao(i: int) -> float:
            if i not in cache:
                cache[i] = self.m._pontuacao_1(musicos[i], prefs)["score_total"]
            return cache[i]

        def limite(atribuicao: Dict[str, Any], dominios: Dict[str, List[Any]]) -> float:
            if v in atribuicao:
                return pontuacao(atribuicao[v])
            return max((pontuacao(i) for i in dominios[v]), default=float("-inf"))

        # experimentamos primeiro os melhores músicos, para encontrar boas soluções cedo e podar mais
        def ordenar(var: str, valores: List[Any], atribuicao: Dict[str, Any]) -> List[Any]:
            return sorted(valores, key=lambda i: (-pontuacao(i), i)) if var == v else valores

        melhores = self._construir_csp(prefs_nivel, relax).otimizar(
            objetivo=lambda solucao: pontuacao(solucao[v]),
            k=k,
            limite_superior=limite,
            ordenar_valores=ordenar,
            # o mesmo músico pode aparecer em várias soluções (por exemplo com dois instrumentos parecidos); conta uma vez só
            identificar=lambda solucao: solucao[v],
            desempate=lambda solucao: solucao[v],
        )
        return [solucao[v] for _, solucao in melhores]

    # Relaxamento por níveis, sempre com o mesmo CSP:
    #   1) tudo exato  2) tudo relaxado (perto, ±4 anos, nomes parecidos)  3) só o instrumento  4) sem restrições
    # Paramos no primeiro nível com soluções. É daqui que vem o rótulo "exato", "semelhante" ou "outra opção".
    def solve(self, prefs: Preferencias, max_resultados: int) -> List[Dict[str, Any]]:
        niveis: List[Tuple[Preferencias, bool, bool, bool]] = [
            (prefs, False, True, True),
            (prefs, True, False, True),
        ]
        if prefs.instrumento:
            niveis.append((Preferencias(instrumento=prefs.instrumento), True, False, False))
        niveis.append((Preferencias(), True, False, False))

        indices: List[int] = []
        exato = proximo = False
        for prefs_nivel, relax, exato, proximo in niveis:
            indices = self._melhores(prefs_nivel, prefs, relax, max_resultados)
            if indices:
                break

        musicos = self.m.musicos

        # a partir daqui só se prepara a informação de cada resultado para mostrar na página
        out: List[Dict[str, Any]] = []
        for indice in indices:
            mus = musicos[indice]
            det = self.m._pontuacao_1(mus, prefs)
            score = det["score_total"]

            anos_diff = None
            if prefs.anos_experiencia is not None:
                anos_cand = (
                    self.m._anos_por_instrumento(mus, prefs.instrumento)
                    if prefs.instrumento
                    else self.m._anos_globais(mus)
                )
                if anos_cand is not None:
                    anos_diff = abs(anos_cand - prefs.anos_experiencia)

            local_ratio = None
            if prefs.localizacao:
                local_ratio = _localizacao_ratio(mus.get("localizacao", ""), prefs.localizacao)

            inst_match = True
            inst_nome = None
            inst_anos = None
            inst_score = None
            if prefs.instrumento:
                inst_score_raw = self.m._instrumento_score(mus, prefs.instrumento)
                inst_match = inst_score_raw >= 0.78
                inst_nome, inst_anos, inst_score = self.m._melhor_instrumento(mus, prefs.instrumento)

            out.append(
                {
                    "tipo": "musico",
                    "id": mus.get("id"),
                    "nome": mus.get("nome"),
                    "localizacao": mus.get("localizacao"),
                    "score": score,
                    "exato": exato,
                    "proximo": proximo,
                    "anos_diff": anos_diff,
                    "localizacao_ratio": local_ratio,
                    "instrumento_match": inst_match,
                    "instrumento_score": inst_score,
                    "instrumento_escolhido": inst_nome,
                    "instrumento_anos": inst_anos,
                    "detalhes": det,
                    "instrumentos": mus.get("instrumentos", []),
                    "caracteristicas": mus.get("caracteristicas", []),
                }
            )

        return out

# =====================================================================================
# CSP para formar uma banda
# =====================================================================================
#
# Variáveis: um lugar da banda cada (por exemplo "0:Vocalista", "1:Guitarrista", ...).
# Domínio de cada lugar: todos os músicos, mais "tu" (o próprio utilizador) e "ocupado".
#
# Restrições:
#   lugar_do_utilizador (unária)           -> os lugares que tu tocas só podem ter o valor "tu"
#   lugar_ja_ocupado (unária)              -> os lugares que disseste que já tens só podem ser "ocupado"
#   toca / localizacao / caracteristicas / anos (unárias)
#                                          -> quem ocupa um lugar livre tem de cumprir o pedido
#   nao_e_o_utilizador (unária)            -> nunca te propomos a ti próprio para um lugar livre
#   pessoas_diferentes (binária)           -> a mesma pessoa não pode ficar com dois lugares
#   ordem_papeis_iguais (binária)          -> com dois lugares iguais (dois guitarristas) impõe uma ordem,
#                                             para a mesma banda não aparecer com as pessoas trocadas
#   localizacao_banda / mesma_localizacao  -> só na política "todos_igual"
#
# Objetivo (o que o branch & bound maximiza):
#   pontuação de cada membro no seu lugar
#   + afinidade com as características do teu perfil
#   + coesão: quão perto estão os membros uns dos outros (contigo incluído)
class BandCSPSolver:
    def __init__(self, matcher: Matcher) -> None:
        self.m = matcher

    # Pedido de um lugar: o instrumento do lugar mais os critérios gerais (ou os específicos desse instrumento, se existirem).
    def _prefs_para_role(self, base: Preferencias, role_instr: str) -> Preferencias:
        role = _instrument_key(role_instr)
        req = (base.requisitos_por_instrumento or {}).get(role, {}) or {}

        anos = _parse_int(req.get("anos_experiencia"))
        if anos is None:
            anos = base.anos_experiencia

        caracs = req.get("caracteristicas")
        if caracs is None:
            caracs = base.caracteristicas

        loc = req.get("localizacao")
        if loc is None:
            loc = base.localizacao

        return Preferencias(
            instrumento=role_instr,
            anos_experiencia=anos,
            localizacao=loc,
            caracteristicas=list(caracs or []),
        )

    # Pontuação de um músico num lugar.
    def _score_role(self, mus: Dict[str, Any], role_prefs: Preferencias) -> Tuple[float, Dict[str, float]]:
        det = self.m._pontuacao_1(mus, role_prefs)
        return det["score_total"], det

    # Diz se um músico cumpre tudo o que um lugar pede (só serve para marcar o resultado).
    def _role_ok(self, mus: Dict[str, Any], role_prefs: Preferencias, relax: bool) -> bool:
        return self.m._satisfaz_constraints_1(mus, role_prefs, relax=relax)

    # Restrições unárias de um lugar livre, uma por critério, para cada uma ficar visível no modelo.
    # O isinstance garante que "tu" e "ocupado" nunca servem para preencher um lugar livre.
    def _restricoes_do_lugar(self, csp: CSP, var: str, prefs_papel: Preferencias, relax: bool) -> None:
        musicos = self.m.musicos
        m = self.m
        csp.adicionar_restricao(
            f"toca {var}",
            (var,),
            lambda v: isinstance(v, int) and m._instrumento_match(musicos[v], prefs_papel.instrumento, relax),
        )
        if prefs_papel.localizacao:
            csp.adicionar_restricao(
                f"localizacao {var}",
                (var,),
                lambda v: isinstance(v, int) and m._localizacao_match(musicos[v], prefs_papel.localizacao, relax),
            )
        if prefs_papel.caracteristicas:
            csp.adicionar_restricao(
                f"caracteristicas {var}",
                (var,),
                lambda v: isinstance(v, int) and m._caracteristicas_ok(musicos[v], prefs_papel.caracteristicas, relax),
            )
        if prefs_papel.anos_experiencia is not None:
            csp.adicionar_restricao(
                f"anos {var}",
                (var,),
                lambda v: isinstance(v, int) and m._anos_ok(musicos[v], prefs_papel, relax),
            )

    # Restrições extra de localização, só quando se pede que todos os membros sejam do mesmo sítio.
    def _adicionar_restricoes_localizacao(
        self, csp: CSP, variaveis: List[str], base_prefs: Preferencias, relax: bool
    ) -> None:
        if base_prefs.politica_localizacao_banda != "todos_igual" or len(variaveis) <= 1:
            return

        musicos = self.m.musicos
        if base_prefs.localizacao:
            for var in variaveis:
                csp.adicionar_restricao(
                    f"localizacao_banda {var}",
                    (var,),
                    lambda i: isinstance(i, int)
                    and self.m._localizacao_match(musicos[i], base_prefs.localizacao, relax=relax),
                )
            return

        limiar = 0.75 if relax else 0.85
        for a, b in combinations(variaveis, 2):
            csp.adicionar_restricao(
                f"mesma_localizacao {a} {b}",
                (a, b),
                lambda x, y: isinstance(x, int)
                and isinstance(y, int)
                and _localizacao_ratio(musicos[y].get("localizacao", ""), musicos[x].get("localizacao", "")) >= limiar,
            )

    # Lista de lugares da banda. Se não vierem lugares explícitos, todos os instrumentos pedidos são lugares livres.
    def _lugares(self, prefs: Preferencias) -> List[Tuple[str, str]]:
        if prefs.lugares:
            return [(papel, tipo) for papel, tipo in prefs.lugares if _normalize(papel)]
        return [(papel, "livre") for papel in prefs.instrumentos_requeridos or [] if _normalize(papel)]

    # Só os lugares que é preciso preencher.
    def _papeis(self, prefs: Preferencias) -> List[str]:
        return [papel for papel, tipo in self._lugares(prefs) if tipo == "livre"]

    # Monta o CSP da banda (ver a explicação no topo da classe).
    def _construir_csp(
        self,
        prefs_restricoes: Preferencias,
        lugares: List[Tuple[str, str]],
        relax: bool,
        perfil: Optional[Dict[str, Any]],
        livres: frozenset = frozenset(),
    ) -> Tuple[CSP, Dict[str, Tuple[str, str]]]:
        musicos = self.m.musicos
        variaveis = {f"{indice}:{papel}": (papel, tipo) for indice, (papel, tipo) in enumerate(lugares)}
        dominio = list(range(len(musicos))) + [TU, OCUPADO]
        id_perfil = (perfil or {}).get("id")

        # identidade de quem ocupa um lugar: o id do músico, o teu id, ou nada se o lugar já está ocupado
        def pessoa(valor: Any) -> Any:
            if valor == TU:
                return id_perfil
            if valor == OCUPADO:
                return None
            return musicos[valor].get("id")

        def diferentes(x: Any, y: Any) -> bool:
            a, b = pessoa(x), pessoa(y)
            return a is None or b is None or a != b

        # uma variável por lugar, todas com o mesmo domínio; são as restrições unárias que decidem o que cabe em cada uma
        csp = CSP()
        for var, (papel, tipo) in variaveis.items():
            csp.adicionar_variavel(var, dominio)
            if tipo == TU:
                csp.adicionar_restricao(f"lugar_do_utilizador {var}", (var,), lambda v: v == TU)
            elif tipo == OCUPADO:
                csp.adicionar_restricao(f"lugar_ja_ocupado {var}", (var,), lambda v: v == OCUPADO)
            else:
                prefs_papel = (
                    Preferencias(instrumento=papel)
                    if _instrument_key(papel) in livres
                    else self._prefs_para_role(prefs_restricoes, papel)
                )
                self._restricoes_do_lugar(csp, var, prefs_papel, relax)
                if id_perfil is not None:
                    csp.adicionar_restricao(
                        f"nao_e_o_utilizador {var}",
                        (var,),
                        lambda v: not isinstance(v, int) or musicos[v].get("id") != id_perfil,
                    )

        # restrições binárias entre os lugares livres
        a_preencher = [var for var, (_, tipo) in variaveis.items() if tipo == "livre"]
        for a, b in combinations(a_preencher, 2):
            if _instrument_key(variaveis[a][0]) == _instrument_key(variaveis[b][0]):
                csp.adicionar_restricao(
                    f"ordem_papeis_iguais {a} {b}",
                    (a, b),
                    lambda x, y: isinstance(x, int) and isinstance(y, int) and x < y and diferentes(x, y),
                )
            else:
                csp.adicionar_restricao(f"pessoas_diferentes {a} {b}", (a, b), diferentes)

        # lugares que perderam as restrições no nível 3 do relaxamento não entram nas regras de localização
        restritos = [var for var in a_preencher if _instrument_key(variaveis[var][0]) not in livres]
        self._adicionar_restricoes_localizacao(csp, restritos, prefs_restricoes, relax)
        return csp, variaveis

    # Mesmo esquema de relaxamento da procura de músicos:
    #   1) tudo exato  2) tudo relaxado
    #   3) os lugares que ficaram sem nenhum candidato passam a exigir só o instrumento; os outros mantêm tudo
    #   4) só instrumentos em todos os lugares
    def solve(self, base_prefs: Preferencias, max_resultados: int = 5) -> List[Dict[str, Any]]:
        lugares = self._lugares(base_prefs)
        roles = [papel for papel, tipo in lugares if tipo == "livre"]
        if not roles:
            return []

        def marcar(bandas: List[Dict[str, Any]], exato: bool, proximo: bool) -> List[Dict[str, Any]]:
            for banda in bandas:
                banda["exato"] = exato
                banda["proximo"] = proximo
            return bandas

        for relax, exato in ((False, True), (True, False)):
            bandas = self._solve_with_relax(base_prefs, base_prefs, lugares, relax, max_resultados)
            if bandas:
                return marcar(bandas, exato, True)

        # nível 3: descobrir, com a consistência de nó, que lugares ficaram sem candidatos
        chaves = {_instrument_key(role) for role in roles}
        livres = frozenset(_instrument_key(role) for role in self.papeis_sem_candidatos(base_prefs))
        if livres and livres != chaves:
            bandas = self._solve_with_relax(base_prefs, base_prefs, lugares, True, max_resultados, livres)
            if bandas:
                return marcar(bandas, False, True)

        # nível 4
        so_instrumentos = Preferencias(politica_localizacao_banda="livre")
        return marcar(
            self._solve_with_relax(so_instrumentos, base_prefs, lugares, True, max_resultados), False, False
        )

    # Diagnóstico para quando não sai banda nenhuma: com a consistência de nó vemos quantas pessoas
    # diferentes sobram para cada instrumento. Se houver menos pessoas do que lugares (por exemplo dois
    # bateristas pedidos e só um registado), avisamos o utilizador.
    def faltas(self, base_prefs: Preferencias) -> List[Dict[str, Any]]:
        so_instrumentos = Preferencias(politica_localizacao_banda="livre")
        csp, variaveis = self._construir_csp(so_instrumentos, self._lugares(base_prefs), True, base_prefs.perfil)
        dominios = csp.consistencia_de_no()

        por_instrumento: Dict[str, List[str]] = {}
        for var, (papel, tipo) in variaveis.items():
            if tipo == "livre":
                por_instrumento.setdefault(_instrument_key(papel), []).append(var)

        out: List[Dict[str, Any]] = []
        for lugares in por_instrumento.values():
            pessoas = {self.m.musicos[i].get("id") for var in lugares for i in dominios[var]}
            if len(pessoas) < len(lugares):
                out.append({"instrumento": variaveis[lugares[0]][0], "pedidos": len(lugares), "disponiveis": len(pessoas)})
        return out

    # Diagnóstico: lugares cujo domínio fica vazio depois da consistência de nó, ou seja, ninguém cumpre o pedido para esse lugar.
    def papeis_sem_candidatos(self, base_prefs: Preferencias) -> List[str]:
        csp, variaveis = self._construir_csp(base_prefs, self._lugares(base_prefs), True, base_prefs.perfil)
        dominios = csp.consistencia_de_no()
        out: List[str] = []
        vistos: set = set()
        for var, (papel, tipo) in variaveis.items():
            chave = _instrument_key(papel)
            if tipo != "livre" or chave in vistos:
                continue
            vistos.add(chave)
            if not dominios[var]:
                out.append(papel)
        return out

    # Como o utilizador aparece dentro da banda proposta.
    def _membro_utilizador(self, papel: str, perfil: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        perfil = perfil or {}
        nome_instrumento, anos, _ = self.m._melhor_instrumento(perfil, papel) if perfil else (None, None, 0.0)
        return {
            "papel": papel,
            "tu": True,
            "id": perfil.get("id"),
            "nome": perfil.get("nome"),
            "localizacao": perfil.get("localizacao"),
            "instrumento_escolhido": nome_instrumento or papel,
            "instrumento_anos": anos,
            "cumpre_criterios": True,
        }

    # Resolve o CSP da banda num nível de relaxamento e devolve as melhores bandas, já prontas para mostrar.
    def _solve_with_relax(
        self,
        prefs_restricoes: Preferencias,
        base_prefs: Preferencias,
        lugares: List[Tuple[str, str]],
        relax: bool,
        max_solutions: int,
        livres: frozenset = frozenset(),
    ) -> List[Dict[str, Any]]:
        musicos = self.m.musicos
        perfil = base_prefs.perfil
        csp, variaveis = self._construir_csp(prefs_restricoes, lugares, relax, perfil, livres)
        a_preencher = [var for var, (_, tipo) in variaveis.items() if tipo == "livre"]
        prefs_papel = {var: self._prefs_para_role(base_prefs, variaveis[var][0]) for var in a_preencher}

        # o teu perfil entra na função objetivo: as tuas características e a tua localização
        caracteristicas_perfil = {_normalize(c) for c in ((perfil or {}).get("caracteristicas") or []) if c}
        local_perfil = _normalize((perfil or {}).get("localizacao") or "")
        fixos = [local_perfil] if local_perfil else []
        locais = [_normalize(mus.get("localizacao") or "") for mus in musicos]

        # afinidade com o teu perfil: proporção das tuas características que o músico também tem
        def afinidade(i: int) -> float:
            if not caracteristicas_perfil:
                return 0.0
            comuns = caracteristicas_perfil & set(self.m._caracteristicas_normalizadas(musicos[i]))
            return PESO_PERFIL_BANDA * len(comuns) / len(caracteristicas_perfil)

        cache_pontuacao: Dict[Tuple[str, int], float] = {}

        # pontuação de um músico num lugar (guardada em cache porque o branch & bound pede-a muitas vezes)
        def pontuacao(var: str, indice: int) -> float:
            chave = (var, indice)
            if chave not in cache_pontuacao:
                cache_pontuacao[chave] = self._score_role(musicos[indice], prefs_papel[var])[0] + afinidade(indice)
            return cache_pontuacao[chave]

        # pequeno bónus quando todos são do distrito pedido (política todos_igual)
        bonus_localizacao = (
            0.75 if base_prefs.localizacao and base_prefs.politica_localizacao_banda == "todos_igual" else 0.0
        )
        # a coesão conta todos os pares de membros, contigo incluído
        n_membros = len(a_preencher) + len(fixos)
        coesao_ativa = base_prefs.politica_localizacao_banda == "proximos" and n_membros > 1
        total_pares = n_membros * (n_membros - 1) / 2

        # coesão de uma banda completa: média da proximidade entre todos os pares de membros
        def coesao(locais_escolhidos: List[str]) -> float:
            soma = sum(_proximidade_locais(a, b) for a, b in combinations(fixos + locais_escolhidos, 2))
            return PESO_COESAO_BANDA * soma / total_pares

        # limite superior da coesão para uma banda ainda incompleta:
        #   pares já escolhidos contam com o valor real; entre um escolhido e um lugar por preencher conta a
        #   melhor proximidade possível no domínio desse lugar; entre dois lugares por preencher conta 1 (o máximo)
        def coesao_maxima(atribuicao: Dict[str, Any], dominios: Dict[str, List[Any]]) -> float:
            if not coesao_ativa:
                return 0.0
            presentes = fixos + [locais[atribuicao[var]] for var in a_preencher if var in atribuicao]
            em_aberto = [var for var in a_preencher if var not in atribuicao]
            soma = sum(_proximidade_locais(a, b) for a, b in combinations(presentes, 2))
            for var in em_aberto:
                possiveis = {locais[i] for i in dominios[var] if isinstance(i, int)}
                for a in presentes:
                    soma += max((_proximidade_locais(a, local) for local in possiveis), default=0.0)
            soma += len(em_aberto) * (len(em_aberto) - 1) / 2
            return PESO_COESAO_BANDA * soma / total_pares

        # função objetivo de uma banda completa
        def objetivo(solucao: Dict[str, Any]) -> float:
            total = sum(pontuacao(var, solucao[var]) for var in a_preencher)
            if bonus_localizacao and all(
                self.m._localizacao_match(musicos[solucao[var]], base_prefs.localizacao, relax=True)
                for var in a_preencher
            ):
                total += bonus_localizacao
            if coesao_ativa:
                total += coesao([locais[solucao[var]] for var in a_preencher])
            return total

        # limite superior otimista para o branch & bound: o melhor que ainda se pode conseguir a partir desta banda parcial
        def limite(atribuicao: Dict[str, Any], dominios: Dict[str, List[Any]]) -> float:
            return (
                bonus_localizacao
                + coesao_maxima(atribuicao, dominios)
                + sum(
                    pontuacao(var, atribuicao[var])
                    if var in atribuicao
                    else max((pontuacao(var, i) for i in dominios[var] if isinstance(i, int)), default=float("-inf"))
                    for var in a_preencher
                )
            )

        # experimentamos primeiro os músicos melhores e mais perto dos que já estão escolhidos, para encontrar boas bandas cedo
        def ordenar(var: str, valores: List[Any], atribuicao: Dict[str, Any]) -> List[Any]:
            if var not in prefs_papel:
                return valores
            presentes = fixos + [locais[atribuicao[v]] for v in a_preencher if v in atribuicao]

            def prioridade(i: int) -> float:
                valor = pontuacao(var, i)
                if coesao_ativa and presentes:
                    valor += PESO_COESAO_BANDA * sum(_proximidade_locais(locais[i], a) for a in presentes) / len(presentes)
                return valor

            return sorted(valores, key=prioridade, reverse=True)

        # as mesmas pessoas em lugares trocados contam como a mesma banda
        melhores = csp.otimizar(
            objetivo=objetivo,
            k=max_solutions,
            limite_superior=limite,
            ordenar_valores=ordenar,
            identificar=lambda solucao: frozenset(musicos[solucao[var]].get("id") for var in a_preencher),
        )

        # a partir daqui só se prepara cada banda para mostrar na página
        out: List[Dict[str, Any]] = []
        for score, solucao in melhores:
            membros: List[Dict[str, Any]] = []
            for var, (papel, tipo) in variaveis.items():
                if tipo == TU:
                    membros.append(self._membro_utilizador(papel, perfil))
                    continue
                if tipo == OCUPADO:
                    membros.append(
                        {"papel": papel, "ocupado": True, "id": None, "nome": None, "localizacao": None, "cumpre_criterios": True}
                    )
                    continue
                mus = musicos[solucao[var]]
                role_p = prefs_papel[var]
                inst_nome, inst_anos, inst_score = self.m._melhor_instrumento(mus, role_p.instrumento)
                membros.append(
                    {
                        "papel": papel,
                        "id": mus.get("id"),
                        "nome": mus.get("nome"),
                        "localizacao": mus.get("localizacao"),
                        "instrumento_escolhido": inst_nome,
                        "instrumento_anos": inst_anos,
                        "instrumento_score": inst_score,
                        "instrumentos": mus.get("instrumentos", []),
                        "caracteristicas": mus.get("caracteristicas", []),
                        "detalhes": self._score_role(mus, role_p)[1],
                        "afinidade_perfil": round(afinidade(solucao[var]), 3),
                        "cumpre_criterios": self._role_ok(mus, role_p, relax=True),
                    }
                )

            out.append(
                {
                    "tipo": "banda",
                    "score": round(float(score), 3),
                    "instrumentos_requeridos": [variaveis[var][0] for var in a_preencher],
                    "politica_localizacao_banda": base_prefs.politica_localizacao_banda,
                    "localizacao_alvo": base_prefs.localizacao,
                    "membros": membros,
                }
            )

        return out

# =====================================================================================
# CSP para procurar uma banda já formada para integrar
# =====================================================================================
# É o mesmo modelo da procura de um músico, mas a variável principal é "banda" e só entram a
# localização e as características (as bandas não têm instrumentos registados).
class BandasExistentesSolver:
    def __init__(self, bandas: Iterable[Dict[str, Any]]) -> None:
        self.bandas = list(bandas)
        self.m = Matcher(self.bandas)

    def solve(self, prefs: Preferencias, max_resultados: int) -> List[Dict[str, Any]]:
        prefs_banda = Preferencias(localizacao=prefs.localizacao, caracteristicas=list(prefs.caracteristicas))
        por_id = {banda.get("id"): banda for banda in self.bandas}
        resultados = CSP1Solver(self.m, variavel="banda").solve(prefs_banda, max_resultados)
        return [
            {
                "tipo": "banda_existente",
                "id": r["id"],
                "nome": r["nome"],
                "localizacao": r["localizacao"],
                "score": r["score"],
                "exato": r["exato"],
                "proximo": r["proximo"],
                "localizacao_ratio": r["localizacao_ratio"],
                "detalhes": r["detalhes"],
                "caracteristicas": r["caracteristicas"],
                "desde": por_id.get(r["id"], {}).get("desde"),
            }
            for r in resultados
        ]

# Escolhe o solver certo: se há lugares para preencher é uma banda, senão é um músico.
class CSPMatcherFacade(Matcher):
    def resolver(self, prefs: Preferencias, max_resultados: int = 5) -> List[Dict[str, Any]]:
        if prefs.instrumentos_requeridos:
            band_solver = BandCSPSolver(self)
            return band_solver.solve(prefs, max_resultados=max_resultados)

        solver1 = CSP1Solver(self)
        return solver1.solve(prefs, max_resultados=max_resultados)

# =====================================================================================
# Juntar o pedido: texto, chips, conversa e perfil
# =====================================================================================
#
# Converte o JSON que vem do controller num objeto Preferencias.
def _preferencias_from_payload(pref_data: Dict[str, Any]) -> Preferencias:
    anos_pref = _parse_int(pref_data.get("anos_experiencia"))

    instrumentos_requeridos = pref_data.get("instrumentos_requeridos") or []
    banda = pref_data.get("banda") or {}
    if banda and not instrumentos_requeridos:
        instrumentos_requeridos = banda.get("instrumentos") or banda.get("instrumentos_requeridos") or []

    requisitos_por_instrumento = pref_data.get("requisitos_por_instrumento") or {}
    if banda and not requisitos_por_instrumento:
        requisitos_por_instrumento = banda.get("requisitos_por_instrumento") or {}

    politica_loc = pref_data.get("politica_localizacao_banda")
    if banda and not politica_loc:
        politica_loc = banda.get("politica_localizacao_banda")

    p = Preferencias(
        instrumento=pref_data.get("instrumento"),
        anos_experiencia=anos_pref,
        localizacao=pref_data.get("localizacao"),
        caracteristicas=pref_data.get("caracteristicas") or [],
        instrumentos_requeridos=instrumentos_requeridos or [],
        requisitos_por_instrumento=requisitos_por_instrumento or {},
        politica_localizacao_banda=(politica_loc or "proximos"),
        lugares=[tuple(lugar) for lugar in (pref_data.get("lugares") or []) if len(lugar) == 2],
        perfil=pref_data.get("perfil") if isinstance(pref_data.get("perfil"), dict) else None,
    )
    return p


# Junta listas de texto sem repetir nada (ignora maiúsculas e acentos).
def _unir_sem_repetir(*listas: Optional[List[str]]) -> List[str]:
    vistos: set = set()
    out: List[str] = []
    for lista in listas:
        for item in lista or []:
            chave = _normalize(item)
            if chave and chave not in vistos:
                vistos.add(chave)
                out.append(item)
    return out


# Junta instrumentos de várias origens. Para cada instrumento fica a maior quantidade pedida numa das origens.
def _unir_instrumentos(*origens: List[str]) -> List[str]:
    quantidades: Dict[str, int] = {}
    nomes: Dict[str, str] = {}
    for origem in origens:
        parcial: Dict[str, int] = {}
        for nome in origem:
            chave = _instrument_key(nome or "")
            if not chave:
                continue
            nomes.setdefault(chave, nome)
            parcial[chave] = parcial.get(chave, 0) + 1
        for chave, n in parcial.items():
            quantidades[chave] = max(quantidades.get(chave, 0), n)
    return [nomes[chave] for chave, n in quantidades.items() for _ in range(n)][:MAX_PAPEIS_BANDA]


# Junta o que veio explícito (as características escolhidas nos chips) com o que se percebeu do texto.
# O explícito ganha na localização e nos anos; as características somam-se.
def _combinar_preferencias(explicitas: Dict[str, Any], interpretado: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    pref = dict(explicitas)
    texto = interpretado or {}

    if pref.get("localizacao") is None and texto.get("localizacao"):
        pref["localizacao"] = texto["localizacao"]
    if pref.get("anos_experiencia") is None and texto.get("anos_experiencia") is not None:
        pref["anos_experiencia"] = texto["anos_experiencia"]
    pref["caracteristicas"] = _unir_sem_repetir(pref.get("caracteristicas"), texto.get("caracteristicas"))

    if not pref.get("instrumentos_requeridos") and not pref.get("banda"):
        instrumentos = _unir_instrumentos(
            [pref["instrumento"]] if pref.get("instrumento") else [],
            list(texto.get("instrumentos") or []),
        )
        pref["instrumento"] = instrumentos[0] if len(instrumentos) == 1 else None
        pref["instrumentos_requeridos"] = instrumentos if len(instrumentos) > 1 else []

    return pref


# Decide se a mensagem continua a banda que estava a ser montada na conversa. Continua quando não há
# texto (só chips), quando é "e um pianista"/"também...", ou quando a frase não traz um pedido próprio
# ("sou de Coimbra", "já tenho baterista"). "Quero formar uma banda" começa sempre do zero.
def _contexto_banda(contexto: Any, interpretado: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not isinstance(contexto, dict) or contexto.get("modo") != "formar_banda":
        return None
    if not interpretado:
        return contexto
    if interpretado.get("nova_banda"):
        return None
    if interpretado.get("intencao") == "formar_banda" or interpretado.get("aditivo"):
        return contexto
    return None if interpretado.get("explicita") else contexto


# Tira dos lugares pedidos os que o utilizador disse que já tem.
def _retirar_ocupados(papeis: List[str], ocupados: List[str]) -> List[str]:
    restantes = list(papeis)
    for nome in ocupados:
        chave = _instrument_key(nome)
        posicao = next((i for i, papel in enumerate(restantes) if _instrument_key(papel) == chave), None)
        if posicao is not None:
            restantes.pop(posicao)
    return restantes


# Primeira palavra da chave do instrumento ("guitarra eletrica" -> "guitarra"), para comparar com a formação base.
def _chave_base(nome: str) -> str:
    return _instrument_key(nome or "").split(" ")[0]


# Instrumentos que o utilizador tem no perfil.
def _instrumentos_do_perfil(perfil: Optional[Dict[str, Any]]) -> List[str]:
    nomes = [entrada.get("nome") for entrada in ((perfil or {}).get("instrumentos") or []) if entrada.get("nome")]
    return _unir_por_instrumento(nomes)


# Constrói a lista de lugares da banda, cada um com o seu tipo. Estes lugares vão ser as variáveis do CSP.
#   formação base   -> voz, guitarra, baixo e bateria: os que tocas ficam "tu", os que já tens ficam
#                      "ocupado" e os restantes ficam livres
#   pedido explícito ("baterista e baixista") -> os teus instrumentos, os ocupados e os pedidos
def _lugares_da_banda(
    formacao_base: bool,
    teus: List[str],
    ocupados: List[str],
    pedidos: List[str],
    extras: List[str],
    instrumentos_conhecidos: List[str],
) -> List[Tuple[str, str]]:
    if not formacao_base:
        livres = _retirar_ocupados(pedidos, ocupados)[:MAX_PAPEIS_BANDA]
        return [(nome, TU) for nome in teus] + [(nome, OCUPADO) for nome in ocupados] + [(nome, "livre") for nome in livres]

    if not teus and not ocupados:
        return []
    chaves_teus = {_chave_base(nome) for nome in teus}
    chaves_ocupadas = {_chave_base(nome) for nome in ocupados}
    lugares: List[Tuple[str, str]] = []
    for chave in FORMACAO_BASE:
        tipo = TU if chave in chaves_teus else OCUPADO if chave in chaves_ocupadas else "livre"
        lugares.append((_nome_instrumento(chave, instrumentos_conhecidos), tipo))
    lugares += [(nome, TU) for nome in teus if _chave_base(nome) not in FORMACAO_BASE]
    lugares += [
        (nome, OCUPADO)
        for nome in ocupados
        if _chave_base(nome) not in FORMACAO_BASE and _chave_base(nome) not in chaves_teus
    ]
    lugares += [(nome, "livre") for nome in extras]
    return lugares


# Prepara o pedido de formação de banda juntando três fontes, por esta ordem de prioridade:
#   1) o que o utilizador escreveu agora
#   2) o que já tinha dito antes na conversa (contexto)
#   3) o perfil dele (instrumentos e distrito)
# Devolve as preferências, o contexto para a próxima mensagem e o que foi buscado ao perfil.
def _preparar_banda(
    pref: Dict[str, Any],
    interpretado: Optional[Dict[str, Any]],
    contexto: Optional[Dict[str, Any]],
    instrumentos_conhecidos: List[str],
    perfil: Optional[Dict[str, Any]],
) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    texto = interpretado or {}
    anterior = contexto or {}
    pref = dict(pref)

    # o que já tinha sido dito na conversa vale enquanto não for substituído
    if anterior:
        if pref.get("localizacao") is None:
            pref["localizacao"] = anterior.get("localizacao")
        if pref.get("anos_experiencia") is None:
            pref["anos_experiencia"] = _parse_int(anterior.get("anos_experiencia"))
        pref["caracteristicas"] = _unir_sem_repetir(anterior.get("caracteristicas"), pref.get("caracteristicas"))
    localizacao_pedida = pref.get("localizacao")

    # instrumentos do utilizador e lugares pedidos nesta mensagem
    teus_texto = _unir_por_instrumento(anterior.get("teus"), texto.get("proprios"))
    novos = list(pref.get("instrumentos_requeridos") or []) or ([pref["instrumento"]] if pref.get("instrumento") else [])
    aditivo = bool(novos and texto.get("aditivo") and anterior)

    # um pedido novo de instrumentos substitui o anterior; "e um pianista" acrescenta
    if novos and not aditivo:
        formacao_base, pedidos, extras = False, novos, []
        ocupados = list(texto.get("ocupados") or [])
    else:
        formacao_base = bool(anterior.get("formacao_base", True)) if anterior else True
        pedidos = list(anterior.get("pedidos") or [])
        extras = list(anterior.get("extras") or [])
        ocupados = _unir_por_instrumento(anterior.get("ocupados"), texto.get("ocupados"))
        if aditivo and formacao_base:
            extras = (extras + novos)[:MAX_PAPEIS_BANDA]
        elif aditivo:
            pedidos = (pedidos + novos)[:MAX_PAPEIS_BANDA]

    # se não disseste o teu instrumento, vamos buscá-lo ao perfil
    instrumentos_perfil = _instrumentos_do_perfil(perfil)
    teus = teus_texto or instrumentos_perfil
    lugares = _lugares_da_banda(formacao_base, teus, ocupados, pedidos, extras, instrumentos_conhecidos)

    # guardamos o que veio do perfil para a resposta poder dizer isso ao utilizador
    do_perfil: Dict[str, Any] = {"instrumentos": [], "localizacao": None}
    if not teus_texto and instrumentos_perfil and any(tipo == TU for _, tipo in lugares):
        do_perfil["instrumentos"] = instrumentos_perfil
    if pref.get("localizacao") is None and perfil and perfil.get("localizacao"):
        pref["localizacao"] = perfil["localizacao"]
        do_perfil["localizacao"] = perfil["localizacao"]

    pref["instrumento"] = None
    pref["instrumentos_requeridos"] = [papel for papel, tipo in lugares if tipo == "livre"]
    pref["lugares"] = lugares
    # se disseste onde estás, és tu que estás aí (conta para a coesão da banda)
    pref["perfil"] = {**perfil, "localizacao": pref.get("localizacao") or perfil.get("localizacao")} if perfil else None
    # o contexto só guarda o que foi dito na conversa; o perfil volta a ser lido em cada pedido
    novo_contexto = {
        "modo": "formar_banda",
        "formacao_base": formacao_base,
        "pedidos": pedidos,
        "extras": extras,
        "teus": teus_texto,
        "ocupados": ocupados,
        "localizacao": localizacao_pedida,
        "anos_experiencia": pref.get("anos_experiencia"),
        "caracteristicas": list(pref.get("caracteristicas") or []),
    }
    return pref, novo_contexto, do_perfil


# =====================================================================================
# Ponto de entrada
# =====================================================================================
#
# Exemplo usado quando o script corre sem dados (dá jeito para testar à mão: python3 ai.py).
def _exemplo() -> Dict[str, Any]:
    MUSICOS_EXEMPLO = [
        {
            "id": 1,
            "nome": "Ana",
            "localizacao": "Lisboa",
            "caracteristicas": ["Pontual", "Criativo", "Rock"],
            "instrumentos": [{"nome": "Guitarra", "anos_experiencia": 4, "nivel": "avancado"}],
        },
        {
            "id": 2,
            "nome": "Bruno",
            "localizacao": "Porto",
            "caracteristicas": ["Improvisador", "Jazz", "Criativo"],
            "instrumentos": [{"nome": "Saxofone", "anos_experiencia": 6, "nivel": "avancado"}],
        },
        {
            "id": 3,
            "nome": "Carla",
            "localizacao": "Lisboa",
            "caracteristicas": ["Pontual", "Pop", "Vocalista"],
            "instrumentos": [{"nome": "Voz", "anos_experiencia": 2, "nivel": "intermedio"}],
        },
        {
            "id": 4,
            "nome": "Duarte",
            "localizacao": "Lisboa",
            "caracteristicas": ["Pontual", "Rock"],
            "instrumentos": [{"nome": "Bateria", "anos_experiencia": 3, "nivel": "intermedio"}],
        },
        {
            "id": 5,
            "nome": "Eva",
            "localizacao": "Lisboa",
            "caracteristicas": ["Criativo", "Rock"],
            "instrumentos": [{"nome": "Baixo", "anos_experiencia": 3, "nivel": "intermedio"}],
        },
    ]

    preferencias = Preferencias(
        localizacao="Lisboa",
        caracteristicas=["Rock", "Pontual"],
        instrumentos_requeridos=["Bateria", "Baixo", "Guitarra", "Voz"],
        requisitos_por_instrumento={
            "bateria": {"anos_experiencia": 3},
            "baixo": {"anos_experiencia": 3},
        },
        politica_localizacao_banda="todos_igual",
    )

    matcher = CSPMatcherFacade(MUSICOS_EXEMPLO)
    sugestoes = matcher.resolver(preferencias, max_resultados=5)
    return {"resultados": sugestoes}


# Recebe o pedido completo e devolve a resposta:
#   1. ler o texto
#   2. juntar com os chips, a conversa e o perfil
#   3. decidir que tipo de problema é
#   4. montar e resolver o CSP certo
#   5. acrescentar os diagnósticos (também feitos com o CSP) quando faltam candidatos
def responder(payload: Dict[str, Any]) -> Dict[str, Any]:
    musicos = payload.get("musicos", [])
    pref_data = dict(payload.get("preferencias", {}) or {})
    max_resultados = payload.get("max_resultados", 10)

    # 1. ler o texto
    texto = payload.get("texto")
    interpretado = None
    if texto:
        interpretado = interpretar_texto(
            texto,
            instrumentos_conhecidos=payload.get("instrumentos_conhecidos") or [],
            caracteristicas_conhecidas=payload.get("caracteristicas_conhecidas") or [],
        )

    # 2. juntar tudo
    pref_data = _combinar_preferencias(pref_data, interpretado)
    intencao = (interpretado or {}).get("intencao", "musico")
    contexto = _contexto_banda(payload.get("contexto"), interpretado)
    perfil = payload.get("perfil") if isinstance(payload.get("perfil"), dict) else None
    fluxo_banda = intencao == "formar_banda" or contexto is not None
    novo_contexto = None
    do_perfil = None
    if fluxo_banda:
        pref_data, novo_contexto, do_perfil = _preparar_banda(
            pref_data, interpretado, contexto, payload.get("instrumentos_conhecidos") or [], perfil
        )
    preferencias = _preferencias_from_payload(pref_data)

    # 3. tipo de problema
    if fluxo_banda or preferencias.instrumentos_requeridos:
        modo = "formar_banda"
    elif intencao == "integrar_banda":
        modo = "bandas_existentes"
    else:
        modo = "musico"

    # 4. montar e resolver o CSP
    matcher = CSPMatcherFacade(musicos)
    if modo == "bandas_existentes":
        sugestoes = BandasExistentesSolver(payload.get("bandas", [])).solve(preferencias, max_resultados)
        efetivas: Dict[str, Any] = {
            "localizacao": preferencias.localizacao,
            "caracteristicas": list(preferencias.caracteristicas),
        }
    else:
        # não há lugares para preencher: a página pede ao utilizador o instrumento que toca
        if modo == "formar_banda" and not preferencias.instrumentos_requeridos:
            sugestoes = []
        else:
            limite = payload.get("max_bandas", 5) if modo == "formar_banda" else max_resultados
            sugestoes = matcher.resolver(preferencias, max_resultados=limite)
        efetivas = {
            "instrumento": preferencias.instrumento,
            "instrumentos": list(preferencias.instrumentos_requeridos)
            or ([preferencias.instrumento] if preferencias.instrumento else []),
            "anos_experiencia": preferencias.anos_experiencia,
            "localizacao": preferencias.localizacao,
            "caracteristicas": list(preferencias.caracteristicas),
        }
        if fluxo_banda:
            efetivas["lugares"] = [{"papel": papel, "tipo": tipo} for papel, tipo in preferencias.lugares]
            efetivas["do_perfil"] = do_perfil

    # 5. diagnósticos para explicar porque é que faltam candidatos
    resposta: Dict[str, Any] = {"modo": modo, "resultados": sugestoes, "preferencias_efetivas": efetivas}
    if modo == "formar_banda" and not preferencias.instrumentos_requeridos:
        resposta["sem_instrumentos"] = True
    elif modo == "formar_banda" and not sugestoes:
        resposta["faltas"] = BandCSPSolver(matcher).faltas(preferencias)
    elif modo == "formar_banda" and not sugestoes[0]["exato"]:
        resposta["papeis_sem_candidatos"] = BandCSPSolver(matcher).papeis_sem_candidatos(preferencias)
    if novo_contexto is not None:
        resposta["contexto"] = novo_contexto
    if interpretado is not None:
        resposta["interpretado"] = interpretado
    return resposta


# O controller (Node) manda o pedido em JSON pelo stdin e lê a resposta no stdout.
if __name__ == "__main__":
    try:
        entrada = json.load(sys.stdin)
    except Exception:
        entrada = None
    json.dump(responder(entrada) if entrada else _exemplo(), sys.stdout, ensure_ascii=False)
