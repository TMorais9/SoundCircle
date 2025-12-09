from __future__ import annotations

from dataclasses import dataclass, field
from difflib import SequenceMatcher
import json
import sys
from typing import Any, Dict, Iterable, List, Optional, Tuple
import unicodedata


def _normalize(text: str) -> str:
    """Lowercase and strip accents to compare values reliably."""
    nfkd = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()


def _safe_ratio(a: str, b: str) -> float:
    """Similarity ratio between two strings (0-1)."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, _normalize(a), _normalize(b)).ratio()


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
        alvo = _normalize(instrumento)
        for entrada in musico.get("instrumentos", []) or []:
            if _normalize(entrada.get("nome", "")) == alvo:
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
        alvo = _normalize(instrumento)
        for entrada in musico.get("instrumentos", []) or []:
            nome_norm = _normalize(entrada.get("nome", ""))
            if relax:
                if alvo in nome_norm or nome_norm in alvo:
                    return True
                if _safe_ratio(alvo, nome_norm) >= 0.7:
                    return True
            else:
                if nome_norm == alvo:
                    return True
        return False

    def _localizacao_match(self, musico: Dict[str, Any], localizacao: str, relax: bool) -> bool:
        ratio = _safe_ratio(musico.get("localizacao", ""), localizacao)
        return ratio >= (0.55 if relax else 0.75)

    def _caracteristicas_match(
        self, musico: Dict[str, Any], desejadas: List[str], relax: bool
    ) -> Tuple[int, int]:
        desejadas_norm = {_normalize(c) for c in desejadas if c}
        if not desejadas_norm:
            return (0, 0)
        existentes = set(self._caracteristicas_normalizadas(musico))
        intersecao = existentes.intersection(desejadas_norm)
        if relax:
            return (len(intersecao), len(desejadas_norm))
        return (len(intersecao), len(desejadas_norm)) if len(intersecao) >= 1 else (0, len(desejadas_norm))

    def _satisfaz_constraints(self, musico: Dict[str, Any], prefs: Preferencias, relax: bool) -> bool:
        if prefs.instrumento and not self._instrumento_match(musico, prefs.instrumento, relax):
            return False

        if prefs.localizacao and not self._localizacao_match(musico, prefs.localizacao, relax):
            return False

        if prefs.caracteristicas:
            match_count, total = self._caracteristicas_match(musico, prefs.caracteristicas, relax)
            minimo = 1 if relax else max(1, round(total * 0.5))
            if match_count < minimo:
                return False

        if prefs.anos_experiencia is not None:
            anos_alvo = prefs.anos_experiencia
            anos = (
                self._anos_por_instrumento(musico, prefs.instrumento)
                if prefs.instrumento
                else self._anos_globais(musico)
            )
            if anos is None:
                return relax  # aceita em modo relaxado mesmo sem anos declarados
            if relax:
                return abs(anos - anos_alvo) <= 3 or anos >= anos_alvo
            return anos >= anos_alvo

        return True

    def _pontuacao(self, musico: Dict[str, Any], prefs: Preferencias) -> Dict[str, float]:
        score = 0.0
        detalhes = {}

        if prefs.instrumento:
            instrument_match = self._instrumento_match(musico, prefs.instrumento, relax=True)
            detalhes["instrumento"] = 1.0 if instrument_match else 0.0
            score += 3.0 * detalhes["instrumento"]

        if prefs.anos_experiencia is not None:
            anos = (
                self._anos_por_instrumento(musico, prefs.instrumento)
                if prefs.instrumento
                else self._anos_globais(musico)
            )
            if anos is not None:
                diff = abs(anos - prefs.anos_experiencia)
                detalhes["anos_experiencia"] = max(0.0, 1.0 - (diff / 5.0))
                score += 2.0 * detalhes["anos_experiencia"]

        if prefs.localizacao:
            ratio = _safe_ratio(musico.get("localizacao", ""), prefs.localizacao)
            detalhes["localizacao"] = ratio
            score += 2.0 * ratio

        if prefs.caracteristicas:
            match_count, total = self._caracteristicas_match(musico, prefs.caracteristicas, relax=True)
            detalhes["caracteristicas"] = (match_count / total) if total else 0.0
            score += 3.0 * detalhes["caracteristicas"]

        detalhes["score_total"] = round(score, 3)
        return detalhes

    def resolver(self, prefs: Preferencias, max_resultados: int = 5) -> List[Dict[str, Any]]:
        """Resolve CSP e devolve lista ordenada por aderencia."""
        candidatos: List[Tuple[float, Dict[str, Any], Dict[str, float], bool]] = []

        for musico in self.musicos:
            exato = self._satisfaz_constraints(musico, prefs, relax=False)
            aproximado = False

            if not exato:
                aproximado = self._satisfaz_constraints(musico, prefs, relax=True)
                if not aproximado:
                    continue

            detalhes = self._pontuacao(musico, prefs)
            candidatos.append((detalhes["score_total"], musico, detalhes, exato))

        candidatos.sort(key=lambda item: item[0], reverse=True)

        resultados = []
        for score, musico, detalhes, exato in candidatos[:max_resultados]:
            resultados.append(
                {
                    "id": musico.get("id"),
                    "nome": musico.get("nome"),
                    "localizacao": musico.get("localizacao"),
                    "score": score,
                    "exato": exato,
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
    max_resultados = payload.get("max_resultados", 5)

    preferencias = Preferencias(
        instrumento=pref_data.get("instrumento"),
        anos_experiencia=pref_data.get("anos_experiencia"),
        localizacao=pref_data.get("localizacao"),
        caracteristicas=pref_data.get("caracteristicas") or [],
    )

    matcher = CSPMatcher(musicos)
    sugestoes = matcher.resolver(preferencias, max_resultados=max_resultados)
    json.dump({"resultados": sugestoes}, sys.stdout, ensure_ascii=False)
