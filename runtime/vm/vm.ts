/**
 * CORE Virtual Machine
 *
 * Stack-based interpreter for CORE bytecode.
 */

import {
  OpCode,
  Instruction,
  BytecodeModule,
  BytecodeFunction,
  CallOperand,
  EffectOperand,
  JumpOperand,
} from './bytecode.js';
import { Value, ValueFactory, ValueTypeChecker, ValueOps } from './value.js';
import { EffectHandlerRegistry } from '../effects/registry.js';
import { SecurityContext } from '../../compiler/security/analyzer.js';
import { PolicyEvaluator } from '../../compiler/security/policy.js';

/**
 * Principal (security context for execution)
 */
export interface Principal {
  id: string;
  roles: string[];
}

/**
 * Call frame for function calls
 */
interface CallFrame {
  functionName: string;
  version: string;
  returnAddress: number;
  locals: Map<string, Value>;
  module: BytecodeModule;
}

/**
 * VM state
 */
interface VMState {
  // Execution stack
  stack: Value[];

  // Call stack
  callStack: CallFrame[];

  // Current instruction pointer
  ip: number;

  // Current module
  module: BytecodeModule;

  // Current function
  currentFunction: BytecodeFunction | null;

  // Security context
  principal: Principal;

  // Effect handler registry
  effectHandlers: EffectHandlerRegistry;

  // Security policy evaluator
  policyEvaluator: PolicyEvaluator;

  // Local variables
  locals: Map<string, Value>;

  // Arguments
  args: Value[];

  // Halt flag
  halted: boolean;
}

/**
 * VM execution errors
 */
export class VMError extends Error {
  constructor(message: string, public ip?: number, public instruction?: Instruction) {
    super(message);
    this.name = 'VMError';
  }
}

export class SecurityError extends VMError {
  constructor(message: string, ip?: number) {
    super(message, ip);
    this.name = 'SecurityError';
  }
}

export class TypeMismatchError extends VMError {
  constructor(expected: string, actual: string, ip?: number) {
    super(`Type mismatch: expected ${expected}, got ${actual}`, ip);
    this.name = 'TypeMismatchError';
  }
}

/**
 * CORE Virtual Machine
 */
export class VM {
  private nativeFunctions: Map<string, (...args: Value[]) => Value> = new Map();

  constructor(
    private effectHandlers: EffectHandlerRegistry,
    private securityContext: SecurityContext
  ) {
    this.registerStandardLibrary();
  }

  /**
   * Execute a function in a module
   */
  async execute(
    module: BytecodeModule,
    functionName: string,
    args: Value[],
    principal: Principal
  ): Promise<Value> {
    // Find function
    const fn = module.functions.get(functionName);
    if (!fn) {
      throw new VMError(`Function not found: ${functionName}`);
    }

    // Check arity
    if (args.length !== fn.arity) {
      throw new VMError(
        `Arity mismatch: ${functionName} expects ${fn.arity} arguments, got ${args.length}`
      );
    }

    // Check security
    this.checkSecurity(fn, principal, module);

    // Initialize VM state
    const policyEvaluator = new PolicyEvaluator(this.securityContext);

    const state: VMState = {
      stack: [],
      callStack: [],
      ip: 0,
      module,
      currentFunction: fn,
      principal,
      effectHandlers: this.effectHandlers,
      policyEvaluator,
      locals: new Map(),
      args,
      halted: false,
    };

    // Execute
    return await this.executeFunction(state, fn, args);
  }

  /**
   * Execute a single function
   */
  private async executeFunction(
    state: VMState,
    fn: BytecodeFunction,
    args: Value[]
  ): Promise<Value> {
    // Store arguments
    state.args = args;
    state.ip = 0;

    // Execute instructions
    while (state.ip < fn.instructions.length && !state.halted) {
      const instr = fn.instructions[state.ip];

      try {
        await this.executeInstruction(state, instr);
      } catch (error) {
        if (error instanceof VMError) {
          error.ip = state.ip;
          error.instruction = instr;
        }
        throw error;
      }

      state.ip++;
    }

    // Return result from stack
    if (state.stack.length > 0) {
      return state.stack.pop()!;
    }

    return ValueFactory.unit();
  }

