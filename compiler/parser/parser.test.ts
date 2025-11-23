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

  describe('Security Primitive Parsing', () => {
    test('should parse a role definition', () => {
      const source = `(mod test
        (role admin
          :perms [user.read user.write user.delete]))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      expect(ast.elements).toHaveLength(1);
      const role = ast.elements[0];
      expect(role.type).toBe('Role');
      expect((role as any).name).toBe('admin');
      expect((role as any).permissions).toEqual(['user.read', 'user.write', 'user.delete']);
      expect((role as any).inherits).toEqual([]);
    });

    test('should parse a role with inheritance', () => {
      const source = `(mod test
        (role superadmin
          :perms [system.admin]
          :inherits [admin viewer]))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      const role = ast.elements[0] as any;
      expect(role.name).toBe('superadmin');
      expect(role.permissions).toEqual(['system.admin']);
      expect(role.inherits).toEqual(['admin', 'viewer']);
    });

    test('should parse a permission definition', () => {
      const source = `(mod test
        (perm user.write
          :doc "Write user data"
          :classify :confidential
          :audit-required true))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      expect(ast.elements).toHaveLength(1);
      const perm = ast.elements[0];
      expect(perm.type).toBe('Permission');
      expect((perm as any).name).toBe('user.write');
      expect((perm as any).description).toBe('Write user data');
      expect((perm as any).classification).toBe('confidential');
      expect((perm as any).auditRequired).toBe(true);
    });

    test('should parse a permission with scope', () => {
      const source = `(mod test
        (perm db.read
          :scope [(resource "users") (action "SELECT")]
          :audit-required false))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      const perm = ast.elements[0] as any;
      expect(perm.name).toBe('db.read');
      expect(perm.scope).toHaveLength(2);
      expect(perm.scope[0]).toEqual({ type: 'resource', value: 'users' });
      expect(perm.scope[1]).toEqual({ type: 'action', value: 'SELECT' });
      expect(perm.auditRequired).toBe(false);
    });

    test('should parse a policy definition', () => {
      const source = `(mod test
        (policy default
          :doc "Default access policy"
          :rules [
            (allow [admin] [user.read user.write] :all-versions)
            (deny [viewer] [user.delete] :stable-only)]))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      expect(ast.elements).toHaveLength(1);
      const policy = ast.elements[0];
      expect(policy.type).toBe('Policy');
      expect((policy as any).name).toBe('default');
      expect((policy as any).description).toBe('Default access policy');
      expect((policy as any).rules).toHaveLength(2);

      const rule1 = (policy as any).rules[0];
      expect(rule1.effect).toBe('allow');
      expect(rule1.roles).toEqual(['admin']);
      expect(rule1.permissions).toEqual(['user.read', 'user.write']);
      expect(rule1.versionConstraint).toEqual({ type: 'all' });

      const rule2 = (policy as any).rules[1];
      expect(rule2.effect).toBe('deny');
      expect(rule2.roles).toEqual(['viewer']);
      expect(rule2.permissions).toEqual(['user.delete']);
      expect(rule2.versionConstraint).toEqual({ type: 'stable-only' });
    });

    test('should parse a policy with version range constraints', () => {
      const source = `(mod test
        (policy versioned
          :rules [
            (allow [admin] [data.read] :versions ["1.0.0" "2.0.0"])
            (allow [viewer] [data.read] :range ">=1.0.0 <2.0.0")]))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      const policy = ast.elements[0] as any;
      expect(policy.rules).toHaveLength(2);

      const rule1 = policy.rules[0];
      expect(rule1.versionConstraint).toEqual({
        type: 'specific',
        versions: ['1.0.0', '2.0.0']
      });

      const rule2 = policy.rules[1];
      expect(rule2.versionConstraint).toEqual({
        type: 'range',
        range: '>=1.0.0 <2.0.0'
      });
    });

    test('should parse a policy with reason', () => {
      const source = `(mod test
        (policy restricted
          :rules [
            (deny [contractor] [system.admin] :all-versions :reason "Contractors cannot have admin access")]))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      const policy = ast.elements[0] as any;
      const rule = policy.rules[0];
      expect(rule.reason).toBe('Contractors cannot have admin access');
    });

    test('should parse a module with mixed elements', () => {
      const source = `(mod security
        (role admin :perms [user.write])
        (perm user.write :audit-required true)
        (policy default
          :rules [(allow [admin] [user.write] :all-versions)])
        (fn process :v1
          :requires [admin]
          :inputs []
          :outputs []
          (body true)))`;

      const tokens = tokenize(source);
      const ast = parse(tokens);

      expect(ast.elements).toHaveLength(4);
      expect(ast.elements[0].type).toBe('Role');
      expect(ast.elements[1].type).toBe('Permission');
      expect(ast.elements[2].type).toBe('Policy');
      expect(ast.elements[3].type).toBe('Function');
    });
  });
});
