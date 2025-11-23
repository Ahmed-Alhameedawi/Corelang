/**
 * Tests for runtime value system
 */

import { describe, it, expect } from '@jest/globals';
import { ValueFactory, ValueTypeChecker, ValueOps, Value } from './value';

describe('ValueFactory', () => {
  it('should create unit value', () => {
    const v = ValueFactory.unit();
    expect(v.type).toBe('unit');
  });

  it('should create bool value', () => {
    const v = ValueFactory.bool(true);
    expect(v.type).toBe('bool');
    expect(v.value).toBe(true);
  });

  it('should create int value', () => {
    const v = ValueFactory.int(42);
    expect(v.type).toBe('int');
    expect(v.value).toBe(42);
  });

  it('should create float value', () => {
    const v = ValueFactory.float(3.14);
    expect(v.type).toBe('float');
    expect(v.value).toBe(3.14);
  });

  it('should create string value', () => {
    const v = ValueFactory.string('hello');
    expect(v.type).toBe('string');
    expect(v.value).toBe('hello');
  });

  it('should create list value', () => {
    const v = ValueFactory.list([
      ValueFactory.int(1),
      ValueFactory.int(2),
      ValueFactory.int(3),
    ]);
    expect(v.type).toBe('list');
    expect(v.value.length).toBe(3);
  });

  it('should create map value', () => {
    const m = new Map<string, Value>();
    m.set('name', ValueFactory.string('Alice'));
    m.set('age', ValueFactory.int(30));
    const v = ValueFactory.map(m);
    expect(v.type).toBe('map');
    expect(v.value.size).toBe(2);
  });

  it('should create record value', () => {
    const fields = new Map<string, Value>();
    fields.set('id', ValueFactory.int(1));
    fields.set('name', ValueFactory.string('Bob'));
    const v = ValueFactory.record('User', fields);
    expect(v.type).toBe('record');
    expect(v.typeName).toBe('User');
    expect(v.fields.size).toBe(2);
  });

  it('should create Ok result', () => {
    const v = ValueFactory.ok(ValueFactory.int(42));
    expect(v.type).toBe('result');
    expect(v.variant).toBe('ok');
  });

  it('should create Err result', () => {
    const v = ValueFactory.err(ValueFactory.string('error'));
    expect(v.type).toBe('result');
    expect(v.variant).toBe('err');
  });

  it('should create Some option', () => {
    const v = ValueFactory.some(ValueFactory.int(42));
    expect(v.type).toBe('option');
    expect(v.variant).toBe('some');
  });

  it('should create None option', () => {
    const v = ValueFactory.none();
    expect(v.type).toBe('option');
    expect(v.variant).toBe('none');
  });
});

describe('ValueTypeChecker', () => {
  it('should check unit type', () => {
    const v = ValueFactory.unit();
    expect(ValueTypeChecker.isUnit(v)).toBe(true);
    expect(ValueTypeChecker.isBool(v)).toBe(false);
  });

  it('should check bool type', () => {
    const v = ValueFactory.bool(true);
    expect(ValueTypeChecker.isBool(v)).toBe(true);
    expect(ValueTypeChecker.isInt(v)).toBe(false);
  });

  it('should check int type', () => {
    const v = ValueFactory.int(42);
    expect(ValueTypeChecker.isInt(v)).toBe(true);
    expect(ValueTypeChecker.isFloat(v)).toBe(false);
  });

  it('should check result type', () => {
    const ok = ValueFactory.ok(ValueFactory.int(42));
    const err = ValueFactory.err(ValueFactory.string('error'));
    expect(ValueTypeChecker.isResult(ok)).toBe(true);
    expect(ValueTypeChecker.isOk(ok)).toBe(true);
    expect(ValueTypeChecker.isErr(ok)).toBe(false);
    expect(ValueTypeChecker.isErr(err)).toBe(true);
  });

  it('should check option type', () => {
    const some = ValueFactory.some(ValueFactory.int(42));
    const none = ValueFactory.none();
    expect(ValueTypeChecker.isOption(some)).toBe(true);
    expect(ValueTypeChecker.isSome(some)).toBe(true);
    expect(ValueTypeChecker.isNone(some)).toBe(false);
    expect(ValueTypeChecker.isNone(none)).toBe(true);
  });
});

