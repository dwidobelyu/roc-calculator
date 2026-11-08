import { describe, expect, it } from 'vitest';
import { attackElementOf, elementSource } from './skill-element';

describe('skill element source', () => {
  it('follows the arrow for arrow skills, the weapon otherwise, and ignores both for fixed or forced', () => {
    const doubleStrafe = elementSource({ element: 0, arrows: 2 }, 'physical');
    expect(doubleStrafe).toEqual({ kind: 'weapon', arrows: 2 });
    expect(attackElementOf(doubleStrafe, 3, 4)).toBe(4);
    expect(attackElementOf(doubleStrafe, 3, null)).toBe(3);
    expect(attackElementOf(elementSource({ element: -1 }, 'physical'), 3, 4)).toBe(3);
    expect(attackElementOf(elementSource({ element: 3 }, 'magic'), 1, null)).toBe(3);
    expect(attackElementOf(elementSource({ element: 10 }, 'physical'), 3, 4)).toBe(10);
    expect(attackElementOf(elementSource({ element: 0 }, 'magic'), 3, null)).toBe(0);
  });
});
