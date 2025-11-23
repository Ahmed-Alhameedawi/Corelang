/**
 * Runtime value representation for CORE VM
 *
 * All values in the CORE runtime are type-tagged for safety and debugging.
 */

/**
 * Classification levels for data
 */
export type ClassificationLevel = 'public' | 'internal' | 'confidential' | 'restricted';

/**
 * Runtime value types
 */
export type Value =
  | UnitValue
  | BoolValue
  | IntValue
  | FloatValue
  | StringValue
  | BytesValue
  | UuidValue
  | TimestampValue
  | JsonValue
  | ListValue
  | MapValue
  | RecordValue
  | VariantValue
  | FunctionValue
  | ResultValue
  | OptionValue;

export interface UnitValue {
  type: 'unit';
}

export interface BoolValue {
  type: 'bool';
  value: boolean;
}

export interface IntValue {
  type: 'int';
  value: number;
}

export interface FloatValue {
  type: 'float';
  value: number;
}

export interface StringValue {
  type: 'string';
  value: string;
}

export interface BytesValue {
  type: 'bytes';
  value: Uint8Array;
}

export interface UuidValue {
  type: 'uuid';
  value: string; // UUID string representation
}

export interface TimestampValue {
  type: 'timestamp';
  value: Date;
}

export interface JsonValue {
  type: 'json';
  value: any;
}

export interface ListValue {
  type: 'list';
  value: Value[];
}

export interface MapValue {
  type: 'map';
  value: Map<string, Value>; // Keys are stringified for simplicity
}

export interface RecordValue {
  type: 'record';
  typeName: string;
  fields: Map<string, Value>;
  classification?: ClassificationLevel;
}

export interface VariantValue {
  type: 'variant';
  typeName: string;
  variant: string;
  data?: Value;
}

export interface FunctionValue {
  type: 'function';
  name: string;
  version: string;
}

export interface ResultValue {
  type: 'result';
  variant: 'ok' | 'err';
  value: Value;
}

export interface OptionValue {
  type: 'option';
  variant: 'some' | 'none';
  value?: Value;
}

/**
 * Helper functions for creating values
 */
export class ValueFactory {
  static unit(): UnitValue {
    return { type: 'unit' };
  }

  static bool(value: boolean): BoolValue {
    return { type: 'bool', value };
  }

  static int(value: number): IntValue {
    return { type: 'int', value: Math.floor(value) };
  }

  static float(value: number): FloatValue {
    return { type: 'float', value };
  }

  static string(value: string): StringValue {
    return { type: 'string', value };
  }

  static bytes(value: Uint8Array): BytesValue {
    return { type: 'bytes', value };
  }

  static uuid(value: string): UuidValue {
    return { type: 'uuid', value };
  }

  static timestamp(value: Date): TimestampValue {
    return { type: 'timestamp', value };
  }

  static json(value: any): JsonValue {
    return { type: 'json', value };
  }

  static list(value: Value[]): ListValue {
    return { type: 'list', value };
  }

  static map(value: Map<string, Value>): MapValue {
    return { type: 'map', value };
  }

  static record(typeName: string, fields: Map<string, Value>, classification?: ClassificationLevel): RecordValue {
    return { type: 'record', typeName, fields, classification };
  }

  static variant(typeName: string, variant: string, data?: Value): VariantValue {
    return { type: 'variant', typeName, variant, data };
  }

  static function(name: string, version: string): FunctionValue {
    return { type: 'function', name, version };
  }

  static ok(value: Value): ResultValue {
    return { type: 'result', variant: 'ok', value };
  }

  static err(value: Value): ResultValue {
    return { type: 'result', variant: 'err', value };
  }

  static some(value: Value): OptionValue {
    return { type: 'option', variant: 'some', value };
  }

  static none(): OptionValue {
    return { type: 'option', variant: 'none' };
  }
}

/**
 * Value type checking
 */
export class ValueTypeChecker {
  static isUnit(value: Value): value is UnitValue {
    return value.type === 'unit';
  }

  static isBool(value: Value): value is BoolValue {
    return value.type === 'bool';
  }

