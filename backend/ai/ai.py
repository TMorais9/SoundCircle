from __future__ import annotations

from dataclasses import dataclass, field
import json
import sys
from typing import Any, Dict, Iterable, List, Optional, Tuple
import unicodedata
import math
from difflib import SequenceMatcher

@dataclass
class Variable:
    name: str
    domain: List[Any]


@dataclass
class Constraint:
    """Representa uma constraint sobre um subconjunto de variáveis."""

    name: str
    variables: Tuple[str, ...]
    func: Any


class SimpleCSP:
    def __init__(self) -> None:
        self.variables: List[Variable] = []
        self.constraints: List[Constraint] = []

    def add_variable(self, variable: Variable) -> None:
        self.variables.append(variable)

    def add_constraint(self, constraint: Constraint) -> None:
        self.constraints.append(constraint)

    def solve(self, max_solutions: int = 10) -> List[Dict[str, Any]]:
        ordered_vars = self.variables
        solutions: List[Dict[str, Any]] = []

        def backtrack(idx: int, assignment: Dict[str, Any]) -> None:
            if len(solutions) >= max_solutions:
                return
            if idx == len(ordered_vars):
                solutions.append(dict(assignment))
                return

            var = ordered_vars[idx]
            for value in var.domain:
                assignment[var.name] = value
                if all(
                    c.func(assignment)
                    for c in self.constraints
                    if all(v in assignment for v in c.variables)
                ):
                    backtrack(idx + 1, assignment)
            assignment.pop(var.name, None)

        backtrack(0, {})
        return solutions


def _normalize(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text or "")
    cleaned = "".join(c for c in nfkd if not unicodedata.combining(c)).lower()
    cleaned = cleaned.replace("-", " ").replace("_", " ")
    return " ".join(cleaned.split())


def _safe_ratio(a: str, b: str) -> float:
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
        return int(value)
    except (TypeError, ValueError):
        return None

@dataclass
class Preferencias:
    instrumento: Optional[str] = None
    anos_experiencia: Optional[int] = None
    localizacao: Optional[str] = None
    caracteristicas: List[str] = field(default_factory=list)

    instrumentos_requeridos: List[str] = field(default_factory=list)

    requisitos_por_instrumento: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    politica_localizacao_banda: str = "todos_igual"

class Matcher:
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
                    v = int(anos)
                    return v if v >= 0 else None
                except (TypeError, ValueError):
                    continue
        return None

    def _anos_globais(self, musico: Dict[str, Any]) -> Optional[int]:
        anos = musico.get("anos_experiencia")
        try:
            v = int(anos)
            return v if v >= 0 else None
        except (TypeError, ValueError):
            return None

    def _caracteristicas_normalizadas(self, musico: Dict[str, Any]) -> List[str]:
        caracs = musico.get("caracteristicas") or []
        return [_normalize(c) for c in caracs if c is not None]

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

    def _localizacao_match(self, musico: Dict[str, Any], localizacao: str, relax: bool) -> bool:
        ratio = _safe_ratio(musico.get("localizacao", ""), localizacao)
        return ratio >= (0.75 if relax else 0.85)

    def _satisfaz_constraints_1(self, musico: Dict[str, Any], prefs: Preferencias, relax: bool) -> bool:
        if prefs.instrumento and not self._instrumento_match(musico, prefs.instrumento, relax):
            return False

        if prefs.localizacao and not self._localizacao_match(musico, prefs.localizacao, relax):
            return False

        if prefs.caracteristicas:
            match_count, total, _ = self._caracteristicas_match(musico, prefs.caracteristicas, relax)
            minimo_exato = max(1, math.ceil(total * 0.8))
            minimo_relax = max(1, math.ceil(total * 0.6))
            if match_count < (minimo_relax if relax else minimo_exato):
                return False

        if prefs.anos_experiencia is not None:
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

        return True

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
            r = _safe_ratio(musico.get("localizacao", ""), prefs.localizacao)
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

