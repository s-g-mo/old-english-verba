const { Paradigm } = require('../paradigm.js');
const verbs = JSON.parse(require('fs').readFileSync('./verbs.json', 'utf8'));

describe('conjugation snapshots', () => {
  verbs.forEach(verb => {
    test(`${verb.id} conjugation matches snapshot`, () => {
      const result = Paradigm.conjugate(verb);
      expect(result).toMatchSnapshot();
    });
  });
});
