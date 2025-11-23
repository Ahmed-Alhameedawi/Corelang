# CORE Runtime Design (Phase 4)

**Version**: 1.0
**Last Updated**: 2025-01-23

---

## Overview

This document describes the design of the CORE runtime system, including the VM, bytecode format, effect handlers, and standard library.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CORE Program (.core)                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Parser (Existing)                         │
│                   AST Generation                             │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Bytecode Compiler                         │
│              AST → Bytecode Instructions                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      CORE VM                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Instruction Interpreter                   │   │
│  │         (Stack-based execution)                      │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Security Context Manager                    │   │
│  │     (Principal tracking, permission checks)          │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │             Effect Dispatcher                        │   │
│  │      (Routes effects to appropriate handlers)        │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Effect Handlers                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Database │  │   HTTP   │  │   File   │  │   Log    │   │
│  │ Handler  │  │ Handler  │  │  System  │  │ Handler  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Bytecode Format

### 1.1 Design Principles

- **Stack-based**: Simpler to implement than register-based
- **Type-tagged**: Each value carries runtime type information
- **Security-aware**: Instructions check permissions before execution
- **Debuggable**: Include source location information

### 1.2 Instruction Set

```typescript
enum OpCode {
  // Stack manipulation
  PUSH,           // Push literal value onto stack
  POP,            // Pop value from stack
  DUP,            // Duplicate top of stack
  SWAP,           // Swap top two stack values

  // Variables
  LOAD_VAR,       // Load variable by name
  STORE_VAR,      // Store top of stack to variable

  // Function calls
  CALL,           // Call function (name, version, arity)
  RETURN,         // Return from function

  // Control flow
  JUMP,           // Unconditional jump
  JUMP_IF_FALSE,  // Jump if top of stack is false
  JUMP_IF_TRUE,   // Jump if top of stack is true

  // Operators
  ADD, SUB, MUL, DIV, MOD,
  EQ, NE, LT, LE, GT, GE,
  AND, OR, NOT,

  // Effect execution
  EXEC_EFFECT,    // Execute effect with security check

  // Type operations
  CONSTRUCT,      // Construct record/sum type
  ACCESS_FIELD,   // Access record field
  MATCH_VARIANT,  // Pattern match on sum type

  // Result/Option
  MAKE_OK,        // Wrap value in Ok
  MAKE_ERR,       // Wrap value in Err
  MAKE_SOME,      // Wrap value in Some
  MAKE_NONE,      // Create None value

  // Collections
  MAKE_LIST,      // Create list from N stack values
  LIST_GET,       // Get list element by index
  LIST_SET,       // Set list element
  LIST_APPEND,    // Append to list

  MAKE_MAP,       // Create map from N key-value pairs
  MAP_GET,        // Get map value by key
  MAP_SET,        // Set map value

  // Debugging
  DEBUG_PRINT,    // Print top of stack (development only)
  HALT,           // Stop execution
}
```

### 1.3 Bytecode Representation

```typescript
interface Instruction {
  opcode: OpCode;
  operand?: Value;           // For PUSH, LOAD_VAR, etc.
  location?: SourceLocation; // For debugging
}

interface BytecodeModule {
  name: string;
  version: string;

  // Constant pool
  constants: Value[];

  // Functions as bytecode
  functions: Map<string, BytecodeFunction>;

  // Types
  types: Map<string, TypeDef>;

  // Security metadata
  security: {
    roles: RoleNode[];
    permissions: PermissionNode[];
    policies: PolicyNode[];
  };
}

interface BytecodeFunction {
  name: string;
  version: SemanticVersion;
  arity: number;
  instructions: Instruction[];
  requiredRoles: string[];
  effects: EffectDeclaration[];
}
```

---

## 2. Runtime Value System

### 2.1 Value Representation

All runtime values are type-tagged:

```typescript
type Value =
  | { type: 'unit' }
  | { type: 'bool'; value: boolean }
  | { type: 'int'; value: number }
  | { type: 'float'; value: number }
  | { type: 'string'; value: string }
  | { type: 'bytes'; value: Uint8Array }
  | { type: 'uuid'; value: string }
  | { type: 'timestamp'; value: Date }
  | { type: 'json'; value: any }
  | { type: 'list'; value: Value[] }
  | { type: 'map'; value: Map<Value, Value> }
  | { type: 'record'; typeName: string; fields: Map<string, Value> }
  | { type: 'variant'; typeName: string; variant: string; data?: Value }
  | { type: 'function'; name: string; version: string }
  | { type: 'result'; variant: 'ok' | 'err'; value: Value }
  | { type: 'option'; variant: 'some' | 'none'; value?: Value };
```

### 2.2 Type Checking at Runtime

Runtime type checking ensures:
- Function arguments match expected types
- Effect parameters are correct
- No type confusion vulnerabilities

---

## 3. Virtual Machine

### 3.1 VM State

```typescript
interface VMState {
  // Execution stack
  stack: Value[];

  // Call stack (for function calls)
  callStack: CallFrame[];

  // Current instruction pointer
  ip: number;

  // Current module
  module: BytecodeModule;

  // Security context (current principal)
  principal: Principal;

  // Effect handler registry
  effectHandlers: EffectHandlerRegistry;

  // Variable scopes
  scopes: Scope[];
}

interface CallFrame {
  functionName: string;
  version: string;
  returnAddress: number;
  locals: Map<string, Value>;
}

interface Scope {
  variables: Map<string, Value>;
}

interface Principal {
  id: string;
  roles: string[];
}
```

### 3.2 Execution Loop

```typescript
class VM {
  execute(module: BytecodeModule, functionName: string, args: Value[], principal: Principal): Value {
    // 1. Initialize VM state
    const state = this.initState(module, principal);

    // 2. Find and validate function
    const fn = this.resolveFunction(module, functionName);
    this.checkSecurity(fn, principal);

    // 3. Push arguments onto stack
    for (const arg of args) {
      state.stack.push(arg);
    }

    // 4. Execute instructions
    while (state.ip < fn.instructions.length) {
      const instr = fn.instructions[state.ip];
      this.executeInstruction(state, instr);
      state.ip++;
    }

    // 5. Return result
    return state.stack.pop() || { type: 'unit' };
  }

  private executeInstruction(state: VMState, instr: Instruction): void {
    switch (instr.opcode) {
      case OpCode.PUSH:
        state.stack.push(instr.operand!);
        break;

      case OpCode.ADD:
        const b = state.stack.pop()!;
        const a = state.stack.pop()!;
        state.stack.push(this.add(a, b));
        break;

      case OpCode.CALL:
        this.executeCall(state, instr);
        break;

      case OpCode.EXEC_EFFECT:
        this.executeEffect(state, instr);
        break;

      // ... other opcodes
    }
  }
}
```

---

## 4. Effect System

### 4.1 Effect Handler Interface

All effect handlers implement a common interface:

```typescript
interface EffectHandler {
  name: string; // e.g., "db", "http", "fs"

  // Execute effect with security context
  execute(
    operation: string,      // e.g., "read", "write", "call"
    params: Value[],
    principal: Principal,
    metadata: EffectMetadata
  ): Promise<Value>;

  // Check if principal has permission
  checkPermission(
    operation: string,
    principal: Principal
  ): boolean;
}

interface EffectMetadata {
  classification?: ClassificationLevel;
  auditRequired?: boolean;
  resource?: string; // e.g., table name, URL, file path
}
```

### 4.2 Effect Handler Registry