class CSP1Solver:
    def __init__(self, matcher: Matcher) -> None:
        self.m = matcher

    def _build_constraints(
        self, prefs: Preferencias, relax: bool, only_instrument: bool
    ) -> List[Constraint]:
        constraints: List[Constraint] = []

        def c_instrumento(assign: Dict[str, Any]) -> bool:
            mus = assign.get("musico", {})
            if not prefs.instrumento:
                return True
            return self.m._instrumento_match(mus, prefs.instrumento, relax=relax)

        def c_localizacao(assign: Dict[str, Any]) -> bool:
            mus = assign.get("musico", {})
            if not prefs.localizacao:
                return True
            return self.m._localizacao_match(mus, prefs.localizacao, relax=relax)

        def c_caracs(assign: Dict[str, Any]) -> bool:
            mus = assign.get("musico", {})
            if not prefs.caracteristicas:
                return True
            match_count, total, _ = self.m._caracteristicas_match(mus, prefs.caracteristicas, relax=relax)
            minimo_exato = max(1, math.ceil(total * 0.8))
            minimo_relax = max(1, math.ceil(total * 0.6))
            return match_count >= (minimo_relax if relax else minimo_exato)

        def c_anos(assign: Dict[str, Any]) -> bool:
            mus = assign.get("musico", {})
            if prefs.anos_experiencia is None:
                return True
            anos = (
                self.m._anos_por_instrumento(mus, prefs.instrumento)
                if prefs.instrumento
                else self.m._anos_globais(mus)
            )
            if anos is None:
                return False
            if relax:
                return abs(anos - prefs.anos_experiencia) <= 4
            return anos == prefs.anos_experiencia

        constraints.append(Constraint("instrumento", ("musico",), c_instrumento))
        if not only_instrument:
            constraints.append(Constraint("localizacao", ("musico",), c_localizacao))
            constraints.append(Constraint("caracteristicas", ("musico",), c_caracs))
            constraints.append(Constraint("anos", ("musico",), c_anos))

        return constraints

    def _run_csp(self, prefs: Preferencias, relax: bool, only_instrument: bool, max_resultados: int) -> List[Dict[str, Any]]:
        csp = SimpleCSP()
        csp.add_variable(Variable("musico", self.m.musicos))
        for c in self._build_constraints(prefs, relax=relax, only_instrument=only_instrument):
            csp.add_constraint(c)
        assignments = csp.solve(max_solutions=max_resultados * 2)
        return [a["musico"] for a in assignments]

    def solve(self, prefs: Preferencias, max_resultados: int) -> List[Dict[str, Any]]:
        only_instrument = (
            bool(_normalize(prefs.instrumento or ""))
            and prefs.anos_experiencia is None
            and not prefs.localizacao
            and not (prefs.caracteristicas or [])
        )

        musicos_exatos = self._run_csp(prefs, relax=False, only_instrument=only_instrument, max_resultados=max_resultados)
        resultados: List[Tuple[Dict[str, Any], bool]] = [(m, True) for m in musicos_exatos]

        if not resultados:
            musicos_relax = self._run_csp(prefs, relax=True, only_instrument=only_instrument, max_resultados=max_resultados)
            resultados = [(m, False) for m in musicos_relax]

        out: List[Dict[str, Any]] = []
        for mus, exato in resultados[:max_resultados]:
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
                local_ratio = _safe_ratio(mus.get("localizacao", ""), prefs.localizacao)

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

        out.sort(key=lambda item: (item["exato"], item["score"]), reverse=True)
        return out