  static isInt(value: Value): value is IntValue {
    return value.type === 'int';
  }

  static isFloat(value: Value): value is FloatValue {
    return value.type === 'float';
  }

  static isString(value: Value): value is StringValue {
    return value.type === 'string';
  }

  static isBytes(value: Value): value is BytesValue {
    return value.type === 'bytes';
  }

  static isUuid(value: Value): value is UuidValue {
    return value.type === 'uuid';
  }

  static isTimestamp(value: Value): value is TimestampValue {
    return value.type === 'timestamp';
  }

  static isJson(value: Value): value is JsonValue {
    return value.type === 'json';
  }

  static isList(value: Value): value is ListValue {
    return value.type === 'list';
  }

  static isMap(value: Value): value is MapValue {
    return value.type === 'map';
  }

  static isRecord(value: Value): value is RecordValue {
    return value.type === 'record';
  }

  static isVariant(value: Value): value is VariantValue {
    return value.type === 'variant';
  }

  static isFunction(value: Value): value is FunctionValue {
    return value.type === 'function';
  }

  static isResult(value: Value): value is ResultValue {
    return value.type === 'result';
  }

  static isOption(value: Value): value is OptionValue {
    return value.type === 'option';
  }

  static isOk(value: Value): boolean {
    return this.isResult(value) && value.variant === 'ok';
  }

  static isErr(value: Value): boolean {
    return this.isResult(value) && value.variant === 'err';
  }

  static isSome(value: Value): boolean {
    return this.isOption(value) && value.variant === 'some';
  }

  static isNone(value: Value): boolean {
    return this.isOption(value) && value.variant === 'none';
  }
}

/**
 * Value operations
 */
export class ValueOps {
  /**
   * Convert value to JavaScript representation
   */
  static toJS(value: Value): any {
    switch (value.type) {
      case 'unit':
        return null;
      case 'bool':
      case 'int':
      case 'float':
      case 'string':
      case 'uuid':
        return value.value;
      case 'bytes':
        return Array.from(value.value);
      case 'timestamp':
        return value.value.toISOString();
      case 'json':
        return value.value;
      case 'list':
        return value.value.map(v => this.toJS(v));
      case 'map':
        const obj: any = {};
        value.value.forEach((v, k) => {
          obj[k] = this.toJS(v);
        });
        return obj;
      case 'record':
        const record: any = {};
        value.fields.forEach((v, k) => {
          record[k] = this.toJS(v);
        });
        return record;
      case 'variant':
        return {
          variant: value.variant,
          data: value.data ? this.toJS(value.data) : undefined,
        };
      case 'function':
        return `<function ${value.name}:${value.version}>`;
      case 'result':
        return {
          type: value.variant,
          value: this.toJS(value.value),
        };
      case 'option':
        return value.variant === 'some' && value.value
          ? this.toJS(value.value)
          : null;
    }
  }

  /**
   * Convert JavaScript value to CORE value
   */
  static fromJS(jsValue: any): Value {
    if (jsValue === null || jsValue === undefined) {
      return ValueFactory.unit();
    }

    if (typeof jsValue === 'boolean') {
      return ValueFactory.bool(jsValue);
    }

    if (typeof jsValue === 'number') {
      return Number.isInteger(jsValue)
        ? ValueFactory.int(jsValue)
        : ValueFactory.float(jsValue);
    }

    if (typeof jsValue === 'string') {
      return ValueFactory.string(jsValue);
    }

    if (Array.isArray(jsValue)) {
      return ValueFactory.list(jsValue.map(v => this.fromJS(v)));
    }

    if (jsValue instanceof Uint8Array) {
      return ValueFactory.bytes(jsValue);
    }

    if (jsValue instanceof Date) {
      return ValueFactory.timestamp(jsValue);
    }

    if (typeof jsValue === 'object') {
      const map = new Map<string, Value>();
      for (const [key, value] of Object.entries(jsValue)) {
        map.set(key, this.fromJS(value));
      }
      return ValueFactory.map(map);
    }

    // Fallback to JSON
    return ValueFactory.json(jsValue);
  }