```typescript
class EffectHandlerRegistry {
  private handlers: Map<string, EffectHandler>;

  register(handler: EffectHandler): void {
    this.handlers.set(handler.name, handler);
  }

  async execute(
    effectName: string,
    operation: string,
    params: Value[],
    principal: Principal,
    metadata: EffectMetadata
  ): Promise<Value> {
    const handler = this.handlers.get(effectName);
    if (!handler) {
      throw new Error(`Unknown effect handler: ${effectName}`);
    }

    // Security check
    if (!handler.checkPermission(operation, principal)) {
      throw new SecurityError(`Permission denied: ${effectName}.${operation}`);
    }

    // Execute with audit logging if required
    if (metadata.auditRequired) {
      this.auditLog(effectName, operation, principal, params);
    }

    return await handler.execute(operation, params, principal, metadata);
  }
}
```

### 4.3 Built-in Effect Handlers

#### Database Handler

```typescript
class DatabaseEffectHandler implements EffectHandler {
  name = 'db';

  async execute(operation: string, params: Value[], principal: Principal): Promise<Value> {
    switch (operation) {
      case 'read':
        return this.query(params[0], params[1]); // query, args

      case 'write':
        return this.execute(params[0], params[1]); // statement, args

      case 'transaction':
        return this.transaction(params[0]); // callback

      default:
        throw new Error(`Unknown db operation: ${operation}`);
    }
  }

  checkPermission(operation: string, principal: Principal): boolean {
    const requiredPerm = `db.${operation}`;
    return principal.roles.some(role =>
      this.hasPermission(role, requiredPerm)
    );
  }
}
```

#### HTTP Handler

```typescript
class HttpEffectHandler implements EffectHandler {
  name = 'http';

  async execute(operation: string, params: Value[], principal: Principal): Promise<Value> {
    switch (operation) {
      case 'get':
        return this.get(params[0]); // url

      case 'post':
        return this.post(params[0], params[1]); // url, body

      case 'put':
        return this.put(params[0], params[1]); // url, body

      case 'delete':
        return this.delete(params[0]); // url

      default:
        throw new Error(`Unknown http operation: ${operation}`);
    }
  }
}
```

#### Filesystem Handler

```typescript
class FilesystemEffectHandler implements EffectHandler {
  name = 'fs';

  async execute(operation: string, params: Value[], principal: Principal): Promise<Value> {
    switch (operation) {
      case 'read':
        return this.readFile(params[0]); // path

      case 'write':
        return this.writeFile(params[0], params[1]); // path, content

      case 'list':
        return this.listFiles(params[0]); // directory

      default:
        throw new Error(`Unknown fs operation: ${operation}`);
    }
  }
}
```

#### Logging Handler

```typescript
class LoggingEffectHandler implements EffectHandler {
  name = 'log';

  async execute(operation: string, params: Value[], principal: Principal, metadata: EffectMetadata): Promise<Value> {
    const message = params[0];
    const level = operation; // 'debug', 'info', 'warn', 'error'

    // Redact classified data
    const redacted = this.redactClassifiedData(message, metadata.classification);

    // Structured logging
    this.logger.log({
      level,
      message: redacted,
      principal: principal.id,
      timestamp: new Date(),
      classification: metadata.classification,
    });

    return { type: 'unit' };
  }

  private redactClassifiedData(value: Value, classification?: ClassificationLevel): any {
    // Implement field-level redaction based on classification
    if (classification === 'restricted' || classification === 'confidential') {
      return '[REDACTED]';
    }
    return value;
  }
}
```

---

## 5. Standard Library

### 5.1 Core Functions

The standard library provides:

```typescript
// String operations
stdlib.str.concat(a: string, b: string): string
stdlib.str.uppercase(s: string): string
stdlib.str.lowercase(s: string): string
stdlib.str.length(s: string): int
stdlib.str.substring(s: string, start: int, end: int): string

// List operations
stdlib.list.map(list: List[T], fn: T -> U): List[U]
stdlib.list.filter(list: List[T], fn: T -> bool): List[T]
stdlib.list.reduce(list: List[T], fn: (acc: U, item: T) -> U, init: U): U
stdlib.list.length(list: List[T]): int

// JSON operations
stdlib.json.parse(s: string): Result[json, Error]
stdlib.json.stringify(value: json): string
stdlib.json.get(obj: json, path: string): Option[json]

// UUID operations
stdlib.uuid.generate(): uuid
stdlib.uuid.parse(s: string): Result[uuid, Error]
stdlib.uuid.toString(id: uuid): string

// Date/time operations
stdlib.time.now(): timestamp
stdlib.time.parse(s: string): Result[timestamp, Error]
stdlib.time.format(t: timestamp, fmt: string): string
```

