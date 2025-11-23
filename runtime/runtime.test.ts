/**
 * End-to-end runtime tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Parser } from '../compiler/parser/parser';
import { BytecodeCompiler } from './vm/compiler';
import { VM } from './vm/vm';
import { ValueFactory, ValueOps } from './vm/value';
import { EffectHandlerRegistry } from './effects/registry';
import { DatabaseEffectHandler } from './effects/database';
import { HttpEffectHandler } from './effects/http';
import { FilesystemEffectHandler } from './effects/filesystem';
import { LoggingEffectHandler } from './effects/logging';
import { SecurityContext } from '../compiler/security/analyzer';

describe('CORE Runtime - End-to-End', () => {
  let parser: Parser;
  let compiler: BytecodeCompiler;
  let effectRegistry: EffectHandlerRegistry;
  let securityContext: SecurityContext;
  let vm: VM;

  beforeEach(() => {
    parser = new Parser();
    compiler = new BytecodeCompiler();
    effectRegistry = new EffectHandlerRegistry();
    securityContext = new SecurityContext();

    // Register effect handlers
    effectRegistry.register(new DatabaseEffectHandler());
    effectRegistry.register(new HttpEffectHandler());
    effectRegistry.register(new FilesystemEffectHandler());
    effectRegistry.register(new LoggingEffectHandler());

    vm = new VM(effectRegistry, securityContext);
  });

  describe('Simple Functions', () => {
    it('should execute a pure function returning a literal', async () => {
      const source = `
        (mod test
          (fn get_answer :v1
            :pure true
            :inputs []
            :outputs [(result :int)]
            (body 42)))
      `;

      const ast = parser.parse(source);
      const bytecode = compiler.compile(ast);

      const result = await vm.execute(
        bytecode,
        'get_answer:v1',
        [],
        { id: 'test-user', roles: [] }
      );

      expect(result.type).toBe('int');
      expect(ValueOps.toJS(result)).toBe(42);
    });

    it('should execute a function with parameters', async () => {
      const source = `
        (mod test
          (fn add :v1
            :pure true
            :inputs [(a :int) (b :int)]
            :outputs [(result :int)]
            (body (+ a b))))
      `;

      const ast = parser.parse(source);
      const bytecode = compiler.compile(ast);

      const result = await vm.execute(
        bytecode,
        'add:v1',
        [ValueFactory.int(10), ValueFactory.int(32)],
        { id: 'test-user', roles: [] }
      );

      expect(result.type).toBe('int');
      expect(ValueOps.toJS(result)).toBe(42);
    });

    it('should execute arithmetic operations', async () => {
      const source = `
        (mod test
          (fn calculate :v1
            :pure true
            :inputs [(x :int)]
            :outputs [(result :int)]
            (body (* (+ x 10) 2))))
      `;

      const ast = parser.parse(source);
      const bytecode = compiler.compile(ast);

      const result = await vm.execute(
        bytecode,
        'calculate:v1',
        [ValueFactory.int(5)],
        { id: 'test-user', roles: [] }
      );

      expect(result.type).toBe('int');
      expect(ValueOps.toJS(result)).toBe(30); // (5 + 10) * 2 = 30
    });
  });

  describe('Control Flow', () => {
    it('should execute if expression - then branch', async () => {
      const source = `
        (mod test
          (fn check :v1
            :pure true
            :inputs [(x :int)]
            :outputs [(result :string)]
            (body
              (if (> x 10)
                "big"
                "small"))))
      `;

      const ast = parser.parse(source);
      const bytecode = compiler.compile(ast);

      const result = await vm.execute(
        bytecode,
        'check:v1',
        [ValueFactory.int(15)],
        { id: 'test-user', roles: [] }
      );

      expect(result.type).toBe('string');
      expect(ValueOps.toJS(result)).toBe('big');
    });

    it('should execute if expression - else branch', async () => {
      const source = `
        (mod test
          (fn check :v1
            :pure true
            :inputs [(x :int)]
            :outputs [(result :string)]
            (body
              (if (> x 10)
                "big"
                "small"))))
      `;

      const ast = parser.parse(source);
      const bytecode = compiler.compile(ast);

      const result = await vm.execute(
        bytecode,
        'check:v1',
        [ValueFactory.int(5)],
        { id: 'test-user', roles: [] }
      );

      expect(result.type).toBe('string');
      expect(ValueOps.toJS(result)).toBe('small');
    });

    it('should execute let bindings', async () => {
      const source = `
        (mod test
          (fn compute :v1
            :pure true
            :inputs [(x :int)]
            :outputs [(result :int)]
            (body
              (let a (* x 2)
                (let b (+ a 10)
                  b)))))
      `;

      const ast = parser.parse(source);
      const bytecode = compiler.compile(ast);

      const result = await vm.execute(
        bytecode,
        'compute:v1',
        [ValueFactory.int(5)],
        { id: 'test-user', roles: [] }
      );

      expect(result.type).toBe('int');
      expect(ValueOps.toJS(result)).toBe(20); // (5 * 2) + 10 = 20
    });

    it('should execute do expression (sequence)', async () => {
      const source = `
        (mod test
          (fn sequence :v1
            :pure true
            :inputs [(x :int)]
            :outputs [(result :int)]
            (body
              (do
                (+ x 1)
                (+ x 2)
                (+ x 3)))))
      `;

      const ast = parser.parse(source);
      const bytecode = compiler.compile(ast);

      const result = await vm.execute(
        bytecode,
        'sequence:v1',
        [ValueFactory.int(10)],
        { id: 'test-user', roles: [] }
      );

      // Should return the last expression
      expect(result.type).toBe('int');
      expect(ValueOps.toJS(result)).toBe(13);
    });
  });

  describe('String Operations', () => {
    it('should concatenate strings', async () => {
      const source = `
        (mod test
          (fn greet :v1
            :pure true
            :inputs [(name :string)]
            :outputs [(greeting :string)]
            (body
              (+ "Hello, " name))))
      `;

      const ast = parser.parse(source);
      const bytecode = compiler.compile(ast);

      const result = await vm.execute(
        bytecode,
        'greet:v1',
        [ValueFactory.string('Alice')],
        { id: 'test-user', roles: [] }
      );

      expect(result.type).toBe('string');
      expect(ValueOps.toJS(result)).toBe('Hello, Alice');
    });
  });

  describe('Standard Library', () => {
    it('should call stdlib str.concat', async () => {
      const source = `
        (mod test
          (fn test_concat :v1
            :pure true
            :inputs []
            :outputs [(result :string)]
            (body
              (str.concat "Hello" " World"))))
      `;

      const ast = parser.parse(source);
      const bytecode = compiler.compile(ast);

      const result = await vm.execute(
        bytecode,
        'test_concat:v1',
        [],
        { id: 'test-user', roles: [] }
      );

      expect(result.type).toBe('string');
      expect(ValueOps.toJS(result)).toBe('Hello World');
    });

    it('should call stdlib str.uppercase', async () => {
      const source = `
        (mod test
          (fn test_upper :v1
            :pure true
            :inputs [(s :string)]
            :outputs [(result :string)]
            (body
              (str.uppercase s))))
      `;

      const ast = parser.parse(source);
      const bytecode = compiler.compile(ast);

      const result = await vm.execute(
        bytecode,
        'test_upper:v1',
        [ValueFactory.string('hello')],
        { id: 'test-user', roles: [] }
      );

      expect(result.type).toBe('string');
      expect(ValueOps.toJS(result)).toBe('HELLO');
    });
  });

  describe('Security', () => {
    it('should allow function call with correct role', async () => {
      const source = `
        (mod test
          (fn admin_only :v1
            :requires [admin]
            :inputs []
            :outputs [(result :string)]
            (body "success")))
      `;

      const ast = parser.parse(source);

      // Register security context
      securityContext = new SecurityContext();
      vm = new VM(effectRegistry, securityContext);

      const bytecode = compiler.compile(ast);

      const result = await vm.execute(
        bytecode,
        'admin_only:v1',
        [],
        { id: 'admin-user', roles: ['admin'] }
      );

      expect(result.type).toBe('string');
      expect(ValueOps.toJS(result)).toBe('success');
    });

    it('should deny function call without required role', async () => {
      const source = `
        (mod test
          (fn admin_only :v1
            :requires [admin]
            :inputs []
            :outputs [(result :string)]
            (body "success")))
      `;

      const ast = parser.parse(source);
      const bytecode = compiler.compile(ast);

      await expect(
        vm.execute(
          bytecode,
          'admin_only:v1',
          [],
          { id: 'regular-user', roles: ['viewer'] }
        )
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('Database Effects', () => {
    it('should write and read from database', async () => {
      const source = `
        (mod test
          (fn save_user :v1
            :requires [admin]
            :effects [(db.write "users")]
            :inputs []
            :outputs [(result (Result Unit Error))]
            (body
              (db.write "users" "user-1" "Alice"))))
      `;

      const ast = parser.parse(source);
      const bytecode = compiler.compile(ast);

      const result = await vm.execute(
        bytecode,
        'save_user:v1',
        [],
        { id: 'admin-user', roles: ['admin'] }
      );

      expect(result.type).toBe('result');
      expect(result.variant).toBe('ok');
    });
  });

  describe('Logging Effects', () => {
    it('should log messages', async () => {
      const source = `
        (mod test
          (fn log_test :v1
            :effects [(log.info)]
            :inputs []
            :outputs [(result Unit)]
            (body
              (log.info "Test message"))))
      `;

      const ast = parser.parse(source);
      const bytecode = compiler.compile(ast);

      const loggingHandler = effectRegistry.get('log') as LoggingEffectHandler;
      loggingHandler.clearLogs();

      const result = await vm.execute(
        bytecode,
        'log_test:v1',
        [],
        { id: 'test-user', roles: [] }
      );

      const logs = loggingHandler.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toContain('Test message');
    });
  });

  describe('Filesystem Effects', () => {
    it('should write and read files', async () => {
      const source = `
        (mod test
          (fn file_ops :v1
            :requires [admin]
            :effects [(fs.write "/test") (fs.read "/test")]
            :inputs []
            :outputs [(result (Result String Error))]
            (body
              (do
                (fs.write "/test/file.txt" "Hello World")
                (fs.read "/test/file.txt")))))
      `;

      const ast = parser.parse(source);
      const bytecode = compiler.compile(ast);

      const result = await vm.execute(
        bytecode,
        'file_ops:v1',
        [],
        { id: 'admin-user', roles: ['admin'] }
      );

      expect(result.type).toBe('result');
      if (result.variant === 'ok') {
        const content = result.value;
        expect(content.type).toBe('string');
        expect(ValueOps.toJS(content)).toBe('Hello World');
      }
    });
  });
});
