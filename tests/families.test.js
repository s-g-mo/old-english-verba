const { Paradigm } = require('../paradigm.js');
const verbs = require('../verbs.json');

describe('derived verb families (Related tags)', () => {
  const fams = Paradigm.buildFamilies(verbs);

  test('family map matches snapshot', () => {
    expect(fams).toMatchSnapshot();
  });

  test('base verb comes first on prefixed members', () => {
    expect(fams['gesittan'][0]).toBe('sittan');
    expect(fams['forsittan'][0]).toBe('sittan');
    expect(fams['geniman'][0]).toBe('niman');
    expect(fams['understandan'][0]).toBe('standan');
  });

  test('homographs and near-collisions stay separate', () => {
    // āgan "own" must not join the gān family that āgān belongs to
    expect(fams['agan']).toBeUndefined();
    expect(fams['agan-2']).toContain('gan');
    // reċċan "narrate" vs rēċan "care" — unrelated
    expect(fams['reccan']).toBeUndefined();
    expect(fams['recan']).toBeUndefined();
    // ġewītan "depart" must not join witan "know" (long vs short i)
    expect(fams['gewitan'] || []).not.toContain('witan');
    // ċīepan "sell" vs ċēapian "buy" — different verbs
    expect(fams['ciepan']).toEqual(['beciepan']);
    expect(fams['ceapian']).toBeUndefined();
  });

  test('beran does not false-strip to *ran', () => {
    expect(fams['beran']).toEqual(['aberan']);
  });

  test('families group even when the base verb is not in the DB', () => {
    expect(fams['begietan'].sort()).toEqual(['forgietan', 'ongietan']);
    expect(fams['aliesan']).toEqual(['onliesan']);
    expect(fams['onfon'].sort()).toEqual(['befon', 'underfon']);
  });

  test('two prefix layers resolve (forþ-ġe-wītan)', () => {
    expect(fams['forpgewitan']).toContain('gewitan');
  });
});