  /**
   * Deep equality check
   */
  static equals(a: Value, b: Value): boolean {
    if (a.type !== b.type) {
      return false;
    }

    switch (a.type) {
      case 'unit':
        return true;
      case 'bool':
      case 'int':
      case 'float':
      case 'string':
      case 'uuid':
        return a.value === (b as any).value;
      case 'bytes':
        const aBytes = a.value;
        const bBytes = (b as BytesValue).value;
        if (aBytes.length !== bBytes.length) return false;
        return aBytes.every((byte, i) => byte === bBytes[i]);
      case 'timestamp':
        return a.value.getTime() === (b as TimestampValue).value.getTime();
      case 'json':
        return JSON.stringify(a.value) === JSON.stringify((b as JsonValue).value);
      case 'list':
        const aList = a.value;
        const bList = (b as ListValue).value;
        if (aList.length !== bList.length) return false;
        return aList.every((item, i) => this.equals(item, bList[i]));
      case 'map':
        const aMap = a.value;
        const bMap = (b as MapValue).value;
        if (aMap.size !== bMap.size) return false;
        for (const [key, aVal] of aMap.entries()) {
          const bVal = bMap.get(key);
          if (!bVal || !this.equals(aVal, bVal)) return false;
        }
        return true;
      case 'record':
        const aRecord = a as RecordValue;
        const bRecord = b as RecordValue;
        if (aRecord.typeName !== bRecord.typeName) return false;
        if (aRecord.fields.size !== bRecord.fields.size) return false;
        for (const [key, aVal] of aRecord.fields.entries()) {
          const bVal = bRecord.fields.get(key);
          if (!bVal || !this.equals(aVal, bVal)) return false;
        }
        return true;
      case 'variant':
        const aVariant = a as VariantValue;
        const bVariant = b as VariantValue;
        if (aVariant.typeName !== bVariant.typeName) return false;
        if (aVariant.variant !== bVariant.variant) return false;
        if (!aVariant.data && !bVariant.data) return true;
        if (!aVariant.data || !bVariant.data) return false;
        return this.equals(aVariant.data, bVariant.data);
      case 'function':
        return a.name === (b as FunctionValue).name && a.version === (b as FunctionValue).version;
      case 'result':
        const aResult = a as ResultValue;
        const bResult = b as ResultValue;
        return aResult.variant === bResult.variant && this.equals(aResult.value, bResult.value);
      case 'option':
        const aOption = a as OptionValue;
        const bOption = b as OptionValue;
        if (aOption.variant !== bOption.variant) return false;
        if (aOption.variant === 'none') return true;
        return this.equals(aOption.value!, bOption.value!);
    }
  }

  /**
   * Get string representation for debugging
   */
  static toString(value: Value): string {
    switch (value.type) {
      case 'unit':
        return 'unit';
      case 'bool':
        return value.value.toString();
      case 'int':
      case 'float':
        return value.value.toString();
      case 'string':
        return `"${value.value}"`;
      case 'bytes':
        return `<bytes[${value.value.length}]>`;
      case 'uuid':
        return value.value;
      case 'timestamp':
        return value.value.toISOString();
      case 'json':
        return JSON.stringify(value.value);
      case 'list':
        return `[${value.value.map(v => this.toString(v)).join(', ')}]`;
      case 'map':
        const entries = Array.from(value.value.entries())
          .map(([k, v]) => `${k}: ${this.toString(v)}`)
          .join(', ');
        return `{${entries}}`;
      case 'record':
        const fields = Array.from(value.fields.entries())
          .map(([k, v]) => `${k}: ${this.toString(v)}`)
          .join(', ');
        return `${value.typeName} {${fields}}`;
      case 'variant':
        return value.data
          ? `${value.typeName}.${value.variant}(${this.toString(value.data)})`
          : `${value.typeName}.${value.variant}`;
      case 'function':
        return `<fn ${value.name}:${value.version}>`;
      case 'result':
        return value.variant === 'ok'
          ? `Ok(${this.toString(value.value)})`
          : `Err(${this.toString(value.value)})`;
      case 'option':
        return value.variant === 'some'
          ? `Some(${this.toString(value.value!)})`
          : 'None';
    }
  }
}
