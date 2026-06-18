"""
Schema validator for verbs.json.

Every test collects ALL failures before asserting, so a single run
reports every violation rather than stopping at the first one.
"""

import json
import unicodedata
from collections import Counter
from pathlib import Path

VERBS_PATH = Path(__file__).parent.parent / "verbs.json"
VALID_TYPES = {"strong", "weak1", "weak2", "irregular", "preterite-present"}
REQUIRED_FIELDS = {"id", "lemma", "gloss", "type", "sources", "notes", "irregular", "irregularForms"}


def load_verbs():
    return json.loads(VERBS_PATH.read_text(encoding="utf-8"))


# ── Test 1 ──────────────────────────────────────────────────────────────────

def test_no_duplicate_ids():
    verbs = load_verbs()
    counts = Counter(v["id"] for v in verbs)
    duplicates = [id_ for id_, n in counts.items() if n > 1]
    assert not duplicates, f"Duplicate ids found: {duplicates}"


# ── Test 2 ──────────────────────────────────────────────────────────────────

def test_no_duplicate_lemmas():
    verbs = load_verbs()
    counts = Counter(v["lemma"] for v in verbs)
    duplicates = [lemma for lemma, n in counts.items() if n > 1]
    assert not duplicates, f"Duplicate lemmas found: {duplicates}"


# ── Test 3 ──────────────────────────────────────────────────────────────────

def test_required_fields():
    verbs = load_verbs()
    failures = []
    for verb in verbs:
        missing = REQUIRED_FIELDS - verb.keys()
        if missing:
            failures.append(f"{verb.get('id', '<no id>')}: missing fields {sorted(missing)}")
    assert not failures, "Required-field violations:\n" + "\n".join(failures)


# ── Test 4 ──────────────────────────────────────────────────────────────────

def test_valid_types():
    verbs = load_verbs()
    failures = []
    for verb in verbs:
        t = verb.get("type")
        if t not in VALID_TYPES:
            failures.append(f"{verb.get('id')}: invalid type {t!r}")
    assert not failures, "Invalid type violations:\n" + "\n".join(failures)


# ── Test 5 ──────────────────────────────────────────────────────────────────

def test_strong_verbs_have_principal_parts():
    verbs = load_verbs()
    failures = []
    for verb in verbs:
        if verb.get("type") != "strong":
            continue
        pp = verb.get("principalParts")
        if not isinstance(pp, list):
            failures.append(f"{verb['id']}: principalParts missing or not a list")
            continue
        if len(pp) != 4:
            failures.append(f"{verb['id']}: principalParts has {len(pp)} items, expected 4")
            continue
        bad = [i for i, s in enumerate(pp) if not isinstance(s, str) or not s.strip()]
        if bad:
            failures.append(f"{verb['id']}: principalParts[{bad}] are empty or non-string")
    assert not failures, "Strong-verb principalParts violations:\n" + "\n".join(failures)


# ── Test 6 ──────────────────────────────────────────────────────────────────

def test_sources_structure():
    verbs = load_verbs()
    failures = []
    for verb in verbs:
        vid = verb.get("id", "<no id>")
        sources = verb.get("sources")
        if not isinstance(sources, list):
            failures.append(f"{vid}: sources is not a list")
            continue
        for i, src in enumerate(sources):
            if not isinstance(src, dict):
                failures.append(f"{vid}: sources[{i}] is not an object")
                continue
            if not isinstance(src.get("text"), str):
                failures.append(f"{vid}: sources[{i}].text missing or not a string")
            if not isinstance(src.get("chapter"), int):
                failures.append(f"{vid}: sources[{i}].chapter missing or not an int")
    assert not failures, "Sources structure violations:\n" + "\n".join(failures)


# ── Test 7 ──────────────────────────────────────────────────────────────────

def test_related_refs_exist():
    verbs = load_verbs()
    all_ids = {v["id"] for v in verbs}
    failures = []
    for verb in verbs:
        related = verb.get("related")
        if related is None:
            continue
        if not isinstance(related, list):
            failures.append(f"{verb['id']}: related is not a list")
            continue
        for ref in related:
            if ref not in all_ids:
                failures.append(f"{verb['id']}: related ref {ref!r} does not exist")
    assert not failures, "Dangling related references:\n" + "\n".join(failures)


# ── Test 8 ──────────────────────────────────────────────────────────────────

def test_unicode_normalization():
    verbs = load_verbs()
    failures = []
    for verb in verbs:
        vid = verb.get("id", "<no id>")
        lemma = verb.get("lemma", "")
        if isinstance(lemma, str) and unicodedata.normalize("NFC", lemma) != lemma:
            failures.append(f"{vid}: lemma is not NFC-normalized: {lemma!r}")
        if verb.get("type") == "strong":
            pp = verb.get("principalParts", [])
            if isinstance(pp, list):
                for i, part in enumerate(pp):
                    if isinstance(part, str) and unicodedata.normalize("NFC", part) != part:
                        failures.append(
                            f"{vid}: principalParts[{i}] is not NFC-normalized: {part!r}"
                        )
    assert not failures, "Unicode normalization violations:\n" + "\n".join(failures)


# ── Test 9 ──────────────────────────────────────────────────────────────────

def test_irregular_consistency():
    verbs = load_verbs()
    failures = []
    for verb in verbs:
        vid = verb["id"]
        t = verb.get("type")
        is_irregular = verb.get("irregular")
        irregular_forms = verb.get("irregularForms")

        if t in ("irregular", "preterite-present"):
            if is_irregular is not True:
                failures.append(f"{vid}: type={t!r} but irregular={is_irregular!r} (expected True)")
            if irregular_forms == {}:
                failures.append(f"{vid}: type={t!r} but irregularForms is empty {{}}")

        elif t == "weak2":
            if is_irregular is True:
                failures.append(f"{vid}: type='weak2' but irregular=True (unexpected)")

    assert not failures, "Irregular consistency violations:\n" + "\n".join(failures)


# ── Test 10 ─────────────────────────────────────────────────────────────────

def test_strong_verb_infinitive_matches_lemma():
    verbs = load_verbs()
    failures = []
    for verb in verbs:
        if verb.get("type") != "strong":
            continue
        vid = verb["id"]
        lemma = unicodedata.normalize("NFC", verb.get("lemma", ""))
        pp = verb.get("principalParts")
        if not isinstance(pp, list) or len(pp) == 0:
            continue  # already caught by test 5
        inf = unicodedata.normalize("NFC", pp[0])
        if inf != lemma:
            failures.append(
                f"{vid}: lemma={lemma!r} but principalParts[0]={inf!r}"
            )
    assert not failures, "Infinitive/lemma mismatches:\n" + "\n".join(failures)


# ── Test 11 ─────────────────────────────────────────────────────────────────

def test_strong_verbs_infer_known_class():
    """All strong verbs should resolve to a known ablaut class via the engine."""
    import subprocess

    verbs = load_verbs()
    strong = [v for v in verbs if v.get('type') == 'strong']

    failures = []
    for verb in strong:
        result = subprocess.run(
            ['node', '-e', f"""
                const {{ Paradigm }} = require('./paradigm.js');
                const verb = {json.dumps(verb)};
                const result = Paradigm.conjugate(verb);
                console.log(result.class);
                """
            ],
            capture_output=True, text=True, cwd='.'
        )
        cls = result.stdout.strip()
        if 'unknown' in cls.lower():
            failures.append(f"{verb['id']}: inferred '{cls}' — add verbPrefix or new ABLAUT_CLASSES entry")

    assert not failures, 'Strong verbs with unknown class:\n' + '\n'.join(failures)