  /**
   * Execute a single instruction
   */
  private async executeInstruction(state: VMState, instr: Instruction): Promise<void> {
    switch (instr.opcode) {
      // Stack manipulation
      case OpCode.PUSH:
        state.stack.push(instr.operand as Value);
        break;

      case OpCode.POP:
        state.stack.pop();
        break;

      case OpCode.DUP:
        const top = state.stack[state.stack.length - 1];
        state.stack.push(top);
        break;

      case OpCode.SWAP:
        const a = state.stack.pop()!;
        const b = state.stack.pop()!;
        state.stack.push(a);
        state.stack.push(b);
        break;

      // Variables
      case OpCode.LOAD_VAR:
        const varName = instr.operand as string;
        const value = state.locals.get(varName);
        if (value === undefined) {
          throw new VMError(`Undefined variable: ${varName}`, state.ip, instr);
        }
        state.stack.push(value);
        break;

      case OpCode.STORE_VAR:
        const storeVarName = instr.operand as string;
        const storeValue = state.stack[state.stack.length - 1]; // Keep on stack
        state.locals.set(storeVarName, storeValue);
        break;

      case OpCode.LOAD_ARG:
        const argIndex = instr.operand as number;
        if (argIndex >= state.args.length) {
          throw new VMError(`Argument index out of bounds: ${argIndex}`, state.ip, instr);
        }
        state.stack.push(state.args[argIndex]);
        break;

      // Function calls
      case OpCode.CALL:
        await this.executeCall(state, instr);
        break;

      case OpCode.CALL_NATIVE:
        await this.executeNativeCall(state, instr);
        break;

      case OpCode.RETURN:
        state.halted = true;
        break;

      // Control flow
      case OpCode.JUMP:
        const jumpOp = instr.operand as JumpOperand;
        state.ip = jumpOp.offset - 1; // -1 because ip++ happens after
        break;

      case OpCode.JUMP_IF_FALSE:
        const condFalse = state.stack.pop()!;
        if (!ValueTypeChecker.isBool(condFalse)) {
          throw new TypeMismatchError('bool', condFalse.type, state.ip);
        }
        if (!condFalse.value) {
          const jumpOpFalse = instr.operand as JumpOperand;
          state.ip = jumpOpFalse.offset - 1;
        }
        break;

      case OpCode.JUMP_IF_TRUE:
        const condTrue = state.stack.pop()!;
        if (!ValueTypeChecker.isBool(condTrue)) {
          throw new TypeMismatchError('bool', condTrue.type, state.ip);
        }
        if (condTrue.value) {
          const jumpOpTrue = instr.operand as JumpOperand;
          state.ip = jumpOpTrue.offset - 1;
        }
        break;

      // Arithmetic
      case OpCode.ADD:
        await this.executeBinaryOp(state, (a, b) => {
          if (ValueTypeChecker.isInt(a) && ValueTypeChecker.isInt(b)) {
            return ValueFactory.int(a.value + b.value);
          }
          if (ValueTypeChecker.isFloat(a) && ValueTypeChecker.isFloat(b)) {
            return ValueFactory.float(a.value + b.value);
          }
          if (ValueTypeChecker.isString(a) && ValueTypeChecker.isString(b)) {
            return ValueFactory.string(a.value + b.value);
          }
          throw new TypeMismatchError('int, float, or string', `${a.type}, ${b.type}`, state.ip);
        });
        break;

      case OpCode.SUB:
        await this.executeBinaryOp(state, (a, b) => {
          if (ValueTypeChecker.isInt(a) && ValueTypeChecker.isInt(b)) {
            return ValueFactory.int(a.value - b.value);
          }
          if (ValueTypeChecker.isFloat(a) && ValueTypeChecker.isFloat(b)) {
            return ValueFactory.float(a.value - b.value);
          }
          throw new TypeMismatchError('int or float', `${a.type}, ${b.type}`, state.ip);
        });
        break;

      case OpCode.MUL:
        await this.executeBinaryOp(state, (a, b) => {
          if (ValueTypeChecker.isInt(a) && ValueTypeChecker.isInt(b)) {
            return ValueFactory.int(a.value * b.value);
          }
          if (ValueTypeChecker.isFloat(a) && ValueTypeChecker.isFloat(b)) {
            return ValueFactory.float(a.value * b.value);
          }
          throw new TypeMismatchError('int or float', `${a.type}, ${b.type}`, state.ip);
        });
        break;

      case OpCode.DIV:
        await this.executeBinaryOp(state, (a, b) => {
          if (ValueTypeChecker.isInt(a) && ValueTypeChecker.isInt(b)) {
            if (b.value === 0) {
              return ValueFactory.err(ValueFactory.string('Division by zero'));
            }
            return ValueFactory.int(Math.floor(a.value / b.value));
          }
          if (ValueTypeChecker.isFloat(a) && ValueTypeChecker.isFloat(b)) {
            if (b.value === 0) {
              return ValueFactory.err(ValueFactory.string('Division by zero'));
            }
            return ValueFactory.float(a.value / b.value);
          }
          throw new TypeMismatchError('int or float', `${a.type}, ${b.type}`, state.ip);
        });
        break;

      case OpCode.MOD:
        await this.executeBinaryOp(state, (a, b) => {
          if (ValueTypeChecker.isInt(a) && ValueTypeChecker.isInt(b)) {
            return ValueFactory.int(a.value % b.value);
          }
          throw new TypeMismatchError('int', `${a.type}, ${b.type}`, state.ip);
        });
        break;

      case OpCode.NEG:
        const negValue = state.stack.pop()!;
        if (ValueTypeChecker.isInt(negValue)) {
          state.stack.push(ValueFactory.int(-negValue.value));
        } else if (ValueTypeChecker.isFloat(negValue)) {
          state.stack.push(ValueFactory.float(-negValue.value));
        } else {
          throw new TypeMismatchError('int or float', negValue.type, state.ip);
        }
        break;

      // Comparison
      case OpCode.EQ:
        const eqB = state.stack.pop()!;
        const eqA = state.stack.pop()!;
        state.stack.push(ValueFactory.bool(ValueOps.equals(eqA, eqB)));
        break;

      case OpCode.NE:
        const neB = state.stack.pop()!;
        const neA = state.stack.pop()!;
        state.stack.push(ValueFactory.bool(!ValueOps.equals(neA, neB)));
        break;

      case OpCode.LT:
        await this.executeComparison(state, (a, b) => a < b);
        break;

      case OpCode.LE:
        await this.executeComparison(state, (a, b) => a <= b);
        break;

      case OpCode.GT:
        await this.executeComparison(state, (a, b) => a > b);
        break;

      case OpCode.GE:
        await this.executeComparison(state, (a, b) => a >= b);
        break;

      // Logical
      case OpCode.AND:
        const andB = state.stack.pop()!;
        const andA = state.stack.pop()!;
        if (!ValueTypeChecker.isBool(andA) || !ValueTypeChecker.isBool(andB)) {
          throw new TypeMismatchError('bool', `${andA.type}, ${andB.type}`, state.ip);
        }
        state.stack.push(ValueFactory.bool(andA.value && andB.value));
        break;

      case OpCode.OR:
        const orB = state.stack.pop()!;
        const orA = state.stack.pop()!;
        if (!ValueTypeChecker.isBool(orA) || !ValueTypeChecker.isBool(orB)) {
          throw new TypeMismatchError('bool', `${orA.type}, ${orB.type}`, state.ip);
        }
        state.stack.push(ValueFactory.bool(orA.value || orB.value));
        break;

      case OpCode.NOT:
        const notValue = state.stack.pop()!;
        if (!ValueTypeChecker.isBool(notValue)) {
          throw new TypeMismatchError('bool', notValue.type, state.ip);
        }
        state.stack.push(ValueFactory.bool(!notValue.value));
        break;

      // Effects
      case OpCode.EXEC_EFFECT:
        await this.executeEffect(state, instr);
        break;

      // Result/Option
      case OpCode.MAKE_OK:
        const okValue = state.stack.pop()!;
        state.stack.push(ValueFactory.ok(okValue));
        break;

      case OpCode.MAKE_ERR:
        const errValue = state.stack.pop()!;
        state.stack.push(ValueFactory.err(errValue));
        break;

      case OpCode.MAKE_SOME:
        const someValue = state.stack.pop()!;
        state.stack.push(ValueFactory.some(someValue));
        break;

      case OpCode.MAKE_NONE:
        state.stack.push(ValueFactory.none());
        break;

      // Collections
      case OpCode.MAKE_LIST:
        const listSize = instr.operand as number;
        const listItems: Value[] = [];
        for (let i = 0; i < listSize; i++) {
          listItems.unshift(state.stack.pop()!);
        }
        state.stack.push(ValueFactory.list(listItems));
        break;

      case OpCode.LIST_GET:
        const getIndex = state.stack.pop()!;
        const getList = state.stack.pop()!;
        if (!ValueTypeChecker.isList(getList)) {
          throw new TypeMismatchError('list', getList.type, state.ip);
        }
        if (!ValueTypeChecker.isInt(getIndex)) {
          throw new TypeMismatchError('int', getIndex.type, state.ip);
        }
        const item = getList.value[getIndex.value];
        state.stack.push(item || ValueFactory.none());
        break;

      case OpCode.LIST_LEN:
        const lenList = state.stack.pop()!;
        if (!ValueTypeChecker.isList(lenList)) {
          throw new TypeMismatchError('list', lenList.type, state.ip);
        }
        state.stack.push(ValueFactory.int(lenList.value.length));
        break;

      // String operations
      case OpCode.STR_CONCAT:
        const concatB = state.stack.pop()!;
        const concatA = state.stack.pop()!;
        if (!ValueTypeChecker.isString(concatA) || !ValueTypeChecker.isString(concatB)) {
          throw new TypeMismatchError('string', `${concatA.type}, ${concatB.type}`, state.ip);
        }
        state.stack.push(ValueFactory.string(concatA.value + concatB.value));
        break;

      case OpCode.STR_LEN:
        const lenStr = state.stack.pop()!;
        if (!ValueTypeChecker.isString(lenStr)) {
          throw new TypeMismatchError('string', lenStr.type, state.ip);
        }
        state.stack.push(ValueFactory.int(lenStr.value.length));
        break;

      // Debugging
      case OpCode.DEBUG_PRINT:
        const printValue = state.stack[state.stack.length - 1];
        console.log('[DEBUG]', ValueOps.toString(printValue));
        break;

      case OpCode.HALT:
        state.halted = true;
        break;

      default:
        throw new VMError(`Unknown opcode: ${instr.opcode}`, state.ip, instr);
    }
  }

