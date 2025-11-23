/**
 * Tests for Security Analyzer
 */

import { tokenize } from '../lexer/lexer';
import { parse } from '../parser/parser';
import { SecurityContext, SecurityAnalyzer } from './analyzer';
import { DiagnosticBuilder } from '../diagnostics/diagnostic';

describe('SecurityContext', () => {
  let context: SecurityContext;

  beforeEach(() => {
    context = new SecurityContext();
  });

  test('should register and retrieve roles', () => {
    const source = `(mod test
      (role admin :perms [user.write]))`;
    const tokens = tokenize(source);
    const ast = parse(tokens);

    const role = ast.elements[0] as any;
    context.registerRole(role);

    const retrieved = context.getRole('admin');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('admin');
  });

  test('should register and retrieve permissions', () => {
    const source = `(mod test
      (perm user.write :audit-required true))`;
    const tokens = tokenize(source);
    const ast = parse(tokens);

    const perm = ast.elements[0] as any;
    context.registerPermission(perm);

    const retrieved = context.getPermission('user.write');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('user.write');
  });

  test('should check if role has permission', () => {
    const source = `(mod test
      (role admin :perms [user.write user.read]))`;
    const tokens = tokenize(source);
    const ast = parse(tokens);

    const role = ast.elements[0] as any;
    context.registerRole(role);

    expect(context.roleHasPermission('admin', 'user.write')).toBe(true);
    expect(context.roleHasPermission('admin', 'user.delete')).toBe(false);
  });

  test('should check inherited permissions', () => {
    const source = `(mod test
      (role viewer :perms [user.read])
      (role admin :perms [user.write] :inherits [viewer]))`;
    const tokens = tokenize(source);
    const ast = parse(tokens);

    context.registerRole(ast.elements[0] as any);
    context.registerRole(ast.elements[1] as any);

    expect(context.roleHasPermission('admin', 'user.write')).toBe(true);
    expect(context.roleHasPermission('admin', 'user.read')).toBe(true);
    expect(context.roleHasPermission('viewer', 'user.write')).toBe(false);
  });

  test('should get all role permissions including inherited', () => {
    const source = `(mod test
      (role base :perms [data.a data.b])
      (role derived :perms [data.c] :inherits [base]))`;
    const tokens = tokenize(source);
    const ast = parse(tokens);

    context.registerRole(ast.elements[0] as any);
    context.registerRole(ast.elements[1] as any);

    const perms = context.getRolePermissions('derived');
    expect(perms).toContain('data.a');
    expect(perms).toContain('data.b');
    expect(perms).toContain('data.c');
    expect(perms).toHaveLength(3);
  });
});

