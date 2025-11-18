/**
 * Tests for CORE Language Parser
 */

import { tokenize } from '../lexer/lexer';
import { parse, Parser } from './parser';

describe('Parser', () => {
  describe('Module Parsing', () => {
    test('should parse a simple module', () => {
      const source = `(mod test :version "1.0.0")`;
      const tokens = tokenize(source);
      const ast = parse(tokens);

      expect(ast.type).toBe('Module');
      expect(ast.name).toBe('test');
      expect(ast.metadata.version).toBe('1.0.0');
    });

    test('should parse a module with qualified name', () => {
      const source = `(mod user.service)`;
      const tokens = tokenize(source);
      const ast = parse(tokens);

      expect(ast.name).toBe('user.service');
    });
  });

  describe('Function Parsing', () => {
    test('should parse a simple function', () => {
      const source = `(mod test
        (fn greet :v1
          :inputs [(name :string)]
          :outputs [(result :string)]
          (body "Hello")))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      expect(ast.elements).toHaveLength(1);
      const fn = ast.elements[0];
      expect(fn.type).toBe('Function');
      expect((fn as any).name).toBe('greet');
      expect((fn as any).version.version).toBe('1');
    });

    test('should parse function with version info', () => {
      const source = `(mod test
        (fn get :v2
          :replaces :v1
          :stability stable
          :rollback-safe true
          :inputs []
          :outputs []
          (body true)))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      const fn = ast.elements[0] as any;
      expect(fn.version.version).toBe('2');
      expect(fn.version.replaces).toContain('1');
      expect(fn.version.stability).toBe('stable');
      expect(fn.version.rollbackSafe).toBe(true);
    });

    test('should parse function with security attributes', () => {
      const source = `(mod test
        (fn secure :v1
          :requires [admin viewer]
          :capabilities [db.write]
          :audit-required true
          :inputs []
          :outputs []
          (body true)))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      const fn = ast.elements[0] as any;
      expect(fn.security.requiredRoles).toEqual(['admin', 'viewer']);
      expect(fn.security.requiredCapabilities).toEqual(['db.write']);
      expect(fn.security.auditRequired).toBe(true);
    });

    test('should parse function with effects', () => {
      const source = `(mod test
        (fn write_data :v1
          :inputs []
          :outputs []
          :effects [(db.write "users") (log "info")]
          (body true)))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      const fn = ast.elements[0] as any;
      expect(fn.effects).toHaveLength(2);
      expect(fn.effects[0].effectType).toBe('db.write');
      expect(fn.effects[0].target).toBe('users');
    });

    test('should parse function metadata', () => {
      const source = `(mod test
        (fn documented :v1
          :doc "This is a documented function"
          :pure true
          :idempotent false
          :inputs []
          :outputs []
          (body 42)))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      const fn = ast.elements[0] as any;
      expect(fn.metadata.doc).toBe('This is a documented function');
      expect(fn.metadata.pure).toBe(true);
      expect(fn.metadata.idempotent).toBe(false);
    });
  });

  describe('Type Parsing', () => {
    test('should parse a simple type definition', () => {
      const source = `(mod test
        (type User :v1
          :fields [
            (id :uuid)
            (name :string)]))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      expect(ast.elements).toHaveLength(1);
      const typeDef = ast.elements[0];
      expect(typeDef.type).toBe('TypeDef');
      expect((typeDef as any).name).toBe('User');
      expect((typeDef as any).fields).toHaveLength(2);
    });

    test('should parse type with data classification', () => {
      const source = `(mod test
        (type User :v1
          :fields [
            (id :uuid :classify :public)
            (email :string :classify :internal)
            (ssn :string :classify :restricted)]))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      const typeDef = ast.elements[0] as any;
      expect(typeDef.fields[0].classification).toBe('public');
      expect(typeDef.fields[1].classification).toBe('internal');
      expect(typeDef.fields[2].classification).toBe('restricted');
    });
  });

  describe('Expression Parsing', () => {
    test('should parse literal expressions', () => {
      const source = `(mod test
        (fn test :v1
          :inputs []
          :outputs []
          (body 42)))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      const fn = ast.elements[0] as any;
      expect(fn.body.type).toBe('Literal');
      expect(fn.body.value).toBe(42);
      expect(fn.body.literalType).toBe('number');
    });

    test('should parse string literals', () => {
      const source = `(mod test
        (fn test :v1
          :inputs []
          :outputs []
          (body "hello")))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      const fn = ast.elements[0] as any;
      expect(fn.body.type).toBe('Literal');
      expect(fn.body.value).toBe('hello');
      expect(fn.body.literalType).toBe('string');
    });

    test('should parse identifiers', () => {
      const source = `(mod test
        (fn test :v1
          :inputs []
          :outputs []
          (body user_id)))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      const fn = ast.elements[0] as any;
      expect(fn.body.type).toBe('Identifier');
      expect(fn.body.name).toBe('user_id');
    });

    test('should parse let expressions', () => {
      const source = `(mod test
        (fn test :v1
          :inputs []
          :outputs []
          (body
            (let [x 10 y 20]
              x))))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      const fn = ast.elements[0] as any;
      expect(fn.body.type).toBe('Let');
      expect(fn.body.bindings).toHaveLength(2);
      expect(fn.body.bindings[0].name).toBe('x');
      expect(fn.body.bindings[0].value.value).toBe(10);
    });

    test('should parse if expressions', () => {
      const source = `(mod test
        (fn test :v1
          :inputs []
          :outputs []
          (body
            (if true
              1
              2))))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      const fn = ast.elements[0] as any;
      expect(fn.body.type).toBe('If');
      expect(fn.body.condition.value).toBe(true);
      expect(fn.body.thenBranch.value).toBe(1);
      expect(fn.body.elseBranch.value).toBe(2);
    });

    test('should parse function calls', () => {
      const source = `(mod test
        (fn test :v1
          :inputs []
          :outputs []
          (body
            (add 1 2))))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      const fn = ast.elements[0] as any;
      expect(fn.body.type).toBe('Call');
      expect(fn.body.function.parts).toEqual(['add']);
      expect(fn.body.args).toHaveLength(2);
    });
  });

  describe('Complete Program', () => {
    test('should parse hello world example', () => {
      const source = `(mod hello
        :version "1.0.0"

        (fn greet :v1
          :stability stable
          :rollback-safe true
          :inputs [(name :string)]
          :outputs [(greeting :string)]
          :pure true
          :doc "Generate a greeting message"
          (body "Hello")))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      expect(ast.type).toBe('Module');
      expect(ast.name).toBe('hello');
      expect(ast.metadata.version).toBe('1.0.0');
      expect(ast.elements).toHaveLength(1);

      const fn = ast.elements[0] as any;
      expect(fn.name).toBe('greet');
      expect(fn.version.version).toBe('1');
      expect(fn.version.stability).toBe('stable');
      expect(fn.signature.inputs).toHaveLength(1);
      expect(fn.signature.outputs).toHaveLength(1);
      expect(fn.metadata.pure).toBe(true);
      expect(fn.metadata.doc).toBe('Generate a greeting message');
    });
  });
});
