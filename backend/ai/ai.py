from __future__ import annotations

from dataclasses import dataclass, field
import json
import sys
from typing import Any, Dict, Iterable, List, Optional, Tuple
import unicodedata
import math
from difflib import SequenceMatcher


def _normalize(text: str) -> str:
    """Lowercase and strip accents to compare values reliably."""
    nfkd = unicodedata.normalize("NFKD", text or "")
    cleaned = "".join(c for c in nfkd if not unicodedata.combining(c)).lower()
    cleaned = cleaned.replace("-", " ").replace("_", " ")
    return " ".join(cleaned.split())


def _safe_ratio(a: str, b: str) -> float:
    """Similarity ratio between two strings (0-1)."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, _normalize(a), _normalize(b)).ratio()


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
}


def _instrument_key(name: str) -> str:
    norm = _normalize(name)
    return INSTRUMENT_ALIASES.get(norm, norm)


def _parse_int(value: Any) -> Optional[int]:
    try:
        parsed = int(value)
        return parsed
    except (TypeError, ValueError):
        return None


@dataclass
class Preferencias:
    instrumento: Optional[str] = None
    anos_experiencia: Optional[int] = None
    localizacao: Optional[str] = None
    caracteristicas: List[str] = field(default_factory=list)


class CSPMatcher:
    def __init__(self, musicos: Iterable[Dict[str, Any]]) -> None:
        self.musicos = list(musicos)

    def _anos_por_instrumento(self, musico: Dict[str, Any], instrumento: str) -> Optional[int]:
        alvo = _instrument_key(instrumento)
        for entrada in musico.get("instrumentos", []) or []:
            if _instrument_key(entrada.get("nome", "")) == alvo:
                anos = entrada.get("anos_experiencia")
                if anos is None:
                    continue
                try:
                    valor = int(anos)
                    return valor if valor >= 0 else None
                except (TypeError, ValueError):
                    continue
        return None

    def _anos_globais(self, musico: Dict[str, Any]) -> Optional[int]:
        """Fallback when nao existe anos_experiencia por instrumento."""
        anos = musico.get("anos_experiencia")
        try:
            valor = int(anos)
            return valor if valor >= 0 else None
        except (TypeError, ValueError):
            return None

    def _caracteristicas_normalizadas(self, musico: Dict[str, Any]) -> List[str]:
        caracs = musico.get("caracteristicas") or []
        return [_normalize(c) for c in caracs if c is not None]

    def _instrumento_match(self, musico: Dict[str, Any], instrumento: str, relax: bool) -> bool:
        alvo = _instrument_key(instrumento)
        for entrada in musico.get("instrumentos", []) or []:
            inst_key = _instrument_key(entrada.get("nome", ""))
            ratio = _safe_ratio(inst_key, alvo)
            if ratio >= (0.95 if not relax else 0.78):
                return True
        return False

    def _instrumento_score(self, musico: Dict[str, Any], instrumento: str) -> float:
        alvo = _instrument_key(instrumento)
        best = 0.0
        for entrada in musico.get("instrumentos", []) or []:
            inst_key = _instrument_key(entrada.get("nome", ""))
            best = max(best, _safe_ratio(inst_key, alvo))
        return best

    def _melhor_instrumento(self, musico: Dict[str, Any], instrumento: Optional[str]) -> Tuple[Optional[str], Optional[int], float]:
        """Escolhe o instrumento do músico que melhor corresponde ao pedido."""
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

    def _localizacao_match(self, musico: Dict[str, Any], localizacao: str, relax: bool) -> bool:
        ratio = _safe_ratio(musico.get("localizacao", ""), localizacao)
        return ratio >= (0.75 if relax else 0.85)

    def _caracteristicas_match(
        self, musico: Dict[str, Any], desejadas: List[str], relax: bool
    ) -> Tuple[int, int, float]:
        """Conta matches aproximados entre características desejadas e existentes."""
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
                ratio = _safe_ratio(wanted, exist)
                if ratio > best:
                    best = ratio
                    best_idx = idx
            if best_idx is not None and (best >= (0.75 if relax else 0.85)):
                match_count += 1
                usados.add(best_idx)
        total = len(desejadas_norm)
        ratio_global = match_count / total if total else 0.0
        return (match_count, total, ratio_global)

    def _satisfaz_constraints(self, musico: Dict[str, Any], prefs: Preferencias, relax: bool) -> bool:
        if prefs.instrumento and not self._instrumento_match(musico, prefs.instrumento, relax):
            return False

        if prefs.localizacao and not self._localizacao_match(musico, prefs.localizacao, relax):
            return False

        if prefs.caracteristicas:
            match_count, total, _ratio = self._caracteristicas_match(
                musico, prefs.caracteristicas, relax
            )
            minimo = 1 if relax else max(1, math.ceil(total * 0.8))
            relax_min = max(1, math.ceil(total * 0.6))
            if match_count < (relax_min if relax else minimo):
                return False

        if prefs.anos_experiencia is not None:
            anos_alvo = prefs.anos_experiencia
            anos = (
                self._anos_por_instrumento(musico, prefs.instrumento)
                if prefs.instrumento
                else self._anos_globais(musico)
            )
            if anos is None:
                return False  # sem anos_experiencia não cumpre o critério
            if relax:
                return abs(anos - anos_alvo) <= 4
            return anos == anos_alvo

        return True

    def _pontuacao(self, musico: Dict[str, Any], prefs: Preferencias) -> Dict[str, float]:
        score = 0.0
        detalhes = {}

        if prefs.instrumento:
            instrument_score = self._instrumento_score(musico, prefs.instrumento)
            detalhes["instrumento"] = round(instrument_score, 3)
            score += 4.0 * instrument_score

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
                detalhes["anos_experiencia"] = 0.2  # boost menor se não há dados
                score += 0.5 * detalhes["anos_experiencia"]

        if prefs.localizacao:
            ratio = _safe_ratio(musico.get("localizacao", ""), prefs.localizacao)
            detalhes["localizacao"] = round(ratio, 3)
            score += 2.5 * ratio

        if prefs.caracteristicas:
            match_count, total, ratio = self._caracteristicas_match(
                musico, prefs.caracteristicas, relax=True
            )
            detalhes["caracteristicas"] = round(ratio, 3)
            cobertura = (match_count / total) if total else 0.0
            score += 3.5 * max(ratio, cobertura)

        criterios = sum(
            1
            for key in ["instrumento", "anos_experiencia", "localizacao", "caracteristicas"]
            if detalhes.get(key, 0) > 0
        )
        if criterios >= 3:
            score += 0.5

        detalhes["score_total"] = round(score, 3)
        return detalhes

    def resolver(self, prefs: Preferencias, max_resultados: int = 5) -> List[Dict[str, Any]]:
        """Resolve CSP e devolve lista ordenada por aderencia."""
        candidatos: List[Tuple[float, Dict[str, Any], Dict[str, float], bool]] = []
        only_instrument = (
            bool(_normalize(prefs.instrumento or ""))
            and prefs.anos_experiencia is None
            and not prefs.localizacao
            and not (prefs.caracteristicas or [])
        )

        for musico in self.musicos:
            exato = self._satisfaz_constraints(musico, prefs, relax=False)
            aproximado = False

            if not exato:
                if only_instrument and prefs.instrumento:
                    aproximado = self._instrumento_match(musico, prefs.instrumento, relax=True)
                    if not aproximado:
                        continue
                else:
                    aproximado = self._satisfaz_constraints(musico, prefs, relax=True)
                    if not aproximado:
                        continue

            detalhes = self._pontuacao(musico, prefs)
            candidatos.append((detalhes["score_total"], musico, detalhes, exato))

        candidatos.sort(key=lambda item: (item[3], item[0]), reverse=True)

        resultados = []
        for score, musico, detalhes, exato in candidatos[:max_resultados]:
            anos_diff = None
            if prefs.anos_experiencia is not None:
                anos_candidato = (
                    self._anos_por_instrumento(musico, prefs.instrumento)
                    if prefs.instrumento
                    else self._anos_globais(musico)
                )
                if anos_candidato is not None:
                    anos_diff = abs(anos_candidato - prefs.anos_experiencia)

            local_ratio = None
            if prefs.localizacao:
                local_ratio = _safe_ratio(musico.get("localizacao", ""), prefs.localizacao)

            inst_match = True
            inst_score = None
            inst_nome = None
            inst_anos = None
            if prefs.instrumento:
                inst_score = self._instrumento_score(musico, prefs.instrumento)
                inst_match = inst_score >= 0.78
                inst_nome, inst_anos, inst_score = self._melhor_instrumento(musico, prefs.instrumento)

            resultados.append(
                {
                    "id": musico.get("id"),
                    "nome": musico.get("nome"),
                    "localizacao": musico.get("localizacao"),
                    "score": score,
                    "exato": exato,
                    "anos_diff": anos_diff,
                    "localizacao_ratio": local_ratio,
                    "instrumento_match": inst_match,
                    "instrumento_score": inst_score,
                    "instrumento_escolhido": inst_nome,
                    "instrumento_anos": inst_anos,
                    "detalhes": detalhes,
                    "instrumentos": musico.get("instrumentos", []),
                    "caracteristicas": musico.get("caracteristicas", []),
                }
            )

        return resultados


if __name__ == "__main__":
    payload = None
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = None

    if not payload:
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
        ]

        preferencias = Preferencias(
            instrumento="Guitarra",
            anos_experiencia=3,
            localizacao="Lisboa",
            caracteristicas=["Pontual", "Rock", "Criativo"],
        )
        matcher = CSPMatcher(MUSICOS_EXEMPLO)
        sugestoes = matcher.resolver(preferencias)
        print(json.dumps({"resultados": sugestoes}, ensure_ascii=False))
        sys.exit(0)

    musicos = payload.get("musicos", [])
    pref_data = payload.get("preferencias", {}) or {}
    max_resultados = payload.get("max_resultados", 10)
    anos_pref = _parse_int(pref_data.get("anos_experiencia"))

    preferencias = Preferencias(
        instrumento=pref_data.get("instrumento"),
        anos_experiencia=anos_pref,
        localizacao=pref_data.get("localizacao"),
        caracteristicas=pref_data.get("caracteristicas") or [],
    )

    matcher = CSPMatcher(musicos)
    sugestoes = matcher.resolver(preferencias, max_resultados=max_resultados)
    json.dump({"resultados": sugestoes}, sys.stdout, ensure_ascii=False)