  /**
   * Execute binary operation
   */
  private async executeBinaryOp(
    state: VMState,
    op: (a: Value, b: Value) => Value
  ): Promise<void> {
    const b = state.stack.pop()!;
    const a = state.stack.pop()!;
    state.stack.push(op(a, b));
  }

  /**
   * Execute comparison operation
   */
  private async executeComparison(
    state: VMState,
    op: (a: number, b: number) => boolean
  ): Promise<void> {
    const b = state.stack.pop()!;
    const a = state.stack.pop()!;

    if (ValueTypeChecker.isInt(a) && ValueTypeChecker.isInt(b)) {
      state.stack.push(ValueFactory.bool(op(a.value, b.value)));
    } else if (ValueTypeChecker.isFloat(a) && ValueTypeChecker.isFloat(b)) {
      state.stack.push(ValueFactory.bool(op(a.value, b.value)));
    } else {
      throw new TypeMismatchError('int or float', `${a.type}, ${b.type}`, state.ip);
    }
  }

  /**
   * Execute function call
   */
  private async executeCall(state: VMState, instr: Instruction): Promise<void> {
    const callOp = instr.operand as CallOperand;

    // Pop arguments
    const args: Value[] = [];
    for (let i = 0; i < callOp.arity; i++) {
      args.unshift(state.stack.pop()!);
    }

    // Find function
    const fnKey = callOp.version
      ? `${callOp.name}:${callOp.version}`
      : this.findLatestFunction(state.module, callOp.name);

    const fn = state.module.functions.get(fnKey);
    if (!fn) {
      throw new VMError(`Function not found: ${fnKey}`, state.ip, instr);
    }

    // Check security
    this.checkSecurity(fn, state.principal, state.module);

    // Execute function
    const result = await this.executeFunction(
      {
        ...state,
        currentFunction: fn,
        args,
        locals: new Map(),
        ip: 0,
        halted: false,
      },
      fn,
      args
    );

    state.stack.push(result);
  }

