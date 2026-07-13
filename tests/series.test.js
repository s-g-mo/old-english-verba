const { Paradigm } = require('../paradigm.js');
const verbs = JSON.parse(require('fs').readFileSync('./verbs.json', 'utf8'));

// Locks in per-verb ablaut series for a handful of classes where the series
// is NOT uniform across the class (breaking, gemination, j-presents, and
// contraction all shift the vowels verb by verb). Regression coverage for
// the verbs.html "Ablaut series" display, which computes this per verb
// rather than looking it up by class label — see Paradigm.computeSeriesVowels.
describe('computeSeriesVowels', () => {
  const cases = [
    ['helpan', ['e', 'ea', 'u', 'o']],       // Class IIIb
    ['niman', ['i', 'a', 'ō', 'u']],         // Class IV, lexically irregular
    ['sittan', ['i', 'æ', 'ǣ', 'e']],        // Class V, geminated present
    ['staeppan', ['æ', 'ō', 'ō', 'a']],      // Class VI, j-present gemination
    ['hatan', ['ā', 'ē', 'ē', 'ā']],         // Class VII
  ];

  cases.forEach(([id, expected]) => {
    test(`${id} series matches its own principalParts`, () => {
      const verb = verbs.find(v => v.id === id);
      expect(verb).toBeDefined();
      expect(Paradigm.computeSeriesVowels(verb.principalParts, verb)).toEqual(expected);
    });
  });
});
