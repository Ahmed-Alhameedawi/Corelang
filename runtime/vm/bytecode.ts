/**
 * Bytecode format for CORE VM
 *
 * Defines the instruction set and bytecode module structure.
 */

import { Value } from './value.js';
import { SemanticVersion } from '../../compiler/versioning/semver.js';
import { RoleNode, PermissionNode, PolicyNode, TypeDefNode } from '../../compiler/ast/types.js';

/**
 * Operation codes for the CORE VM
 */
export enum OpCode {
  // Stack manipulation
  PUSH = 'PUSH',           // Push literal value onto stack
  POP = 'POP',             // Pop value from stack
  DUP = 'DUP',             // Duplicate top of stack
  SWAP = 'SWAP',           // Swap top two stack values

  // Variables
  LOAD_VAR = 'LOAD_VAR',   // Load variable by name
  STORE_VAR = 'STORE_VAR', // Store top of stack to variable
  LOAD_ARG = 'LOAD_ARG',   // Load function argument by index

  // Function calls
  CALL = 'CALL',           // Call function (name, version, arity)
  CALL_NATIVE = 'CALL_NATIVE', // Call native function
  RETURN = 'RETURN',       // Return from function

  // Control flow
  JUMP = 'JUMP',                 // Unconditional jump
  JUMP_IF_FALSE = 'JUMP_IF_FALSE', // Jump if top of stack is false
  JUMP_IF_TRUE = 'JUMP_IF_TRUE',   // Jump if top of stack is true

  // Arithmetic operators
  ADD = 'ADD',
  SUB = 'SUB',
  MUL = 'MUL',
  DIV = 'DIV',
  MOD = 'MOD',
  NEG = 'NEG',  // Unary negation

  // Comparison operators
  EQ = 'EQ',
  NE = 'NE',
  LT = 'LT',
  LE = 'LE',
  GT = 'GT',
  GE = 'GE',

  // Logical operators
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',

  // Effect execution
  EXEC_EFFECT = 'EXEC_EFFECT', // Execute effect with security check

  // Type operations
  CONSTRUCT_RECORD = 'CONSTRUCT_RECORD', // Construct record from fields
  ACCESS_FIELD = 'ACCESS_FIELD',         // Access record field
  CONSTRUCT_VARIANT = 'CONSTRUCT_VARIANT', // Construct sum type variant
  MATCH_VARIANT = 'MATCH_VARIANT',       // Pattern match on sum type

  // Result/Option
  MAKE_OK = 'MAKE_OK',       // Wrap value in Ok
  MAKE_ERR = 'MAKE_ERR',     // Wrap value in Err
  MAKE_SOME = 'MAKE_SOME',   // Wrap value in Some
  MAKE_NONE = 'MAKE_NONE',   // Create None value
  UNWRAP = 'UNWRAP',         // Unwrap Ok/Some or throw on Err/None

  // Collections
  MAKE_LIST = 'MAKE_LIST',     // Create list from N stack values
  LIST_GET = 'LIST_GET',       // Get list element by index
  LIST_SET = 'LIST_SET',       // Set list element
  LIST_APPEND = 'LIST_APPEND', // Append to list
  LIST_LEN = 'LIST_LEN',       // Get list length

  MAKE_MAP = 'MAKE_MAP',   // Create map from N key-value pairs
  MAP_GET = 'MAP_GET',     // Get map value by key
  MAP_SET = 'MAP_SET',     // Set map value
  MAP_HAS = 'MAP_HAS',     // Check if map has key

  // String operations
  STR_CONCAT = 'STR_CONCAT', // Concatenate strings
  STR_LEN = 'STR_LEN',       // Get string length

  // Debugging
  DEBUG_PRINT = 'DEBUG_PRINT', // Print top of stack (development only)
  HALT = 'HALT',               // Stop execution
}

/**
 * Source location for debugging
 */
export interface SourceLocation {
  file?: string;
  line: number;
  column: number;
}

/**
 * Single bytecode instruction
 */
export interface Instruction {
  opcode: OpCode;
  operand?: any;           // Operand data (for PUSH, LOAD_VAR, etc.)
  location?: SourceLocation; // For debugging and error messages
}

/**
 * Call instruction operand
 */
export interface CallOperand {
  name: string;
  version?: string;
  arity: number;
}

/**
 * Effect execution operand
 */
export interface EffectOperand {
  handler: string;      // e.g., "db", "http", "fs"
  operation: string;    // e.g., "read", "write", "call"
  paramCount: number;   // Number of parameters to pop from stack
  auditRequired?: boolean;
  resource?: string;    // e.g., table name, URL, file path
}

/**
 * Jump instruction operand
 */
export interface JumpOperand {
  offset: number; // Instruction offset to jump to
}

/**
 * Compiled function as bytecode
 */
export interface BytecodeFunction {
  name: string;
  version: SemanticVersion;
  arity: number;                // Number of parameters
  instructions: Instruction[];
  requiredRoles: string[];
  effects: string[];           // Effect declarations as strings
  pure: boolean;
  idempotent: boolean;
  locals: number;              // Number of local variables
}

/**
 * Bytecode module
 */
export interface BytecodeModule {
  name: string;
  version: string;

  // Constant pool
  constants: Value[];

  // Functions as bytecode
  functions: Map<string, BytecodeFunction>;

  // Types
  types: Map<string, TypeDefNode>;

  // Security metadata
  security: {
    roles: RoleNode[];
    permissions: PermissionNode[];
    policies: PolicyNode[];
  };
}