  /**
   * Execute native function call
   */
  private async executeNativeCall(state: VMState, instr: Instruction): Promise<void> {
    const callOp = instr.operand as CallOperand;

    // Pop arguments
    const args: Value[] = [];
    for (let i = 0; i < callOp.arity; i++) {
      args.unshift(state.stack.pop()!);
    }

    // Find native function
    const nativeFn = this.nativeFunctions.get(callOp.name);
    if (!nativeFn) {
      throw new VMError(`Native function not found: ${callOp.name}`, state.ip, instr);
    }

    // Execute native function
    const result = nativeFn(...args);
    state.stack.push(result);
  }

  /**
   * Execute effect
   */
  private async executeEffect(state: VMState, instr: Instruction): Promise<void> {
    const effectOp = instr.operand as EffectOperand;

    // Pop parameters
    const params: Value[] = [];
    for (let i = 0; i < effectOp.paramCount; i++) {
      params.unshift(state.stack.pop()!);
    }

    // Execute effect with security check
    const result = await state.effectHandlers.execute(
      effectOp.handler,
      effectOp.operation,
      params,
      state.principal,
      {
        auditRequired: effectOp.auditRequired,
        resource: effectOp.resource,
      }
    );

    state.stack.push(result);
  }

  /**
   * Check security for function call
   */
  private checkSecurity(
    fn: BytecodeFunction,
    principal: Principal,
    module: BytecodeModule
  ): void {
    if (fn.requiredRoles.length === 0) {
      return; // No security requirements
    }

    // Check if principal has any of the required roles
    const hasRole = fn.requiredRoles.some(role =>
      principal.roles.includes(role)
    );

    if (!hasRole) {
      throw new SecurityError(
        `Permission denied: ${fn.name} requires one of [${fn.requiredRoles.join(', ')}], principal has [${principal.roles.join(', ')}]`
      );
    }
  }