describe('ValueOps', () => {
  describe('toJS', () => {
    it('should convert unit to null', () => {
      const v = ValueFactory.unit();
      expect(ValueOps.toJS(v)).toBe(null);
    });

    it('should convert primitives', () => {
      expect(ValueOps.toJS(ValueFactory.bool(true))).toBe(true);
      expect(ValueOps.toJS(ValueFactory.int(42))).toBe(42);
      expect(ValueOps.toJS(ValueFactory.float(3.14))).toBe(3.14);
      expect(ValueOps.toJS(ValueFactory.string('hello'))).toBe('hello');
    });

    it('should convert list', () => {
      const v = ValueFactory.list([
        ValueFactory.int(1),
        ValueFactory.int(2),
      ]);
      expect(ValueOps.toJS(v)).toEqual([1, 2]);
    });

    it('should convert map', () => {
      const m = new Map<string, Value>();
      m.set('a', ValueFactory.int(1));
      m.set('b', ValueFactory.int(2));
      const v = ValueFactory.map(m);
      expect(ValueOps.toJS(v)).toEqual({ a: 1, b: 2 });
    });
  });

  describe('fromJS', () => {
    it('should convert null to unit', () => {
      const v = ValueOps.fromJS(null);
      expect(v.type).toBe('unit');
    });

    it('should convert primitives', () => {
      expect(ValueOps.fromJS(true)).toEqual(ValueFactory.bool(true));
      expect(ValueOps.fromJS(42)).toEqual(ValueFactory.int(42));
      expect(ValueOps.fromJS(3.14)).toEqual(ValueFactory.float(3.14));
      expect(ValueOps.fromJS('hello')).toEqual(ValueFactory.string('hello'));
    });

    it('should convert array to list', () => {
      const v = ValueOps.fromJS([1, 2, 3]);
      expect(v.type).toBe('list');
      expect(ValueTypeChecker.isList(v) && v.value.length).toBe(3);
    });
  });

  describe('equals', () => {
    it('should compare primitives', () => {
      expect(ValueOps.equals(
        ValueFactory.int(42),
        ValueFactory.int(42)
      )).toBe(true);

      expect(ValueOps.equals(
        ValueFactory.int(42),
        ValueFactory.int(43)
      )).toBe(false);

      expect(ValueOps.equals(
        ValueFactory.string('hello'),
        ValueFactory.string('hello')
      )).toBe(true);
    });

    it('should compare lists', () => {
      const list1 = ValueFactory.list([ValueFactory.int(1), ValueFactory.int(2)]);
      const list2 = ValueFactory.list([ValueFactory.int(1), ValueFactory.int(2)]);
      const list3 = ValueFactory.list([ValueFactory.int(1), ValueFactory.int(3)]);

      expect(ValueOps.equals(list1, list2)).toBe(true);
      expect(ValueOps.equals(list1, list3)).toBe(false);
    });

    it('should compare records', () => {
      const fields1 = new Map([
        ['name', ValueFactory.string('Alice')],
        ['age', ValueFactory.int(30)],
      ]);
      const fields2 = new Map([
        ['name', ValueFactory.string('Alice')],
        ['age', ValueFactory.int(30)],
      ]);
      const fields3 = new Map([
        ['name', ValueFactory.string('Bob')],
        ['age', ValueFactory.int(30)],
      ]);

      const rec1 = ValueFactory.record('User', fields1);
      const rec2 = ValueFactory.record('User', fields2);
      const rec3 = ValueFactory.record('User', fields3);

      expect(ValueOps.equals(rec1, rec2)).toBe(true);
      expect(ValueOps.equals(rec1, rec3)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should format primitives', () => {
      expect(ValueOps.toString(ValueFactory.unit())).toBe('unit');
      expect(ValueOps.toString(ValueFactory.bool(true))).toBe('true');
      expect(ValueOps.toString(ValueFactory.int(42))).toBe('42');
      expect(ValueOps.toString(ValueFactory.string('hello'))).toBe('"hello"');
    });

    it('should format list', () => {
      const v = ValueFactory.list([
        ValueFactory.int(1),
        ValueFactory.int(2),
      ]);
      expect(ValueOps.toString(v)).toBe('[1, 2]');
    });

    it('should format record', () => {
      const fields = new Map([
        ['id', ValueFactory.int(1)],
        ['name', ValueFactory.string('Alice')],
      ]);
      const v = ValueFactory.record('User', fields);
      expect(ValueOps.toString(v)).toContain('User');
      expect(ValueOps.toString(v)).toContain('id: 1');
    });

    it('should format result', () => {
      const ok = ValueFactory.ok(ValueFactory.int(42));
      const err = ValueFactory.err(ValueFactory.string('error'));
      expect(ValueOps.toString(ok)).toBe('Ok(42)');
      expect(ValueOps.toString(err)).toBe('Err("error")');
    });

    it('should format option', () => {
      const some = ValueFactory.some(ValueFactory.int(42));
      const none = ValueFactory.none();
      expect(ValueOps.toString(some)).toBe('Some(42)');
      expect(ValueOps.toString(none)).toBe('None');
    });
  });
});