/**
 * Bytecode builder helper
 */
export class BytecodeBuilder {
  private instructions: Instruction[] = [];
  private labelCounter = 0;
  private labels = new Map<string, number>();
  private patches: { label: string; index: number }[] = [];

  /**
   * Emit an instruction
   */
  emit(opcode: OpCode, operand?: any, location?: SourceLocation): void {
    this.instructions.push({ opcode, operand, location });
  }

  /**
   * Create a new label
   */
  newLabel(): string {
    return `L${this.labelCounter++}`;
  }

  /**
   * Place a label at current position
   */
  placeLabel(label: string): void {
    this.labels.set(label, this.instructions.length);
  }

  /**
   * Emit jump to label (will be patched later)
   */
  emitJump(opcode: OpCode, label: string, location?: SourceLocation): void {
    this.patches.push({ label, index: this.instructions.length });
    this.emit(opcode, { offset: -1 }, location); // Placeholder
  }

  /**
   * Patch all jump instructions with actual offsets
   */
  patchJumps(): void {
    for (const { label, index } of this.patches) {
      const target = this.labels.get(label);
      if (target === undefined) {
        throw new Error(`Undefined label: ${label}`);
      }
      this.instructions[index].operand = { offset: target };
    }
  }

  /**
   * Get current instruction index
   */
  here(): number {
    return this.instructions.length;
  }

  /**
   * Get the built instructions
   */
  build(): Instruction[] {
    this.patchJumps();
    return this.instructions;
  }
}

/**
 * Bytecode disassembler for debugging
 */
export class BytecodeDisassembler {
  /**
   * Disassemble bytecode to human-readable format
   */
  static disassemble(fn: BytecodeFunction): string {
    const lines: string[] = [];
    lines.push(`Function: ${fn.name}:${fn.version}`);
    lines.push(`Arity: ${fn.arity}, Locals: ${fn.locals}`);
    lines.push(`Pure: ${fn.pure}, Idempotent: ${fn.idempotent}`);
    if (fn.requiredRoles.length > 0) {
      lines.push(`Required roles: ${fn.requiredRoles.join(', ')}`);
    }
    if (fn.effects.length > 0) {
      lines.push(`Effects: ${fn.effects.join(', ')}`);
    }
    lines.push('');
    lines.push('Instructions:');

    fn.instructions.forEach((instr, index) => {
      const offset = index.toString().padStart(4, '0');
      const opcode = instr.opcode.padEnd(20, ' ');
      const operand = this.formatOperand(instr);
      const location = instr.location
        ? ` // ${instr.location.file || '?'}:${instr.location.line}:${instr.location.column}`
        : '';
      lines.push(`  ${offset}  ${opcode} ${operand}${location}`);
    });

    return lines.join('\n');
  }

  private static formatOperand(instr: Instruction): string {
    if (!instr.operand) {
      return '';
    }

    switch (instr.opcode) {
      case OpCode.PUSH:
        return `${this.formatValue(instr.operand)}`;

      case OpCode.LOAD_VAR:
      case OpCode.STORE_VAR:
        return `"${instr.operand}"`;

      case OpCode.LOAD_ARG:
        return `${instr.operand}`;

      case OpCode.CALL:
      case OpCode.CALL_NATIVE:
        const call = instr.operand as CallOperand;
        return `${call.name}${call.version ? ':' + call.version : ''} (arity: ${call.arity})`;

      case OpCode.JUMP:
      case OpCode.JUMP_IF_FALSE:
      case OpCode.JUMP_IF_TRUE:
        const jump = instr.operand as JumpOperand;
        return `-> ${jump.offset}`;

      case OpCode.EXEC_EFFECT:
        const effect = instr.operand as EffectOperand;
        return `${effect.handler}.${effect.operation} (params: ${effect.paramCount})`;

      case OpCode.MAKE_LIST:
        return `(size: ${instr.operand})`;

      case OpCode.MAKE_MAP:
        return `(pairs: ${instr.operand})`;

      case OpCode.CONSTRUCT_RECORD:
        return `${instr.operand.typeName} (fields: ${instr.operand.fieldCount})`;

      case OpCode.ACCESS_FIELD:
        return `"${instr.operand}"`;

      case OpCode.CONSTRUCT_VARIANT:
        return `${instr.operand.typeName}.${instr.operand.variant}`;

      default:
        return JSON.stringify(instr.operand);
    }
  }

  private static formatValue(value: Value): string {
    switch (value.type) {
      case 'unit':
        return 'unit';
      case 'bool':
      case 'int':
      case 'float':
        return value.value.toString();
      case 'string':
        return `"${value.value}"`;
      case 'uuid':
        return `uuid(${value.value})`;
      default:
        return `<${value.type}>`;
    }
  }

  /**
   * Disassemble entire module
   */
  static disassembleModule(module: BytecodeModule): string {
    const lines: string[] = [];
    lines.push(`Module: ${module.name} (v${module.version})`);
    lines.push('');

    lines.push(`Functions: ${module.functions.size}`);
    lines.push(`Types: ${module.types.size}`);
    lines.push(`Roles: ${module.security.roles.length}`);
    lines.push(`Permissions: ${module.security.permissions.length}`);
    lines.push(`Policies: ${module.security.policies.length}`);
    lines.push('');

    lines.push('='.repeat(60));
    lines.push('');

    for (const [name, fn] of module.functions.entries()) {
      lines.push(this.disassemble(fn));
      lines.push('');
      lines.push('-'.repeat(60));
      lines.push('');
    }

    return lines.join('\n');
  }
}
