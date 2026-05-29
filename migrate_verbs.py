import json
import re
import sys

def strip_trailing_e(stem):
    if stem.endswith("e"):
        return stem[:-1]
    return stem

def to_camel_case_forms(forms):
    """Convert the old forms object to camelCase irregularForms."""
    result = {}

    non_finite = {}
    if "infinitive" in forms:
        non_finite["infinitive"] = forms["infinitive"]
    if "inflected_infinitive" in forms:
        non_finite["inflectedInfinitive"] = forms["inflected_infinitive"]
    if "pres_participle" in forms:
        non_finite["presentParticiple"] = forms["pres_participle"]
    if "past_participle" in forms:
        non_finite["pastParticiple"] = forms["past_participle"]
    if non_finite:
        result["nonFinite"] = non_finite

    if "imperative_sg" in forms or "imperative_pl" in forms:
        result["imperative"] = {
            "sg": forms.get("imperative_sg"),
            "pl": forms.get("imperative_pl"),
        }

    if "pres_ind" in forms:
        result["presentInd"] = forms["pres_ind"]
    if "past_ind" in forms:
        result["pastInd"] = forms["past_ind"]
    if "pres_subj" in forms:
        result["presentSubj"] = forms["pres_subj"]
    if "past_subj" in forms:
        result["pastSubj"] = forms["past_subj"]

    return result

def detect_weak1_irregular(entry):
    """
    Returns (is_irregular, sub_case, past_stem)
    sub_case: 'A' = irregular past stem only, 'B' = fully irregular
    """
    forms = entry.get("forms", {})
    infinitive = forms.get("infinitive", "")
    notes = entry.get("notes", "")

    # Check if notes mention irregular / past — flag for review
    notes_lower = notes.lower()
    notes_flag = "irregular" in notes_lower or ("past" in notes_lower and "past participle" not in notes_lower)

    # Derive present stem: strip trailing -an from infinitive
    if infinitive.endswith("an"):
        present_stem = infinitive[:-2]
    else:
        present_stem = infinitive

    pres_ind = forms.get("pres_ind", {})
    sg1 = pres_ind.get("sg1", "")

    # Regular weak1: sg1 == present_stem + "e" (or "ic" + stem + "e")
    # The sg1 form is typically just the bare stem (sometimes with e)
    # Regular: sg1 should be present_stem (without ending, or with -e in some dialects)
    # We check if sg1 == present_stem or sg1 == present_stem + "e"
    regular_sg1_forms = {present_stem, present_stem + "e"}
    pres_is_regular = sg1 in regular_sg1_forms

    past_ind = forms.get("past_ind", {})
    past_sg1 = past_ind.get("sg1", "")

    # A regular weak1 past would be present_stem + "de" or present_stem + "te" etc.
    # For now, check if past_sg1 ends with "de" or "te" or "ede"
    regular_past_endings = ("de", "te", "ede")
    past_is_regular_ending = any(past_sg1.endswith(e) for e in regular_past_endings)

    is_irregular = not pres_is_regular or not past_is_regular_ending or notes_flag

    if not is_irregular:
        return False, None, None, False

    # Sub-case B: present forms are also irregular
    if not pres_is_regular:
        return True, "B", None, notes_flag

    # Sub-case A: only past is irregular — extract pastStem by stripping trailing "e"
    past_stem = strip_trailing_e(past_sg1)
    return True, "A", past_stem, notes_flag

