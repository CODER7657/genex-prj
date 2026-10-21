"""Does a meaning-based layer catch the crisis messages the phrase rules miss?

Run on Colab (it downloads a ~470 MB model), not a laptop:

    python safety-ml/semantic_eval.py --cases docs/eval/eval_cases.json

Protocol, fixed before any held-out result was seen:

1. Embed every message with intfloat/multilingual-e5-small (handles Hindi).
2. Train a class-balanced logistic regression on the 107 main-set cases only.
3. Combine with the rules: explicit rule routes (CRISIS, THIRD_PARTY) stand; otherwise
   the more protective of the rules and the model wins, where the model says CRISIS
   when P(CRISIS) >= t.
4. Choose t by 5-fold cross-validation on the main set: the lowest t that gives zero
   false crisis alarms on harmless main-set messages.
5. Score the held-out set exactly once with that model and t.
"""

from __future__ import annotations

import argparse
import json

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold

ROUTES = ["NONE", "CONCERN", "THIRD_PARTY", "CRISIS"]
SEVERITY = {r: i for i, r in enumerate(ROUTES)}
MODEL_NAME = "intfloat/multilingual-e5-small"


def embed(texts: list[str]) -> np.ndarray:
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(MODEL_NAME)
    # E5 models expect a "query: " prefix for symmetric tasks.
    return model.encode([f"query: {t}" for t in texts], normalize_embeddings=True, batch_size=32)


def fit(X: np.ndarray, y: list[str]) -> LogisticRegression:
    return LogisticRegression(C=4.0, max_iter=5000, class_weight="balanced").fit(X, y)


def semantic_route(probs: dict[str, float], t: float) -> str:
    if probs["CRISIS"] >= t:
        return "CRISIS"
    rest = {k: v for k, v in probs.items() if k != "CRISIS"}
    return max(rest, key=rest.get)


def combine(rules: str, sem: str) -> str:
    if rules in ("CRISIS", "THIRD_PARTY"):
        return rules
    return max(rules, sem, key=SEVERITY.get)


def score(cases: list[dict], routes: list[str]) -> dict:
    out = {"crisis": [0, 0], "concern": [0, 0], "third_party": [0, 0], "none_clean": [0, 0], "false_crisis": 0,
           "missed_crisis": [], "false_crisis_cases": []}
    for c, r in zip(cases, routes):
        e = c["expected"]
        if e == "CRISIS":
            out["crisis"][1] += 1
            if r == "CRISIS":
                out["crisis"][0] += 1
            else:
                out["missed_crisis"].append(f"{c['id']} ({r}): {c['text']}")
        elif e == "CONCERN":
            out["concern"][1] += 1
            out["concern"][0] += r in ("CONCERN", "CRISIS")
        elif e == "THIRD_PARTY":
            out["third_party"][1] += 1
            out["third_party"][0] += r == "THIRD_PARTY"
        else:
            out["none_clean"][1] += 1
            out["none_clean"][0] += r == "NONE"
            if r == "CRISIS":
                out["false_crisis"] += 1
                out["false_crisis_cases"].append(f"{c['id']}: {c['text']}")
    return out


def probs_for(model: LogisticRegression, X: np.ndarray) -> list[dict[str, float]]:
    p = model.predict_proba(X)
    return [{cls: float(row[i]) for i, cls in enumerate(model.classes_)} | {r: 0.0 for r in ROUTES if r not in model.classes_}
            for row in p]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases", required=True)
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    data = json.load(open(args.cases, encoding="utf-8"))
    main_cases, held = data["main"], data["holdout"]
    # Held-out v2 is optional so older exports still run. It is scored with the same
    # model and threshold as v1, both fixed from the main set alone.
    held2 = data.get("holdout2", [])
    X_all = embed([c["text"] for c in main_cases + held + held2])
    X_main = X_all[: len(main_cases)]
    X_held = X_all[len(main_cases): len(main_cases) + len(held)]
    X_held2 = X_all[len(main_cases) + len(held):]
    y_main = [c["expected"] for c in main_cases]

    # Out-of-fold probabilities on the main set, for choosing t without the held-out set.
    oof: list[dict[str, float] | None] = [None] * len(main_cases)
    skf = StratifiedKFold(n_splits=args.folds, shuffle=True, random_state=args.seed)
    for tr, te in skf.split(X_main, y_main):
        m = fit(X_main[tr], [y_main[i] for i in tr])
        for i, p in zip(te, probs_for(m, X_main[te])):
            oof[i] = p

    candidates = np.round(np.arange(0.05, 0.96, 0.01), 2)
    chosen = None
    for t in candidates:
        routes = [combine(c["rules_route"], semantic_route(p, t)) for c, p in zip(main_cases, oof)]
        if score(main_cases, routes)["false_crisis"] == 0:
            chosen = float(t)
            break
    if chosen is None:
        chosen = 0.95
    oof_routes = [combine(c["rules_route"], semantic_route(p, chosen)) for c, p in zip(main_cases, oof)]

    # Final model on the whole main set; the held-out set is scored once.
    final = fit(X_main, y_main)
    held_probs = probs_for(final, X_held)
    held_sem = [semantic_route(p, chosen) for p in held_probs]
    held_comb = [combine(c["rules_route"], s) for c, s in zip(held, held_sem)]
    held_rules = [c["rules_route"] for c in held]

    result = {
        "model": MODEL_NAME,
        "threshold": chosen,
        "main_oof_combined": score(main_cases, oof_routes),
        "holdout": {
            "rules_only": score(held, held_rules),
            "semantic_only": score(held, held_sem),
            "combined": score(held, held_comb),
        },
        "holdout_cases": [
            {"id": c["id"], "expected": c["expected"], "rules": r, "semantic": s, "combined": k,
             "p_crisis": round(p["CRISIS"], 3)}
            for c, r, s, k, p in zip(held, held_rules, held_sem, held_comb, held_probs)
        ],
    }
    if held2:
        p2 = probs_for(final, X_held2)
        s2 = [semantic_route(p, chosen) for p in p2]
        k2 = [combine(c["rules_route"], s) for c, s in zip(held2, s2)]
        r2 = [c["rules_route"] for c in held2]
        result["holdout2"] = {"rules_only": score(held2, r2), "semantic_only": score(held2, s2), "combined": score(held2, k2)}
        result["holdout2_cases"] = [
            {"id": c["id"], "expected": c["expected"], "rules": r, "semantic": s, "combined": k, "p_crisis": round(p["CRISIS"], 3)}
            for c, r, s, k, p in zip(held2, r2, s2, k2, p2)
        ]
    print("<<<SEMANTIC_RESULTS>>>")
    print(json.dumps(result, separators=(",", ":"), ensure_ascii=False))
    print("<<<END_SEMANTIC_RESULTS>>>")
    for split in ("holdout", "holdout2"):
        for name, s in result.get(split, {}).items():
            print(f"{split} {name:14s} crisis {s['crisis'][0]}/{s['crisis'][1]}  false crisis {s['false_crisis']}"
                  f"  concern {s['concern'][0]}/{s['concern'][1]}  third party {s['third_party'][0]}/{s['third_party'][1]}")


if __name__ == "__main__":
    main()
