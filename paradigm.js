// paradigm.js — rule-based Old English verb conjugation engine

var Paradigm = (function () {

  // ── Constants ───────────────────────────────────────────────────────────────

  var I_MUTATION = {
    'ēo': 'īe', 'ēa': 'īe',
    'ea': 'ie', 'eo': 'ie',
    'an': 'en', 'am': 'em',
    'ā':  'ǣ',  'ō':  'ē',  'ū': 'ȳ',
    'a':  'æ',  'e':  'i',
    'o':  'e',  'u':  'y',
  };

  // Ordered longest-first for greedy vowel matching
  var VOWEL_LIST = [
    'ēo','ēa','ea','eo','ān','ām','an','am',
    'ā','ē','ī','ō','ū','ǣ','æ','a','e','i','o','u','y'
  ];

  var ABLAUT_CLASSES = {
    'ī,ā,i,i':   'I',
    'ēo,ēa,u,o': 'IIa',
    'ū,ēa,u,o':  'IIb',
    'i,a,u,u':   'IIIa',
    'e,æ,u,o':   'IIIb',
    'eo,ea,u,o': 'IIIb',   // weorþan-type: eo/ea before r+C
    'e,æ,ǣ,o':   'IV',
    'i,a,ō,u':   'IV',     // niman-type: irregular IV
    'u,ō,ō,u':   'IV',     // cuman-type: anomalous IV
    'e,æ,ǣ,e':   'V',
    'e,ǣ,ǣ,e':   'V',      // etan-type: ǣ in past sg
    'i,æ,ǣ,e':   'V',      // sittan-type: geminated, i in present
    'e,ea,ēa,e': 'V',      // ġiefan-type: palatal + breaking
    'ēo,ea,ā,e': 'V',      // ġesēon-type: contracted
    'a,ō,ō,a':   'VI',
    'e,ō,ō,æ':   'VII',   // hliehhan-type: ō past, æ in past participle
  };

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
    var inf      = principalParts[0];
    var pastSg   = principalParts[1];
    var pastPl   = principalParts[2];
    var pastPart = principalParts[3];

    var presentStem  = inf.replace(/an$/, '');
    var pastSgStem   = pastSg;
    var pastPlStem   = pastPl.replace(/on$/, '');
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

  function applyIMutation(stem) {
    var vowel = extractStemVowel(stem);
    if (vowel && I_MUTATION.hasOwnProperty(vowel)) {
      var idx = stem.indexOf(vowel);
      return stem.slice(0, idx) + I_MUTATION[vowel] + stem.slice(idx + vowel.length);
    }
    return stem;
  }

  // ── applyCollision ──────────────────────────────────────────────────────────

  function applyCollision(stem, ending) {
    if (ending === 'þ') {
      // Doubled consonants drop one before þ
      if (/([nmlp])\1$/.test(stem)) {
        stem = stem.slice(0, -1);
      }
      var tail2 = stem.slice(-2);
      var tail1 = stem.slice(-1);
      if (tail2 === 'dþ' || tail1 === 'd') return stem.slice(0, -1) + 'tt';
      if (tail1 === 't')                   return stem + 't';
      if (tail2 === 'sþ' || tail1 === 's') return stem.slice(0, -1 * (tail2 === 'sþ' ? 1 : 0)) + 'st';
      return stem + 'þ';
    }

    if (ending === 'st') {
      // Doubled consonants drop one before st
      if (/([nmlp])\1$/.test(stem)) {
        stem = stem.slice(0, -1);
      }
      var tail2 = stem.slice(-2);
      var tail1 = stem.slice(-1);
      if (tail1 === 'd')  return stem.slice(0, -1) + 'tst';
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

  // ── inferClass ──────────────────────────────────────────────────────────────

  function inferClass(principalParts) {
    var stems = extractStems(principalParts);

    // Only strip ge-/ġe- if the infinitive itself is genuinely prefixed
    // (e.g. ġesēon, ġewītan). Verbs like ġiefan have root-initial ġ, not a
    // separable prefix — stripping would corrupt their past-stem vowels.
    var isPrefixed = /^[ġg]e/.test(principalParts[0].normalize('NFC'));

    function stemVowel(raw) {
      var s = raw.normalize('NFC');
      if (isPrefixed) s = s.replace(/^[ġg]e-?/, '');
      var v = extractStemVowel(s);
      // VOWEL_LIST orders 'an'/'am' above 'a'/'ā' (needed for applyIMutation),
      // so sang→'an', swamm→'am' etc. Collapse to the bare vowel for ablaut.
      if (v === 'an' || v === 'am') return 'a';
      if (v === 'ān' || v === 'ām') return 'ā';
      return v;
    }

    var v = [
      stemVowel(stems.presentStem),
      stemVowel(stems.pastSgStem),
      stemVowel(stems.pastPlStem),
      stemVowel(stems.pastPartStem),
    ];
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
    var mutatedStem = applyIMutation(stems.presentStem);

    return {
      class: 'Strong ' + inferClass(verb.principalParts),
      lemma: verb.lemma,
      gloss: verb.gloss,

      presentInd: {
        sg1: stems.presentStem + 'e',
        sg2: applyCollision(mutatedStem, 'st'),
        sg3: applyCollision(mutatedStem, 'þ'),
        pl:  stems.presentStem + 'aþ',
      },
      pastInd: {
        sg1: stems.pastSgStem,
        sg2: stems.pastPlStem + 'e',
        sg3: stems.pastSgStem,
        pl:  stems.pastPlStem + 'on',
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
        infinitive:          verb.lemma,
        inflectedInfinitive: 'tō ' + stems.presentStem + 'enne',
        presentParticiple:   stems.presentStem + 'ende',
        pastParticiple:      'ġe' + stems.pastPartStem + 'en',
      },
    };
  }

  // ── conjugateWeak2 ──────────────────────────────────────────────────────────

  function conjugateWeak2(verb) {
    var stem = verb.lemma.replace(/ian$/, '');

    return {
      class: 'Weak 2',
      lemma: verb.lemma,
      gloss: verb.gloss,

      presentInd: {
        sg1: stem + 'iġe',
        sg2: stem + 'ast',
        sg3: stem + 'aþ',
        pl:  stem + 'iaþ',
      },
      pastInd: {
        sg1: stem + 'ode',
        sg2: stem + 'odest',
        sg3: stem + 'ode',
        pl:  stem + 'odon',
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
        infinitive:          verb.lemma,
        inflectedInfinitive: 'tō ' + stem + 'ianne',
        presentParticiple:   stem + 'iende',
        pastParticiple:      'ġe' + stem + 'od',
      },
    };
  }

  // ── conjugateWeak1 ──────────────────────────────────────────────────────────

  function conjugateWeak1(verb) {
    var presentStem = verb.lemma.replace(/an$/, '');
    var pastStem;

    if (verb.irregularForms && verb.irregularForms.pastStem !== undefined) {
      pastStem = verb.irregularForms.pastStem;
    } else {
      pastStem = applyCollision(presentStem, 'd');
    }

    // Don't add ġe- if the lemma already has a ge-/ġe- prefix
    var ppPrefix = /^[ġg]e/.test(verb.lemma) ? '' : 'ġe';

    return {
      class: 'Weak 1',
      lemma: verb.lemma,
      gloss: verb.gloss,

      presentInd: {
        sg1: presentStem + 'e',
        sg2: applyCollision(presentStem, 'st'),
        sg3: applyCollision(presentStem, 'þ'),
        pl:  presentStem + 'aþ',
      },
      pastInd: {
        sg1: pastStem + 'e',
        sg2: pastStem + 'est',
        sg3: pastStem + 'e',
        pl:  pastStem + 'on',
      },
      presentSubj: {
        sg: presentStem + 'e',
        pl: presentStem + 'en',
      },
      pastSubj: {
        sg: pastStem + 'e',
        pl: pastStem + 'en',
      },
      imperative: {
        sg: presentStem,
        pl: presentStem + 'aþ',
      },
      nonFinite: {
        infinitive:          verb.lemma,
        inflectedInfinitive: 'tō ' + presentStem + 'enne',
        presentParticiple:   presentStem + 'ende',
        pastParticiple:      ppPrefix + pastStem + (pastStem.slice(-1) === 'd' ? 'e' : ''),
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

  return { conjugate, inferClass, extractStems };

}());