def migrate_entry(entry):
    new_entry = {}
    flags = []

    # id
    new_entry["id"] = entry["id"]

    # lemma (was "oe")
    new_entry["lemma"] = entry["oe"]

    # gloss
    new_entry["gloss"] = entry["gloss"]

    # type mapping
    old_type = entry.get("type", "")
    old_class = entry.get("class", "")

    if old_type == "strong":
        new_type = "strong"
    elif old_type == "weak":
        if "II" in old_class:
            new_type = "weak2"
        elif "I" in old_class:
            new_type = "weak1"
        else:
            new_type = "weak1"
            flags.append(f"UNKNOWN weak class '{old_class}', defaulted to weak1")
    elif old_type == "irregular":
        new_type = "irregular"
    elif old_type == "preterite-present":
        new_type = "preterite-present"
    else:
        new_type = old_type
        flags.append(f"UNKNOWN type '{old_type}'")

    new_entry["type"] = new_type

    # sources
    new_entry["sources"] = entry.get("sources", [])

    # notes
    new_entry["notes"] = entry.get("notes", "")

    # related (keep if present)
    if "related" in entry:
        new_entry["related"] = entry["related"]

    forms = entry.get("forms", {})

    if new_type == "strong":
        pp = [
            forms.get("infinitive", ""),
            forms.get("past_ind", {}).get("sg1", ""),
            forms.get("past_ind", {}).get("pl", ""),
            forms.get("past_participle", ""),
        ]
        new_entry["principalParts"] = pp
        new_entry["irregular"] = False
        new_entry["irregularForms"] = {}

        # Validate
        for i, p in enumerate(pp):
            if not p:
                flags.append(f"EMPTY principalParts[{i}]")

    elif new_type == "weak2":
        new_entry["irregular"] = False
        new_entry["irregularForms"] = {}

    elif new_type == "weak1":
        is_irr, sub_case, past_stem, notes_flag = detect_weak1_irregular(entry)

        if notes_flag:
            flags.append(f"Notes mention irregularity — check manually: notes='{entry.get('notes','')}'")

        if not is_irr:
            new_entry["irregular"] = False
            new_entry["irregularForms"] = {}
        else:
            new_entry["irregular"] = True
            if sub_case == "A":
                new_entry["irregularForms"] = {"pastStem": past_stem}
            elif sub_case == "B":
                new_entry["irregularForms"] = to_camel_case_forms(forms)
            else:
                new_entry["irregularForms"] = {}
                flags.append("Could not determine weak1 sub-case")

    elif new_type in ("irregular", "preterite-present"):
        new_entry["irregular"] = True
        new_entry["irregularForms"] = to_camel_case_forms(forms)

    return new_entry, flags

def main():
    with open("verbs.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    migrated = []
    type_counts = {"strong": 0, "weak1": 0, "weak2": 0, "irregular": 0, "preterite-present": 0}
    manual_review = []
    validation_errors = []

    for entry in data:
        new_entry, flags = migrate_entry(entry)
        migrated.append(new_entry)

        t = new_entry.get("type", "unknown")
        if t in type_counts:
            type_counts[t] += 1
        else:
            type_counts[t] = type_counts.get(t, 0) + 1

        if flags:
            manual_review.append((new_entry["id"], flags))

    # Validation pass
    old_fields = {"oe", "class", "pattern", "review_notes", "forms"}
    required_fields = {"id", "lemma", "gloss", "type", "sources", "notes", "irregular", "irregularForms"}

    for e in migrated:
        eid = e.get("id", "UNKNOWN")
        missing = required_fields - set(e.keys())
        if missing:
            validation_errors.append(f"{eid}: missing required fields {missing}")

        leftover = old_fields & set(e.keys())
        if leftover:
            validation_errors.append(f"{eid}: still has old fields {leftover}")

        if e.get("type") == "strong":
            pp = e.get("principalParts", [])
            if len(pp) != 4:
                validation_errors.append(f"{eid}: principalParts has {len(pp)} elements, expected 4")
            else:
                for i, p in enumerate(pp):
                    if not p:
                        validation_errors.append(f"{eid}: principalParts[{i}] is empty")

    # Write output
    with open("verbs.json", "w", encoding="utf-8") as f:
        json.dump(migrated, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # Print summary
    print("=== Migration Summary ===")
    print(f"Total entries: {len(migrated)}")
    for t, c in sorted(type_counts.items()):
        print(f"  {t}: {c}")

    print()
    if manual_review:
        print(f"=== Manual Review Required ({len(manual_review)} entries) ===")
        for eid, flags in manual_review:
            for flag in flags:
                print(f"  [{eid}] {flag}")
    else:
        print("No entries flagged for manual review.")

    print()
    if validation_errors:
        print(f"=== Validation Errors ({len(validation_errors)}) ===")
        for err in validation_errors:
            print(f"  {err}")
    else:
        print("All validation checks passed.")

if __name__ == "__main__":
    main()