### 5.2 Implementation

Standard library functions are implemented as native TypeScript functions registered with the VM:

```typescript
class StandardLibrary {
  register(vm: VM): void {
    // String operations
    vm.registerNativeFunction('str.concat', (a: Value, b: Value) => {
      return { type: 'string', value: a.value + b.value };
    });

    // List operations
    vm.registerNativeFunction('list.map', (list: Value, fn: Value) => {
      const mapped = list.value.map((item: Value) =>
        vm.call(fn.name, fn.version, [item])
      );
      return { type: 'list', value: mapped };
    });

    // ... more functions
  }
}
```

---

## 6. Security Integration

### 6.1 Permission Checks

Every effect execution checks permissions:

```typescript
class VM {
  private executeEffect(state: VMState, instr: Instruction): void {
    const effect = instr.operand as EffectDeclaration;

    // 1. Extract effect name and operation
    const [handler, operation] = this.parseEffect(effect.effect);

    // 2. Get parameters from stack
    const params = this.popN(state.stack, effect.paramCount);

    // 3. Check permission
    const canExecute = state.effectHandlers.checkPermission(
      handler,
      operation,
      state.principal
    );

    if (!canExecute) {
      throw new SecurityError(
        `Principal ${state.principal.id} lacks permission for ${handler}.${operation}`
      );
    }

    // 4. Execute effect
    const result = await state.effectHandlers.execute(
      handler,
      operation,
      params,
      state.principal,
      { auditRequired: effect.auditRequired }
    );

    // 5. Push result
    state.stack.push(result);
  }
}
```

### 6.2 Audit Logging

Effects marked with `:audit-required` are automatically logged:

```typescript
interface AuditLog {
  timestamp: Date;
  principal: string;
  effect: string;
  operation: string;
  params: Value[];
  result: Value | Error;
  success: boolean;
}

class AuditLogger {
  log(entry: AuditLog): void {
    // Log to secure audit trail
    // Could be database, file, external service
    console.log('[AUDIT]', JSON.stringify(entry));
  }
}
```

---

## 7. Observability

### 7.1 Structured Logging

All logs include:
- Timestamp
- Principal ID
- Classification level
- Automatic redaction of sensitive data

### 7.2 Distributed Tracing

Integration with OpenTelemetry:

```typescript
import { trace } from '@opentelemetry/api';

class VM {
  execute(module: BytecodeModule, functionName: string, args: Value[]): Value {
    const tracer = trace.getTracer('core-runtime');

    return tracer.startActiveSpan(`core.${functionName}`, (span) => {
      span.setAttribute('module', module.name);
      span.setAttribute('version', module.version);
      span.setAttribute('principal', this.state.principal.id);

      try {
        const result = this.executeInternal(module, functionName, args);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

### 7.3 Metrics

Track runtime metrics:
- Function call counts
- Execution times
- Effect execution counts
- Security check failures
- Error rates

---

## 8. Compilation Pipeline

### 8.1 AST to Bytecode

```typescript
class BytecodeCompiler {
  compile(module: ModuleNode): BytecodeModule {
    const functions = new Map<string, BytecodeFunction>();

    for (const element of module.elements) {
      if (element.type === 'function') {
        const bytecode = this.compileFunction(element as FunctionNode);
        functions.set(`${element.name}:${element.version}`, bytecode);
      }
    }

    return {
      name: module.name,
      version: module.version || '1.0.0',
      constants: [],
      functions,
      types: this.extractTypes(module),
      security: this.extractSecurity(module),
    };
  }

