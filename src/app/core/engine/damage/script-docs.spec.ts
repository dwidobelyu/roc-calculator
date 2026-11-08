import { describe, expect, it } from 'vitest';
import { portedScripts } from './damage-formulas';
import { SCRIPT_DOCS, describeScript } from './script-docs';

describe('script docs', () => {
  it('documents every ported script and nothing else', () => {
    expect(portedScripts().filter((s) => !SCRIPT_DOCS[s])).toEqual([]);
    expect(Object.keys(SCRIPT_DOCS).filter((s) => !portedScripts().includes(s))).toEqual([]);
  });

  it('marks unported scripts as approximated with the generic doc', () => {
    const info = describeScript('SomeUnportedScript', 2);
    expect(info.status).toBe('approximated');
    expect(info.formula?.script).toBe('MagicSkillCalc');
    expect(info.doc).toBe(SCRIPT_DOCS['MagicSkillCalc']);
    expect(describeScript('DamageNil', 1).status).toBe('none');
  });
});