  /**
   * Find latest version of a function
   */
  private findLatestFunction(module: BytecodeModule, name: string): string {
    // Find all versions of the function
    const versions: string[] = [];
    for (const key of module.functions.keys()) {
      if (key.startsWith(name + ':')) {
        versions.push(key);
      }
    }

    if (versions.length === 0) {
      throw new VMError(`Function not found: ${name}`);
    }

    // Return the latest (for now, just the last one)
    return versions[versions.length - 1];
  }

  /**
   * Register a native function
   */
  registerNativeFunction(name: string, fn: (...args: Value[]) => Value): void {
    this.nativeFunctions.set(name, fn);
  }

  /**
   * Register standard library functions
   */
  private registerStandardLibrary(): void {
    // String operations
    this.registerNativeFunction('str.concat', (a: Value, b: Value) => {
      if (!ValueTypeChecker.isString(a) || !ValueTypeChecker.isString(b)) {
        throw new VMError('str.concat requires two strings');
      }
      return ValueFactory.string(a.value + b.value);
    });

    this.registerNativeFunction('str.length', (s: Value) => {
      if (!ValueTypeChecker.isString(s)) {
        throw new VMError('str.length requires a string');
      }
      return ValueFactory.int(s.value.length);
    });

    this.registerNativeFunction('str.uppercase', (s: Value) => {
      if (!ValueTypeChecker.isString(s)) {
        throw new VMError('str.uppercase requires a string');
      }
      return ValueFactory.string(s.value.toUpperCase());
    });

    this.registerNativeFunction('str.lowercase', (s: Value) => {
      if (!ValueTypeChecker.isString(s)) {
        throw new VMError('str.lowercase requires a string');
      }
      return ValueFactory.string(s.value.toLowerCase());
    });

    // List operations
    this.registerNativeFunction('list.length', (list: Value) => {
      if (!ValueTypeChecker.isList(list)) {
        throw new VMError('list.length requires a list');
      }
      return ValueFactory.int(list.value.length);
    });

    // More stdlib functions to be added...
  }
}