  private compileFunction(fn: FunctionNode): BytecodeFunction {
    const compiler = new FunctionCompiler();
    return compiler.compile(fn);
  }
}

class FunctionCompiler {
  private instructions: Instruction[] = [];

  compile(fn: FunctionNode): BytecodeFunction {
    // Compile function body to bytecode
    this.compileExpression(fn.body);
    this.emit(OpCode.RETURN);

    return {
      name: fn.name,
      version: fn.version,
      arity: fn.inputs.length,
      instructions: this.instructions,
      requiredRoles: fn.requires || [],
      effects: fn.effects || [],
    };
  }

  private compileExpression(expr: ExpressionNode): void {
    switch (expr.type) {
      case 'literal':
        this.emit(OpCode.PUSH, (expr as LiteralNode).value);
        break;

      case 'identifier':
        this.emit(OpCode.LOAD_VAR, (expr as IdentifierNode).name);
        break;

      case 'call':
        const call = expr as CallNode;
        // Compile arguments (right to left for stack)
        for (const arg of call.args.reverse()) {
          this.compileExpression(arg);
        }
        this.emit(OpCode.CALL, {
          name: call.fn,
          arity: call.args.length,
        });
        break;

      case 'let':
        const letExpr = expr as LetNode;
        this.compileExpression(letExpr.value);
        this.emit(OpCode.STORE_VAR, letExpr.binding);
        this.compileExpression(letExpr.body);
        break;

      case 'if':
        const ifExpr = expr as IfNode;
        this.compileExpression(ifExpr.condition);
        const elseLabel = this.newLabel();
        const endLabel = this.newLabel();
        this.emit(OpCode.JUMP_IF_FALSE, elseLabel);
        this.compileExpression(ifExpr.then);
        this.emit(OpCode.JUMP, endLabel);
        this.placeLabel(elseLabel);
        this.compileExpression(ifExpr.else);
        this.placeLabel(endLabel);
        break;

      // ... other expression types
    }
  }

  private emit(opcode: OpCode, operand?: any): void {
    this.instructions.push({ opcode, operand });
  }
}
```

---

## 9. Performance Considerations

### 9.1 Optimization Opportunities (Phase 9)

- **Constant folding**: Evaluate constant expressions at compile time
- **Dead code elimination**: Remove unreachable code
- **Inline expansion**: Inline small pure functions
- **Effect fusion**: Batch multiple effects of same type
- **JIT compilation**: Compile hot paths to native code

### 9.2 Current Performance Targets

- Module compilation: < 100ms for typical module
- Function execution overhead: < 1ms per call
- Effect execution: Depends on handler (IO-bound)

---

## 10. Testing Strategy

### 10.1 Unit Tests

- Bytecode compiler correctness
- VM instruction execution
- Effect handler behavior
- Security enforcement
- Standard library functions

### 10.2 Integration Tests

- End-to-end: CORE source → execution
- Multi-function calls
- Effect composition
- Security scenarios

### 10.3 Security Tests

- Unauthorized access attempts
- Effect permission violations
- Audit logging verification
- Data classification redaction

---

## 11. Future Enhancements (Post-Phase 4)

- **Async/await support** (coroutines)
- **Streaming effects** (large data sets)
- **Effect transactions** (rollback on failure)
- **Parallel execution** (pure function parallelism)
- **Remote effects** (distributed execution)

---

## Summary

This design provides:

✅ **Executable runtime** for CORE programs
✅ **Security-integrated** effect system
✅ **Pluggable effect handlers** for extensibility
✅ **Standard library** for common operations
✅ **Observability** with logging, tracing, metrics
✅ **Type-safe** runtime value system
✅ **Testable** architecture

**Next Steps**: Implement in order:
1. Runtime value system
2. Bytecode format and compiler
3. VM interpreter
4. Effect handler system
5. Standard library
6. Tests and examples