class BandCSPSolver:
    def __init__(self, matcher: Matcher) -> None:
        self.m = matcher

    def _prefs_para_role(self, base: Preferencias, role_instr: str) -> Preferencias:
        """Cria Preferencias específicas para um papel, herdando defaults + overrides."""
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

    def _score_role(self, mus: Dict[str, Any], role_prefs: Preferencias) -> Tuple[float, Dict[str, float]]:
        det = self.m._pontuacao_1(mus, role_prefs)
        return det["score_total"], det

    def _role_ok(self, mus: Dict[str, Any], role_prefs: Preferencias, relax: bool) -> bool:
        return self.m._satisfaz_constraints_1(mus, role_prefs, relax=relax)

    def _build_domains(self, roles: List[str], base_prefs: Preferencias, relax: bool) -> Dict[str, List[Dict[str, Any]]]:
        domains: Dict[str, List[Dict[str, Any]]] = {}
        for role in roles:
            rp = self._prefs_para_role(base_prefs, role)
            d = [m for m in self.m.musicos if self._role_ok(m, rp, relax=relax)]
            domains[role] = d
        return domains

    def _band_location_constraint(self, assignment: Dict[str, Dict[str, Any]], base_prefs: Preferencias, relax: bool) -> bool:
        if base_prefs.politica_localizacao_banda != "todos_igual":
            return True

        members = list(assignment.values())
        if len(members) <= 1:
            return True

        if base_prefs.localizacao:
            for m in members:
                if not self.m._localizacao_match(m, base_prefs.localizacao, relax=relax):
                    return False
            return True
        ref = members[0].get("localizacao", "")
        for m in members[1:]:
            if _safe_ratio(m.get("localizacao", ""), ref) < (0.75 if relax else 0.85):
                return False
        return True

    def solve(self, base_prefs: Preferencias, max_resultados: int = 5) -> List[Dict[str, Any]]:
        roles_in = base_prefs.instrumentos_requeridos or []
        roles = [r for r in roles_in if _normalize(r)]
        if not roles:
            return []

        sols = self._solve_with_relax(base_prefs, roles, relax=False, max_solutions=max_resultados)

        if not sols:
            sols = self._solve_with_relax(base_prefs, roles, relax=True, max_solutions=max_resultados)

        return sols

    def _solve_with_relax(
        self,
        base_prefs: Preferencias,
        roles: List[str],
        relax: bool,
        max_solutions: int,
    ) -> List[Dict[str, Any]]:
        domains = self._build_domains(roles, base_prefs, relax=relax)

        for r in roles:
            if not domains.get(r):
                return []

        roles_order = sorted(roles, key=lambda r: len(domains[r]))

        best: List[Tuple[float, Dict[str, Dict[str, Any]], Dict[str, Dict[str, float]]]] = []
        used_ids: set = set()

        def current_upper_bound(remaining_roles: List[str]) -> float:
            ub = 0.0
            for rr in remaining_roles:
                rp = self._prefs_para_role(base_prefs, rr)
                best_score = 0.0
                for m in domains[rr]:
                    s, _ = self._score_role(m, rp)
                    if s > best_score:
                        best_score = s
                ub += best_score
            return ub

        def band_score(assignment: Dict[str, Dict[str, Any]]) -> Tuple[float, Dict[str, Dict[str, float]]]:
            total = 0.0
            per_role_details: Dict[str, Dict[str, float]] = {}
            for role, mus in assignment.items():
                rp = self._prefs_para_role(base_prefs, role)
                s, det = self._score_role(mus, rp)
                total += s
                per_role_details[role] = det

            if base_prefs.localizacao and base_prefs.politica_localizacao_banda == "todos_igual":
                ok_all = all(self.m._localizacao_match(m, base_prefs.localizacao, relax=True) for m in assignment.values())
                if ok_all:
                    total += 0.75

            return total, per_role_details

        def push_solution(score: float, assignment: Dict[str, Dict[str, Any]], details: Dict[str, Dict[str, float]]) -> None:
            best.append((score, dict(assignment), dict(details)))
            best.sort(key=lambda x: x[0], reverse=True)
            if len(best) > max_solutions:
                best.pop()

        def can_still_beat(current_score: float, remaining_roles: List[str]) -> bool:
            if len(best) < max_solutions:
                return True
            bound = current_score + current_upper_bound(remaining_roles)
            return bound > best[-1][0]

        def backtrack(i: int, assignment: Dict[str, Dict[str, Any]], current_score_acc: float) -> None:
            if i >= len(roles_order):
                if not self._band_location_constraint(assignment, base_prefs, relax=relax):
                    return
                total, per_role_details = band_score(assignment)
                push_solution(total, assignment, per_role_details)
                return

            remaining = roles_order[i:]
            if not can_still_beat(current_score_acc, remaining):
                return

            role = roles_order[i]
            rp = self._prefs_para_role(base_prefs, role)

            candidates = [m for m in domains[role] if m.get("id") not in used_ids]

            scored_candidates: List[Tuple[float, Dict[str, Any], Dict[str, float]]] = []
            for m in candidates:
                s, det = self._score_role(m, rp)
                scored_candidates.append((s, m, det))
            scored_candidates.sort(key=lambda x: x[0], reverse=True)

            for s_ind, m, _det in scored_candidates:
                mid = m.get("id")
                if mid in used_ids:
                    continue

                assignment[role] = m
                used_ids.add(mid)

                if self._band_location_constraint(assignment, base_prefs, relax=relax):
                    backtrack(i + 1, assignment, current_score_acc + s_ind)

                used_ids.remove(mid)
                assignment.pop(role, None)

        backtrack(0, {}, 0.0)

        out: List[Dict[str, Any]] = []
        for score, assign, per_role_details in best:
            membros: List[Dict[str, Any]] = []
            for role in roles_in: 
                if role not in assign:
                    continue
                mus = assign[role]
                role_p = self._prefs_para_role(base_prefs, role)
                inst_nome, inst_anos, inst_score = self.m._melhor_instrumento(mus, role_p.instrumento)

                membros.append(
                    {
                        "papel": role,
                        "id": mus.get("id"),
                        "nome": mus.get("nome"),
                        "localizacao": mus.get("localizacao"),
                        "instrumento_escolhido": inst_nome,
                        "instrumento_anos": inst_anos,
                        "instrumento_score": inst_score,
                        "instrumentos": mus.get("instrumentos", []),
                        "caracteristicas": mus.get("caracteristicas", []),
                        "detalhes": per_role_details.get(role, {}),
                    }
                )

            out.append(
                {
                    "tipo": "banda",
                    "exato": (not relax),
                    "score": round(float(score), 3),
                    "instrumentos_requeridos": list(roles_in),
                    "politica_localizacao_banda": base_prefs.politica_localizacao_banda,
                    "localizacao_alvo": base_prefs.localizacao,
                    "membros": membros,
                }
            )

        return out

class CSPMatcherFacade(Matcher):
    def resolver(self, prefs: Preferencias, max_resultados: int = 5) -> List[Dict[str, Any]]:
        # modo banda se existir instrumentos_requeridos ou "banda" no payload (aceitamos ambos)
        if prefs.instrumentos_requeridos:
            band_solver = BandCSPSolver(self)
            return band_solver.solve(prefs, max_resultados=max_resultados)

        # fallback: modo 1 músico (compatível)
        solver1 = CSP1Solver(self)
        return solver1.solve(prefs, max_resultados=max_resultados)

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
        politica_localizacao_banda=(politica_loc or "todos_igual"),
    )
    return p


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
        print(json.dumps({"resultados": sugestoes}, ensure_ascii=False))
        sys.exit(0)

    musicos = payload.get("musicos", [])
    pref_data = payload.get("preferencias", {}) or {}
    max_resultados = payload.get("max_resultados", 10)

    preferencias = _preferencias_from_payload(pref_data)

    matcher = CSPMatcherFacade(musicos)
    sugestoes = matcher.resolver(preferencias, max_resultados=max_resultados)
    json.dump({"resultados": sugestoes}, sys.stdout, ensure_ascii=False)
