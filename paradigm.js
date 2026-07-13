// paradigm.js — rule-based Old English verb conjugation engine

var Paradigm = (function () {

  // ── Constants ───────────────────────────────────────────────────────────────

  var I_MUTATION = {
    'ēo': 'īe', 'ēa': 'īe',
    'ea': 'ie', 'eo': 'ie',
    // NOTE: 'an'/'am' should only apply to nasal-cluster verbs (class IIIa type,
    // e.g. bannan → benþ). extractStemVowel matches 'an'/'am' before bare 'a',
    // so faran/hatan etc. could accidentally mutate. Fix after live test cases.
    'an': 'en', 'am': 'em',
    'ā': 'ǣ', 'ō': 'ē', 'ū': 'ȳ',
    'a': 'æ', 'e': 'i',
    'o': 'e', 'u': 'y',
    'īe': 'īe', 'ie': 'ie',
  };

  // Ordered longest-first for greedy vowel matching
  var VOWEL_LIST = [
    'ēo', 'ēa', 'īe', 'ie', 'ea', 'eo', 'ān', 'ām', 'an', 'am',
    'ā', 'ē', 'ī', 'ō', 'ū', 'ǣ', 'æ', 'a', 'e', 'i', 'o', 'u', 'y'
  ];

  var ABLAUT_CLASSES = {
    'ī,ā,i,i': 'I',
    'ēo,ēa,u,o': 'IIa',
    'ū,ēa,u,o': 'IIb',
    'i,a,u,u': 'IIIa',
    'e,æ,u,o': 'IIIb',
    'eo,ea,u,o': 'IIIb',   // weorþan-type: eo/ea before r+C
    'e,ea,u,o': 'IIIb',   // helpan/delfan-type
    'ie,ea,u,o': 'IIIb',  // gieldan-type
    'u,ea,u,o': 'IIIb',   // murnan-type
    'e,æ,ǣ,o': 'IV',
    'i,a,ō,u': 'IV',     // niman-type: irregular IV
    'u,ō,ō,u': 'IV',     // cuman-type: anomalous IV
    'e,æ,ǣ,e': 'V',
    'e,ǣ,ǣ,e': 'V',      // etan-type: ǣ in past sg
    'i,æ,ǣ,e': 'V',      // sittan-type: geminated, i in present
    // 'e,ea,ēa,e': 'V',      // ġiefan-type: palatal + breaking
    'ēo,ea,ā,e': 'V',      // ġesēon-type: contracted
    'a,ō,ō,a': 'VI',
    'a,ō,ō,æ': 'VI',     // wadan-type: æ in past participle
    'ē,ō,ō,æ': 'VI',     // slēan-type: contracted (h-loss)
    'æ,ō,ō,a': 'VI',     // stæppan-type: j-present fronts a->æ, participle keeps plain a
    // 'e,ō,ō,æ': 'VII',   // hliehhan-type: ō past, æ in past participle
    'ie,ea,ēa,ie': 'V',     // ġiefan-type: ie in present/past-part (palatal umlaut)
    'ie,ō,ō,æ': 'VII',    // hliehhan-type: ie in present (breaking before h)
    'ie,ēa,ēa,ie': 'V',    // onġietan-type: on- prefix, ie present, ēa past
    'ie,ō,ō,ea': 'VI',     // ġesċieppan-type: ie present (i-mutation of a), ō past, ea past part
  };

  var VERB_PREFIX_RE = /^(onġ|on|ā|for|ofer|of|ymb|wiþ|under|æt)(?=[^aeiouāēīōūæǣ])/;

  // ── Helper: set a nested value by dot-notation key ──────────────────────────

  function setPath(obj, path, value) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] === undefined) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  // ── extractStems ────────────────────────────────────────────────────────────

  function extractStems(principalParts) {
    var inf = principalParts[0];
    var pastSg = principalParts[1];
    var pastPl = principalParts[2];
    var pastPart = principalParts[3];

    var presentStem = inf.replace(/an$/, '');
    var pastSgStem = pastSg;
    var pastPlStem = pastPl.replace(/on$/, '');
    var pastPartStem = pastPart.replace(/^[ġg]e-?/, '').replace(/en$/, '');

    return { presentStem, pastSgStem, pastPlStem, pastPartStem };
  }

  // ── extractStemVowel ────────────────────────────────────────────────────────

  function extractStemVowel(stem) {
    for (var i = 0; i < VOWEL_LIST.length; i++) {
      if (stem.indexOf(VOWEL_LIST[i]) !== -1) {
        return VOWEL_LIST[i];
      }
    }
    return null;
  }

  // ── applyIMutation ──────────────────────────────────────────────────────────

  function applyIMutation(stem, explicitPrefix) {
    var prefix = '';
    var root = stem;
    if (explicitPrefix && stem.indexOf(explicitPrefix) === 0) {
      prefix = explicitPrefix;
      root = stem.slice(prefix.length);
    } else {
      var prefixMatch = VERB_PREFIX_RE.exec(stem);
      prefix = prefixMatch ? prefixMatch[1] : '';
      root = prefixMatch ? stem.slice(prefix.length) : stem;
    }
    var vowel = extractStemVowel(root);
    if (vowel && I_MUTATION.hasOwnProperty(vowel)) {
      var idx = root.indexOf(vowel);
      return prefix + root.slice(0, idx) + I_MUTATION[vowel] + root.slice(idx + vowel.length);
    }
    return stem;
  }

  // ── applyCollision ──────────────────────────────────────────────────────────

  function applyCollision(stem, ending) {
    if (ending === 'þ') {
      // ċġ cluster simplifies to ġ before consonantal endings (e.g. byċġ → byġ)
      if (stem.slice(-2) === 'ċġ') stem = stem.slice(0, -2) + 'ġ';
      // ċ → c before consonantal endings
      if (stem.slice(-1) === 'ċ') stem = stem.slice(0, -1) + 'c';
      // Doubled consonants drop one before þ
      if (/(.)\1$/.test(stem)) {
        stem = stem.slice(0, -1);
      }
      var tail2 = stem.slice(-2);
      var tail1 = stem.slice(-1);
      if (tail1 === 'þ') return stem;
      if (tail2 === 'dþ' || tail1 === 'd') {
        var result = stem.slice(0, -1) + 'tt';
        // Simplify NTT → NT when tt follows a consonant (e.g. wind→wint, find→fint)
        if (/[^aeiouāēīōūæǣ]tt$/.test(result)) result = result.slice(0, -1);
        return result;
      }
      if (tail1 === 't') {
        var result = stem + 't';
        // Simplify NTT → NT when tt follows a consonant
        if (/[^aeiouāēīōūæǣ]tt$/.test(result)) result = result.slice(0, -1);
        return result;
      }
      if (tail1 === 's') return stem + 't';
      return stem + 'þ';
    }

    if (ending === 'st') {
      // ċġ cluster simplifies to ġ before consonantal endings (e.g. byċġ → byġ)
      if (stem.slice(-2) === 'ċġ') stem = stem.slice(0, -2) + 'ġ';
      // ċ → c before consonantal endings
      if (stem.slice(-1) === 'ċ') stem = stem.slice(0, -1) + 'c';
      // Doubled consonants drop one before st
      if (/(.)\1$/.test(stem)) {
        stem = stem.slice(0, -1);
      }
      var tail2 = stem.slice(-2);
      var tail1 = stem.slice(-1);
      if (tail2 === 'st') return stem;   // hlyst + st → hlyst
      if (tail1 === 's') return stem + 't';
      if (tail1 === 'd') return stem.slice(0, -1) + 'tst';
      if (tail2 === 'þs' || tail1 === 'þ') return stem.replace(/þ$/, '') + 'st';
      return stem + 'st';
    }

    if (ending === 'd') {
      // Used by weak 1 past stem derivation
      if (stem.slice(-1) === 't') return stem + 't';
      return stem + 'd';
    }

    return stem + ending;
  }

  // ── computeSeriesVowels ─────────────────────────────────────────────────────

  function computeSeriesVowels(principalParts, verb) {
    var stems = extractStems(principalParts);
    var infStem = principalParts[0].replace(/an$/, '').normalize('NFC');

    // Only strip ge-/ġe- if the infinitive itself is genuinely prefixed
    // (e.g. ġesēon, ġewītan). Verbs like ġiefan have root-initial ġ, not a
    // separable prefix — stripping would corrupt their past-stem vowels.
    var isPrefixed = /^[ġg]e/.test(principalParts[0].normalize('NFC'));
    var verbPrefix = verb && verb.verbPrefix ? verb.verbPrefix : null;
    var prefixMatch = VERB_PREFIX_RE.exec(isPrefixed ? '' : infStem);
    var otherPrefix = verbPrefix || (prefixMatch ? prefixMatch[1] : null);

    function stemVowel(raw) {
      var s = raw.normalize('NFC');
      if (isPrefixed) s = s.replace(/^[ġg]e-?/, '');
      if (otherPrefix) s = s.replace(new RegExp('^' + otherPrefix.replace('ġ', '[ġg]')), '');
      var v = extractStemVowel(s);
      // VOWEL_LIST orders 'an'/'am' above 'a'/'ā' (needed for applyIMutation),
      // so sang→'an', swamm→'am' etc. Collapse to the bare vowel for ablaut.
      if (v === 'an' || v === 'am') return 'a';
      if (v === 'ān' || v === 'ām') return 'ā';
      return v;
    }

    return [
      stemVowel(stems.presentStem),
      stemVowel(stems.pastSgStem),
      stemVowel(stems.pastPlStem),
      stemVowel(stems.pastPartStem),
    ];
  }

  // ── inferClass ──────────────────────────────────────────────────────────────

  function inferClass(principalParts, verb) {
    var v = computeSeriesVowels(principalParts, verb);
    var tuple = v.join(',');

    var normalizedTuple = tuple.normalize('NFC');
    for (var key in ABLAUT_CLASSES) {
      if (key.normalize('NFC') === normalizedTuple) {
        return ABLAUT_CLASSES[key];
      }
    }

    // Class VII: pastSg vowel === pastPl vowel AND vowel is ēo or ē
    if (v[1] && v[1] === v[2] && (v[1].normalize('NFC') === 'ēo' || v[1].normalize('NFC') === 'ē')) {
      return 'VII';
    }

    return 'unknown';
  }

  // ── conjugateStrong ─────────────────────────────────────────────────────────

  function conjugateStrong(verb) {
    var stems = extractStems(verb.principalParts);
    var mutatedStem = applyIMutation(stems.presentStem, verb.verbPrefix);
    var mutatedStemForSg = (mutatedStem !== stems.presentStem)
      ? mutatedStem.replace(/g$/, 'ġ')   // only dot g when mutation happened
      : mutatedStem;

    return {
      class: 'Strong ' + inferClass(verb.principalParts, verb),
      lemma: verb.lemma,
      gloss: verb.gloss,

      presentInd: {
        sg1: stems.presentStem + 'e',
        sg2: applyCollision(mutatedStemForSg, 'st'),
        sg3: applyCollision(mutatedStemForSg, 'þ'),
        pl: stems.presentStem + 'aþ',
      },
      pastInd: {
        sg1: stems.pastSgStem,
        sg2: stems.pastPlStem + 'e',
        sg3: stems.pastSgStem,
        pl: stems.pastPlStem + 'on',
      },
      presentSubj: {
        sg: stems.presentStem + 'e',
        pl: stems.presentStem + 'en',
      },
      pastSubj: {
        sg: stems.pastPlStem + 'e',
        pl: stems.pastPlStem + 'en',
      },
      imperative: {
        sg: stems.presentStem,
        pl: stems.presentStem + 'aþ',
      },
      nonFinite: {
        infinitive: verb.lemma,
        inflectedInfinitive: 'tō ' + stems.presentStem + 'enne',
        presentParticiple: stems.presentStem + 'ende',
        pastParticiple: (verb.verbPrefix || VERB_PREFIX_RE.test(verb.lemma.normalize('NFC')) ? '' : 'ġe') + stems.pastPartStem + 'en',
      },
    };
  }

  // ── conjugateWeak2 ──────────────────────────────────────────────────────────

  function conjugateWeak2(verb) {
    var stem = verb.lemma.replace(/ian$/, '');

    return {
      class: 'Weak II',
      lemma: verb.lemma,
      gloss: verb.gloss,

      presentInd: {
        sg1: stem + 'iġe',
        sg2: stem + 'ast',
        sg3: stem + 'aþ',
        pl: stem + 'iaþ',
      },
      pastInd: {
        sg1: stem + 'ode',
        sg2: stem + 'odest',
        sg3: stem + 'ode',
        pl: stem + 'odon',
      },
      presentSubj: {
        sg: stem + 'iġe',
        pl: stem + 'iġen',
      },
      pastSubj: {
        sg: stem + 'ode',
        pl: stem + 'oden',
      },
      imperative: {
        sg: stem + 'a',
        pl: stem + 'iaþ',
      },
      nonFinite: {
        infinitive: verb.lemma,
        inflectedInfinitive: 'tō ' + stem + 'ianne',
        presentParticiple: stem + 'iende',
        pastParticiple: ((verb.verbPrefix || /^[ġgb]e(?!o)/.test(verb.lemma.normalize('NFC'))) ? '' : 'ġe') + stem + 'od',
      },
    };
  }

  // ── degeminateAndEpenthesis ─────────────────────────────────────────────────

  function degeminateAndEpenthesis(stem, ending) {
    // e.g. reċċ + þ → reċeþ,  reċċ + st → reċest
    if (/(.)\1$/.test(stem)) {
      return stem.slice(0, -1) + 'e' + ending;
    }
    // lecgan-type: ċġ acts as a geminate cluster for the bare/imperative ending
    // only (st/þ already route correctly through applyCollision's own ċġ→ġ rule).
    if (ending === '' && /ċġ$/.test(stem)) {
      return stem.slice(0, -2) + 'ġe';
    }
    return applyCollision(stem, ending);
  }

  // ── isShortRoot ─────────────────────────────────────────────────────────────

  function isShortRoot(stem) {
    if (/āēīōūǣȳ|ēo|ēa|īe|ie|ea|eo/.test(stem)) return false;
    return /[aeiouæy][^aeiouæyāēīōūǣȳ]$/.test(stem);
  }

  // ── pastDE ──────────────────────────────────────────────────────────────────
  function pastDE(stem) {
    if (/t$/.test(stem)) return stem + 'e';           // set → sette, sōht → sōhte
    if (/[pcs]$/.test(stem)) return stem + 'te';      // beċīep → beċīepte (f/þ voiced → -de)
    if (/[lrn]d$/.test(stem)) return stem + 'e';      // seald → sealde, send → sende
    if (isShortRoot(stem)) return stem + 'ede';       // frem → fremede
    return stem + 'de';                               // hīer → hīerde  ← was 'e', needs 'de'
  }

  // ── conjugateWeak1 ──────────────────────────────────────────────────────────

  function conjugateWeak1(verb) {
    var presentStem = verb.lemma.replace(/an$/, '');
    var pastStemBase = /(.)\1$/.test(presentStem) ? presentStem.slice(0, -1) : presentStem;
    var pastStem = verb.irregularForms.pastStem || pastStemBase;

    // Don't add ġe- if the lemma already has a ge-/ġe- prefix
    var ppPrefix = (verb.verbPrefix || /^[ġgb]e(?!o)/.test(verb.lemma.normalize('NFC'))) ? '' : 'ġe';

    // Present sg2/sg3: plain degemination (no epenthesis) when verb.noEpenthesis is set
    var sg2PresInd = (verb.noEpenthesis && /(.)\1$/.test(presentStem))
      ? applyCollision(presentStem.slice(0, -1), 'st')
      : degeminateAndEpenthesis(presentStem, 'st');
    var sg3PresInd = (verb.noEpenthesis && /(.)\1$/.test(presentStem))
      ? applyCollision(presentStem.slice(0, -1), 'þ')
      : degeminateAndEpenthesis(presentStem, 'þ');

    return {
      class: 'Weak I',
      lemma: verb.lemma,
      gloss: verb.gloss,

      presentInd: {
        sg1: presentStem + 'e',
        sg2: sg2PresInd,
        sg3: sg3PresInd,
        pl: presentStem + 'aþ',
      },
      pastInd: {
        sg1: pastDE(pastStem),
        sg2: pastDE(pastStem).replace(/e$/, 'est'),
        sg3: pastDE(pastStem),
        pl: pastDE(pastStem).replace(/e$/, 'on'),
      },
      presentSubj: {
        sg: presentStem + 'e',
        pl: presentStem + 'en',
      },
      pastSubj: {
        sg: pastDE(pastStem),
        pl: pastDE(pastStem).replace(/e$/, 'en'),
      },
      imperative: {
        sg: degeminateAndEpenthesis(presentStem, ''),
        pl: presentStem + 'aþ',
      },
      nonFinite: {
        infinitive: verb.lemma,
        inflectedInfinitive: 'tō ' + presentStem + 'enne',
        presentParticiple: presentStem + 'ende',
        pastParticiple: ppPrefix + (/ht$/.test(pastStem) ? pastStem : pastStemBase + 'ed'),
      },
    };
  }

  // ── conjugate (dispatcher) ──────────────────────────────────────────────────

  function conjugate(verb) {
    var result;

    switch (verb.type) {
      case 'strong':
        result = conjugateStrong(verb);
        break;
      case 'weak2':
        result = conjugateWeak2(verb);
        break;
      case 'weak1':
        result = conjugateWeak1(verb);
        break;
      case 'irregular':
        result = {
          class: 'Irregular',
          lemma: verb.lemma,
          gloss: verb.gloss,
        };
        break;
      case 'preterite-present':
        result = {
          class: 'Preterite-Present',
          lemma: verb.lemma,
          gloss: verb.gloss,
        };
        break;
      default:
        throw new Error('Unknown verb type: ' + verb.type);
    }

    // Merge irregularForms overrides (dot-notation keys)
    if (verb.irregularForms) {
      Object.keys(verb.irregularForms).forEach(function (key) {
        // Reserved keys used internally — skip
        if (key === 'pastStem') return;
        setPath(result, key, verb.irregularForms[key]);
      });
    }

    result.sources = verb.sources || [];
    return result;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  return { conjugate, inferClass, extractStems, computeSeriesVowels };

}());

// Node.js / Jest compatibility
if (typeof module !== 'undefined') module.exports = { Paradigm };

// Sanity checks:
// swimman  → 3sg swimþ   (doubled mm drops before þ)
// rinnan   → 2sg rinst   (doubled nn drops before st)
// sēċan    → 3sg sēcþ    (ċ → c before þ)
// sēċan    → 2sg sēcst   (ċ → c before st)
// rǣsan    → 3sg rǣst    (s + þ → st)
// settan   → past sette  (t + d → tt, simplified: sette)
// fremman  → past participle gefremed  (past participle = pastStem + e)
// windan   → 3sg wint    (nd + þ → ntt → nt, simplified)
// findan   → 3sg fint    (nd + þ → ntt → nt, simplified)
// weorþan  → 3sg wierþ   (þ + þ → þ)
// ġecȳþan  → past ġecȳþde  (þ voiced intervocalically → -de)
// ġelīefan → past ġelīefde (f voiced intervocalically → -de)
// hlystan  → 2sg hlyst     (st + st → st)
// forlǣtan → pp forlǣten   (prefixed verbs take no additional ġe-)
// ġeocian  → pp ġeġeocod   (ġeo- is root, not prefix — keeps ġe-)