describe('SecurityAnalyzer', () => {
  let context: SecurityContext;
  let diagnostics: DiagnosticBuilder;
  let analyzer: SecurityAnalyzer;

  beforeEach(() => {
    context = new SecurityContext();
    diagnostics = new DiagnosticBuilder();
    analyzer = new SecurityAnalyzer(context, diagnostics);
  });

  test('should validate role references in policies', () => {
    const source = `(mod test
      (role admin :perms [user.write])
      (policy default
        :rules [(allow [admin] [user.write] :all-versions)]))`;
    const tokens = tokenize(source);
    const ast = parse(tokens);

    analyzer.analyzeModule(ast);

    const diags = diagnostics.build();
    expect(diags.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  test('should detect undefined role in policy', () => {
    const source = `(mod test
      (policy default
        :rules [(allow [nonexistent] [user.write] :all-versions)]))`;
    const tokens = tokenize(source);
    const ast = parse(tokens);

    analyzer.analyzeModule(ast);

    const diags = diagnostics.build();
    const errors = diags.filter(d => d.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('undefined role');
    expect(errors[0].code).toBe('SEC004');
  });

  test('should detect undefined role in role inheritance', () => {
    const source = `(mod test
      (role admin :perms [user.write] :inherits [nonexistent]))`;
    const tokens = tokenize(source);
    const ast = parse(tokens);

    analyzer.analyzeModule(ast);

    const diags = diagnostics.build();
    const errors = diags.filter(d => d.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('inherits from undefined role');
    expect(errors[0].code).toBe('SEC001');
  });

  test('should detect circular role inheritance', () => {
    const source = `(mod test
      (role a :perms [] :inherits [b])
      (role b :perms [] :inherits [a]))`;
    const tokens = tokenize(source);
    const ast = parse(tokens);

    analyzer.analyzeModule(ast);

    const diags = diagnostics.build();
    const errors = diags.filter(d => d.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('circular inheritance');
    expect(errors[0].code).toBe('SEC002');
  });

  test('should warn on undefined permission in role', () => {
    const source = `(mod test
      (role admin :perms [undefined.permission]))`;
    const tokens = tokenize(source);
    const ast = parse(tokens);

    analyzer.analyzeModule(ast);

    const diags = diagnostics.build();
    const warnings = diags.filter(d => d.severity === 'warning');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('undefined permission');
    expect(warnings[0].code).toBe('SEC003');
  });

  test('should detect undefined role in function requirements', () => {
    const source = `(mod test
      (fn process :v1
        :requires [nonexistent]
        :inputs []
        :outputs []
        (body true)))`;
    const tokens = tokenize(source);
    const ast = parse(tokens);

    analyzer.analyzeModule(ast);

    const diags = diagnostics.build();
    const errors = diags.filter(d => d.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('requires undefined role');
    expect(errors[0].code).toBe('SEC006');
  });

  test('should warn when function handles secrets without audit', () => {
    const source = `(mod test
      (fn store_secret :v1
        :inputs []
        :outputs []
        (body true)))`;
    const tokens = tokenize(source);
    const ast = parse(tokens);

    // Manually set handlesSecrets (parser doesn't support :handles-secrets yet)
    const fn = ast.elements[0] as any;
    fn.security.handlesSecrets = true;
    fn.security.auditRequired = false;

    analyzer.analyzeModule(ast);

    const diags = diagnostics.build();
    const warnings = diags.filter(d => d.severity === 'warning');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('handles secrets but audit is not required');
    expect(warnings[0].code).toBe('SEC008');
  });

  test('should validate complete security model', () => {
    const source = `(mod test
      (role viewer :perms [user.read])
      (role editor :perms [user.write] :inherits [viewer])
      (role admin :perms [user.delete] :inherits [editor])

      (perm user.read :audit-required false)
      (perm user.write :audit-required true)
      (perm user.delete :audit-required true)

      (policy default
        :rules [
          (allow [viewer] [user.read] :all-versions)
          (allow [editor] [user.write] :all-versions)
          (allow [admin] [user.delete] :all-versions)])

      (fn read_user :v1
        :requires [viewer]
        :inputs []
        :outputs []
        (body true))

      (fn update_user :v1
        :requires [editor]
        :audit-required true
        :inputs []
        :outputs []
        (body true))

      (fn delete_user :v1
        :requires [admin]
        :audit-required true
        :inputs []
        :outputs []
        (body true)))`;

    const tokens = tokenize(source);
    const ast = parse(tokens);

    analyzer.analyzeModule(ast);

    const diags = diagnostics.build();
    const errors = diags.filter(d => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  test('should check role access to functions', () => {
    const source = `(mod test
      (role viewer :perms [data.read])
      (role admin :perms [data.write] :inherits [viewer])

      (fn read_data :v1
        :requires [viewer]
        :inputs []
        :outputs []
        (body true))

      (fn write_data :v1
        :requires [admin]
        :inputs []
        :outputs []
        (body true)))`;

    const tokens = tokenize(source);
    const ast = parse(tokens);

    analyzer.analyzeModule(ast);

    expect(analyzer.canRoleAccessFunction('viewer', 'read_data')).toBe(true);
    expect(analyzer.canRoleAccessFunction('viewer', 'write_data')).toBe(false);
    expect(analyzer.canRoleAccessFunction('admin', 'read_data')).toBe(true);
    expect(analyzer.canRoleAccessFunction('admin', 'write_data')).toBe(true);
  });

  test('should validate data classification in types', () => {
    const source = `(mod test
      (type User :v1
        :fields [
          (id :uuid :classify :public)
          (email :string :classify :internal)
          (ssn :string :classify :confidential)])

      (fn process_user :v1
        :inputs [(user User)]
        :outputs []
        (body true)))`;

    const tokens = tokenize(source);
    const ast = parse(tokens);

    analyzer.analyzeModule(ast);

    const diags = diagnostics.build();
    const warnings = diags.filter(d => d.severity === 'warning');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toContain('confidential data but audit is not required');
    expect(warnings[0].code).toBe('SEC009');
  });
});
