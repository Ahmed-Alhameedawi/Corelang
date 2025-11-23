/**
 * Tests for Policy Evaluation Engine
 */

import { tokenize } from '../lexer/lexer';
import { parse } from '../parser/parser';
import { SecurityContext } from './analyzer';
import { PolicyEvaluator } from './policy';

describe('PolicyEvaluator', () => {
  let context: SecurityContext;
  let evaluator: PolicyEvaluator;

  beforeEach(() => {
    context = new SecurityContext();
    evaluator = new PolicyEvaluator(context);
  });

  test('should allow access based on policy rule', () => {
    const source = `(mod test
      (role admin :perms [user.write])
      (perm user.write :audit-required true)
      (policy default
        :rules [(allow [admin] [user.write] :all-versions)])
      (fn update_user :v1
        :requires [admin]
        :inputs []
        :outputs []
        (body true)))`;

    const tokens = tokenize(source);
    const ast = parse(tokens);

    ast.elements.forEach((el: any) => {
      if (el.type === 'Role') context.registerRole(el);
      if (el.type === 'Permission') context.registerPermission(el);
      if (el.type === 'Policy') context.registerPolicy(el);
      if (el.type === 'Function') context.registerFunction(el);
    });

    const decision = evaluator.evaluate({
      role: 'admin',
      functionName: 'update_user',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.policy).toBe('default');
  });

  test('should deny access when role not in policy', () => {
    const source = `(mod test
      (role viewer :perms [user.read])
      (role admin :perms [user.write])
      (policy default
        :rules [(allow [admin] [user.write] :all-versions)])
      (fn update_user :v1
        :requires [admin]
        :inputs []
        :outputs []
        (body true)))`;

    const tokens = tokenize(source);
    const ast = parse(tokens);

    ast.elements.forEach((el: any) => {
      if (el.type === 'Role') context.registerRole(el);
      if (el.type === 'Policy') context.registerPolicy(el);
      if (el.type === 'Function') context.registerFunction(el);
    });

    const decision = evaluator.evaluate({
      role: 'viewer',
      functionName: 'update_user',
    });

    expect(decision.allowed).toBe(false);
  });

  test('should deny access with explicit deny rule', () => {
    const source = `(mod test
      (role contractor :perms [data.read])
      (policy security
        :rules [(deny [contractor] [data.read] :all-versions)])
      (fn read_data :v1
        :requires [contractor]
        :inputs []
        :outputs []
        (body true)))`;

    const tokens = tokenize(source);
    const ast = parse(tokens);

    ast.elements.forEach((el: any) => {
      if (el.type === 'Role') context.registerRole(el);
      if (el.type === 'Policy') context.registerPolicy(el);
      if (el.type === 'Function') context.registerFunction(el);
    });

    const decision = evaluator.evaluate({
      role: 'contractor',
      functionName: 'read_data',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.matchedRule?.effect).toBe('deny');
  });

  test('should respect role inheritance in evaluation', () => {
    const source = `(mod test
      (role viewer :perms [data.read])
      (role admin :perms [data.write] :inherits [viewer])
      (policy default
        :rules [(allow [viewer] [data.read] :all-versions)])
      (fn read_data :v1
        :requires [viewer]
        :inputs []
        :outputs []
        (body true)))`;

    const tokens = tokenize(source);
    const ast = parse(tokens);

    ast.elements.forEach((el: any) => {
      if (el.type === 'Role') context.registerRole(el);
      if (el.type === 'Policy') context.registerPolicy(el);
      if (el.type === 'Function') context.registerFunction(el);
    });

    // Admin inherits from viewer, so should be able to access viewer functions
    const decision = evaluator.evaluate({
      role: 'admin',
      functionName: 'read_data',
    });

    expect(decision.allowed).toBe(true);
  });

  test('should enforce stable-only version constraint', () => {
    const source = `(mod test
      (role user :perms [api.call])
      (perm api.call :audit-required false)
      (policy versioning
        :rules [(allow [user] [api.call] :stable-only)])
      (fn call_api :v1
        :stability beta
        :requires [user]
        :inputs []
        :outputs []
        (body true)))`;

    const tokens = tokenize(source);
    const ast = parse(tokens);

    ast.elements.forEach((el: any) => {
      if (el.type === 'Role') context.registerRole(el);
      if (el.type === 'Permission') context.registerPermission(el);
      if (el.type === 'Policy') context.registerPolicy(el);
      if (el.type === 'Function') {
        // Manually set permission requirements since parser doesn't support :permissions yet
        el.security.requiredPermissions = ['api.call'];
        context.registerFunction(el);
      }
    });

    // Should deny because version is beta (not stable)
    const decision = evaluator.evaluate({
      role: 'user',
      functionName: 'call_api',
      functionVersion: '1.0.0-beta',
    });

    expect(decision.allowed).toBe(false);
  });

  test('should allow stable version with stable-only constraint', () => {
    const source = `(mod test
      (role user :perms [api.call])
      (policy versioning
        :rules [(allow [user] [api.call] :stable-only)])
      (fn call_api :v1.0.0
        :requires [user]
        :inputs []
        :outputs []
        (body true)))`;

    const tokens = tokenize(source);
    const ast = parse(tokens);

    ast.elements.forEach((el: any) => {
      if (el.type === 'Role') context.registerRole(el);
      if (el.type === 'Policy') context.registerPolicy(el);
      if (el.type === 'Function') context.registerFunction(el);
    });

    const decision = evaluator.evaluate({
      role: 'user',
      functionName: 'call_api',
      functionVersion: '1.0.0',
    });

    expect(decision.allowed).toBe(true);
  });

  test('should enforce specific version constraint', () => {
    const source = `(mod test
      (role tester :perms [test.run])
      (policy testing
        :rules [(allow [tester] [test.run] :versions ["1.0.0" "2.0.0"])])
      (fn run_test :v1.5.0
        :requires [tester]
        :inputs []
        :outputs []
        (body true)))`;

    const tokens = tokenize(source);
    const ast = parse(tokens);

    ast.elements.forEach((el: any) => {
      if (el.type === 'Role') context.registerRole(el);
      if (el.type === 'Policy') context.registerPolicy(el);
      if (el.type === 'Function') context.registerFunction(el);
    });

    // Should deny because 1.5.0 is not in the allowed list
    const decision = evaluator.evaluate({
      role: 'tester',
      functionName: 'run_test',
      functionVersion: '1.5.0',
    });

    expect(decision.allowed).toBe(false);
  });

  test('should get accessible functions for a role', () => {
    const source = `(mod test
      (role viewer :perms [data.read])
      (role admin :perms [data.write data.delete] :inherits [viewer])
      (perm data.read :audit-required false)
      (perm data.write :audit-required true)
      (perm data.delete :audit-required true)
      (policy access
        :rules [
          (allow [viewer] [data.read] :all-versions)
          (allow [admin] [data.write data.delete] :all-versions)])
      (fn read_data :v1 :requires [viewer] :inputs [] :outputs [] (body true))
      (fn write_data :v1 :requires [admin] :inputs [] :outputs [] (body true))
      (fn delete_data :v1 :requires [admin] :inputs [] :outputs [] (body true)))`;

    const tokens = tokenize(source);
    const ast = parse(tokens);

    ast.elements.forEach((el: any) => {
      if (el.type === 'Role') context.registerRole(el);
      if (el.type === 'Permission') context.registerPermission(el);
      if (el.type === 'Policy') context.registerPolicy(el);
      if (el.type === 'Function') {
        // Set permission requirements
        if (el.name === 'read_data') el.security.requiredPermissions = ['data.read'];
        if (el.name === 'write_data') el.security.requiredPermissions = ['data.write'];
        if (el.name === 'delete_data') el.security.requiredPermissions = ['data.delete'];
        context.registerFunction(el);
      }
    });

    const viewerFunctions = evaluator.getAccessibleFunctions('viewer');
    const adminFunctions = evaluator.getAccessibleFunctions('admin');

    expect(viewerFunctions).toHaveLength(1);
    expect(viewerFunctions[0].name).toBe('read_data');

    expect(adminFunctions).toHaveLength(3); // Admin inherits viewer access
    expect(adminFunctions.map(f => f.name)).toContain('read_data');
    expect(adminFunctions.map(f => f.name)).toContain('write_data');
    expect(adminFunctions.map(f => f.name)).toContain('delete_data');
  });

  test('should generate access report for a role', () => {
    const source = `(mod test
      (role user :perms [data.read])
      (perm data.read :audit-required false)
      (policy access
        :rules [(allow [user] [data.read] :all-versions)])
      (fn read_data :v1 :requires [user] :inputs [] :outputs [] (body true))
      (fn write_data :v1 :requires [admin] :inputs [] :outputs [] (body true))
      (fn delete_data :v1 :requires [admin] :inputs [] :outputs [] (body true)))`;

    const tokens = tokenize(source);
    const ast = parse(tokens);

    ast.elements.forEach((el: any) => {
      if (el.type === 'Role') context.registerRole(el);
      if (el.type === 'Permission') context.registerPermission(el);
      if (el.type === 'Policy') context.registerPolicy(el);
      if (el.type === 'Function') {
        if (el.name === 'read_data') el.security.requiredPermissions = ['data.read'];
        if (el.name === 'write_data') el.security.requiredPermissions = ['data.write'];
        if (el.name === 'delete_data') el.security.requiredPermissions = ['data.delete'];
        context.registerFunction(el);
      }
    });

    const report = evaluator.getAccessReport('user');

    expect(report.role).toBe('user');
    expect(report.totalFunctions).toBe(3);
    expect(report.accessibleFunctions).toBe(1);
    expect(report.deniedFunctions).toBe(2);
    expect(report.decisions.get('read_data')?.allowed).toBe(true);
    expect(report.decisions.get('write_data')?.allowed).toBe(false);
  });

  test('should evaluate bulk access checks', () => {
    const source = `(mod test
      (role admin :perms [data.read data.write])
      (policy access
        :rules [(allow [admin] [data.read data.write] :all-versions)])
      (fn read_data :v1 :requires [admin] :inputs [] :outputs [] (body true))
      (fn write_data :v1 :requires [admin] :inputs [] :outputs [] (body true)))`;

    const tokens = tokenize(source);
    const ast = parse(tokens);

    ast.elements.forEach((el: any) => {
      if (el.type === 'Role') context.registerRole(el);
      if (el.type === 'Policy') context.registerPolicy(el);
      if (el.type === 'Function') context.registerFunction(el);
    });

    const results = evaluator.evaluateBulk('admin', ['read_data', 'write_data']);

    expect(results.size).toBe(2);
    expect(results.get('read_data')?.allowed).toBe(true);
    expect(results.get('write_data')?.allowed).toBe(true);
  });

  test('should handle non-existent role gracefully', () => {
    const decision = evaluator.evaluate({
      role: 'nonexistent',
      functionName: 'some_function',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('does not exist');
  });

  test('should prioritize deny over allow', () => {
    const source = `(mod test
      (role user :perms [data.access])
      (policy conflict
        :rules [
          (allow [user] [data.access] :all-versions)
          (deny [user] [data.access] :all-versions)])
      (fn access_data :v1 :requires [user] :inputs [] :outputs [] (body true)))`;

    const tokens = tokenize(source);
    const ast = parse(tokens);

    ast.elements.forEach((el: any) => {
      if (el.type === 'Role') context.registerRole(el);
      if (el.type === 'Policy') context.registerPolicy(el);
      if (el.type === 'Function') {
        if (el.name === 'access_data') el.security.requiredPermissions = ['data.access'];
        context.registerFunction(el);
      }
    });

    const decision = evaluator.evaluate({
      role: 'user',
      functionName: 'access_data',
    });

    // Deny should take precedence
    expect(decision.allowed).toBe(false);
    expect(decision.matchedRule?.effect).toBe('deny');
  });
});
