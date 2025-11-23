/**
 * Bytecode compiler: AST → Bytecode
 *
 * Compiles CORE AST to bytecode instructions for the VM.
 */

import {
  ModuleNode,
  FunctionNode,
  ExprNode,
  LiteralNode,
  IdentifierNode,
  LetNode,
  IfNode,
  MatchNode,
  CallNode,
  DoNode,
  LambdaNode,
  CondNode,
  BinaryOpNode,
  UnaryOpNode,
} from '../../compiler/ast/types.js';
import {
  OpCode,
  Instruction,
  BytecodeModule,
  BytecodeFunction,
  BytecodeBuilder,
  CallOperand,
  EffectOperand,
} from './bytecode.js';
import { Value, ValueFactory } from './value.js';
import { parseVersion } from '../../compiler/versioning/semver.js';

/**
 * Compilation context
 */
interface CompilationContext {
  module: ModuleNode;
  locals: Map<string, number>; // Variable name -> stack offset
  argCount: number;             // Number of function arguments
  labelStack: string[];         // For nested control flow
}

/**
 * Bytecode compiler
 */
export class BytecodeCompiler {
  /**
   * Compile a module to bytecode
   */
  compile(module: ModuleNode): BytecodeModule {
    const functions = new Map<string, BytecodeFunction>();
    const types = new Map();
    const security: {
      roles: any[];
      permissions: any[];
      policies: any[];
    } = {
      roles: [],
      permissions: [],
      policies: [],
    };

    // Extract security primitives
    for (const element of module.elements) {
      if (element.type === 'Role') {
        security.roles.push(element as any);
      } else if (element.type === 'Permission') {
        security.permissions.push(element as any);
      } else if (element.type === 'Policy') {
        security.policies.push(element as any);
      } else if (element.type === 'TypeDef') {
        const typedef = element as any;
        types.set(typedef.name, typedef);
      }
    }

    // Compile functions
    for (const element of module.elements) {
      if (element.type === 'Function') {
        const fn = element as FunctionNode;
        const bytecode = this.compileFunction(fn, module);
        const key = `${fn.name}:${fn.version.version}`;
        functions.set(key, bytecode);
      }
    }

    return {
      name: module.name,
      version: module.version || '1.0.0',
      constants: [],
      functions,
      types,
      security,
    };
  }

  /**
   * Compile a function to bytecode
   */
  private compileFunction(fn: FunctionNode, module: ModuleNode): BytecodeFunction {
    const builder = new BytecodeBuilder();
    const ctx: CompilationContext = {
      module,
      locals: new Map(),
      argCount: fn.signature.inputs.length,
      labelStack: [],
    };

    // Arguments are already on the stack
    // Map argument names to stack positions
    fn.signature.inputs.forEach((input, index) => {
      ctx.locals.set(input.name, index);
    });

    // Compile function body
    this.compileExpression(builder, fn.body, ctx);

    // Add implicit return
    builder.emit(OpCode.RETURN);

    // Parse version string to SemanticVersion
    const parsedVersion = parseVersion(fn.version.version);
    if (!parsedVersion) {
      throw new Error(`Invalid version: ${fn.version.version}`);
    }

    return {
      name: fn.name,
      version: parsedVersion,
      arity: fn.signature.inputs.length,
      instructions: builder.build(),
      requiredRoles: fn.security.requiredRoles,
      effects: fn.effects.map(e => e.effectType),
      pure: fn.metadata.pure || false,
      idempotent: fn.metadata.idempotent || false,
      locals: ctx.locals.size,
    };
  }

  /**
   * Compile an expression
   */
  private compileExpression(
    builder: BytecodeBuilder,
    expr: ExprNode,
    ctx: CompilationContext
  ): void {
    switch (expr.type) {
      case 'Literal':
        this.compileLiteral(builder, expr as LiteralNode);
        break;

      case 'Identifier':
        this.compileIdentifier(builder, expr as IdentifierNode, ctx);
        break;

      case 'Let':
        this.compileLet(builder, expr as LetNode, ctx);
        break;

      case 'If':
        this.compileIf(builder, expr as IfNode, ctx);
        break;

      case 'Match':
        this.compileMatch(builder, expr as MatchNode, ctx);
        break;

      case 'Cond':
        this.compileCond(builder, expr as CondNode, ctx);
        break;

      case 'Call':
        this.compileCall(builder, expr as CallNode, ctx);
        break;

      case 'Do':
        this.compileDo(builder, expr as DoNode, ctx);
        break;

      case 'Lambda':
        this.compileLambda(builder, expr as LambdaNode, ctx);
        break;

      case 'BinaryOp':
        this.compileBinaryOp(builder, expr as BinaryOpNode, ctx);
        break;

      case 'UnaryOp':
        this.compileUnaryOp(builder, expr as UnaryOpNode, ctx);
        break;

      default:
        throw new Error(`Unknown expression type: ${(expr as any).type}`);
    }
  }

  /**
   * Compile a literal value
   */
  private compileLiteral(builder: BytecodeBuilder, expr: LiteralNode): void {
    let value: Value;

    switch (expr.literalType) {
      case 'unit':
        value = ValueFactory.unit();
        break;
      case 'boolean':
        value = ValueFactory.bool(expr.value as boolean);
        break;
      case 'number':
        // Determine if int or float based on the value
        const num = expr.value as number;
        value = Number.isInteger(num)
          ? ValueFactory.int(num)
          : ValueFactory.float(num);
        break;
      case 'string':
        value = ValueFactory.string(expr.value as string);
        break;
      default:
        throw new Error(`Unknown literal type: ${expr.literalType}`);
    }

    builder.emit(OpCode.PUSH, value);
  }

  /**
   * Compile an identifier (variable reference)
   */
  private compileIdentifier(
    builder: BytecodeBuilder,
    expr: IdentifierNode,
    ctx: CompilationContext
  ): void {
    const localIndex = ctx.locals.get(expr.name);

    if (localIndex !== undefined) {
      // Load from local variable or argument
      if (localIndex < ctx.argCount) {
        builder.emit(OpCode.LOAD_ARG, localIndex);
      } else {
        builder.emit(OpCode.LOAD_VAR, expr.name);
      }
    } else {
      // Could be a qualified name (module.function) or global
      builder.emit(OpCode.LOAD_VAR, expr.name);
    }
  }

  /**
   * Compile a let binding
   */
  private compileLet(builder: BytecodeBuilder, expr: LetNode, ctx: CompilationContext): void {
    // Compile all bindings
    for (const binding of expr.bindings) {
      // Compile the value expression
      this.compileExpression(builder, binding.value, ctx);

      // Store in local variable
      const localIndex = ctx.locals.size;
      ctx.locals.set(binding.name, localIndex);
      builder.emit(OpCode.STORE_VAR, binding.name);
    }

    // Compile the body expressions
    for (let i = 0; i < expr.body.length; i++) {
      this.compileExpression(builder, expr.body[i], ctx);

      // Pop intermediate results except the last one
      if (i < expr.body.length - 1) {
        builder.emit(OpCode.POP);
      }
    }

    // Clean up locals (will be handled by scope management in VM)
  }

  /**
   * Compile an if expression
   */
  private compileIf(builder: BytecodeBuilder, expr: IfNode, ctx: CompilationContext): void {
    // Compile condition
    this.compileExpression(builder, expr.condition, ctx);

    // Jump to else branch if false
    const elseLabel = builder.newLabel();
    const endLabel = builder.newLabel();

    builder.emitJump(OpCode.JUMP_IF_FALSE, elseLabel);

    // Compile then branch
    this.compileExpression(builder, expr.thenBranch, ctx);
    builder.emitJump(OpCode.JUMP, endLabel);

    // Compile else branch
    builder.placeLabel(elseLabel);
    this.compileExpression(builder, expr.elseBranch, ctx);

    builder.placeLabel(endLabel);
  }

  /**
   * Compile a match expression (pattern matching)
   */
  private compileMatch(builder: BytecodeBuilder, expr: MatchNode, ctx: CompilationContext): void {
    // Compile the expression to match on
    this.compileExpression(builder, expr.value, ctx);

    const endLabel = builder.newLabel();

    for (let i = 0; i < expr.clauses.length; i++) {
      const matchClause = expr.clauses[i];
      const nextLabel = builder.newLabel();

      // Duplicate value for matching
      if (i < expr.clauses.length - 1) {
        builder.emit(OpCode.DUP);
      }

      // Match pattern
      this.compilePattern(builder, matchClause.pattern, ctx);

      // If match fails, jump to next case
      builder.emitJump(OpCode.JUMP_IF_FALSE, nextLabel);

      // Compile case body
      this.compileExpression(builder, matchClause.body, ctx);
      builder.emitJump(OpCode.JUMP, endLabel);

      builder.placeLabel(nextLabel);
    }

    // If no case matched, error
    builder.emit(OpCode.PUSH, ValueFactory.string('Match failed: no pattern matched'));
    builder.emit(OpCode.HALT);

    builder.placeLabel(endLabel);
  }

  /**
   * Compile a pattern for matching
   */
  private compilePattern(builder: BytecodeBuilder, pattern: any, ctx: CompilationContext): void {
    // Simplified pattern compilation
    // Full implementation would handle destructuring, guards, etc.
    if (typeof pattern === 'string') {
      // Literal pattern
      builder.emit(OpCode.PUSH, ValueFactory.string(pattern));
      builder.emit(OpCode.EQ);
    } else if (pattern.type === 'ConstructorPattern') {
      // Variant pattern matching
      builder.emit(OpCode.MATCH_VARIANT, {
        typeName: pattern.constructor,
        variant: pattern.constructor,
      });
    } else {
      // Wildcard or binding pattern - always matches
      builder.emit(OpCode.POP); // Remove the value
      builder.emit(OpCode.PUSH, ValueFactory.bool(true));
    }
  }

  /**
   * Compile a cond expression (multi-way conditional)
   */
  private compileCond(builder: BytecodeBuilder, expr: CondNode, ctx: CompilationContext): void {
    const endLabel = builder.newLabel();

    for (const clause of expr.clauses) {
      const nextLabel = builder.newLabel();

      // Compile condition
      this.compileExpression(builder, clause.condition, ctx);

      // Jump to next clause if false
      builder.emitJump(OpCode.JUMP_IF_FALSE, nextLabel);

      // Compile body
      this.compileExpression(builder, clause.body, ctx);
      builder.emitJump(OpCode.JUMP, endLabel);

      builder.placeLabel(nextLabel);
    }

    // No clause matched - return unit
    builder.emit(OpCode.PUSH, ValueFactory.unit());

    builder.placeLabel(endLabel);
  }

  /**
   * Compile a function call
   */
  private compileCall(builder: BytecodeBuilder, expr: CallNode, ctx: CompilationContext): void {
    // Get function name from QualifiedNameNode
    const fnName = expr.function.parts.join('.');
    const fnVersion = expr.function.version;

    // Check if this is an effect
    if (this.isEffect(fnName)) {
      this.compileEffectCall(builder, expr, ctx);
      return;
    }

    // Compile arguments (in order)
    for (const arg of expr.args) {
      this.compileExpression(builder, arg, ctx);
    }

    const operand: CallOperand = {
      name: fnName,
      version: fnVersion,
      arity: expr.args.length,
    };

    // Check if it's a standard library function
    if (fnName.includes('.')) {
      builder.emit(OpCode.CALL_NATIVE, operand);
    } else {
      builder.emit(OpCode.CALL, operand);
    }
  }

  /**
   * Compile an effect call
   */
  private compileEffectCall(
    builder: BytecodeBuilder,
    expr: CallNode,
    ctx: CompilationContext
  ): void {
    // Compile arguments
    for (const arg of expr.args) {
      this.compileExpression(builder, arg, ctx);
    }

    // Get function name from QualifiedNameNode
    const fnName = expr.function.parts.join('.');

    // Parse effect: e.g., "db.read" -> handler="db", operation="read"
    const [handler, operation] = fnName.split('.');

    const operand: EffectOperand = {
      handler,
      operation,
      paramCount: expr.args.length,
    };

    builder.emit(OpCode.EXEC_EFFECT, operand);
  }

  /**
   * Compile a do expression (sequence)
   */
  private compileDo(builder: BytecodeBuilder, expr: DoNode, ctx: CompilationContext): void {
    for (let i = 0; i < expr.expressions.length; i++) {
      this.compileExpression(builder, expr.expressions[i], ctx);

      // Pop intermediate results except the last one
      if (i < expr.expressions.length - 1) {
        builder.emit(OpCode.POP);
      }
    }
  }

  /**
   * Compile a lambda expression
   */
  private compileLambda(
    builder: BytecodeBuilder,
    expr: LambdaNode,
    ctx: CompilationContext
  ): void {
    // Lambda compilation would create a closure
    // For now, we'll emit a placeholder
    throw new Error('Lambda compilation not yet implemented');
  }

  /**
   * Compile a binary operation
   */
  private compileBinaryOp(
    builder: BytecodeBuilder,
    expr: BinaryOpNode,
    ctx: CompilationContext
  ): void {
    // Compile left operand
    this.compileExpression(builder, expr.left, ctx);

    // Compile right operand
    this.compileExpression(builder, expr.right, ctx);

    // Emit operation
    switch (expr.operator) {
      case '+':
        builder.emit(OpCode.ADD);
        break;
      case '-':
        builder.emit(OpCode.SUB);
        break;
      case '*':
        builder.emit(OpCode.MUL);
        break;
      case '/':
        builder.emit(OpCode.DIV);
        break;
      case '%':
        builder.emit(OpCode.MOD);
        break;
      case '==':
        builder.emit(OpCode.EQ);
        break;
      case '!=':
        builder.emit(OpCode.NE);
        break;
      case '<':
        builder.emit(OpCode.LT);
        break;
      case '<=':
        builder.emit(OpCode.LE);
        break;
      case '>':
        builder.emit(OpCode.GT);
        break;
      case '>=':
        builder.emit(OpCode.GE);
        break;
      case '&&':
      case 'and':
        builder.emit(OpCode.AND);
        break;
      case '||':
      case 'or':
        builder.emit(OpCode.OR);
        break;
      default:
        throw new Error(`Unknown binary operator: ${expr.operator}`);
    }
  }

  /**
   * Compile a unary operation
   */
  private compileUnaryOp(
    builder: BytecodeBuilder,
    expr: UnaryOpNode,
    ctx: CompilationContext
  ): void {
    // Compile operand
    this.compileExpression(builder, expr.operand, ctx);

    // Emit operation
    switch (expr.operator) {
      case '-':
        builder.emit(OpCode.NEG);
        break;
      case '!':
      case 'not':
        builder.emit(OpCode.NOT);
        break;
      default:
        throw new Error(`Unknown unary operator: ${expr.operator}`);
    }
  }

  /**
   * Check if a function name is an effect
   */
  private isEffect(name: string): boolean {
    const effectPrefixes = ['db.', 'http.', 'fs.', 'log.', 'event.'];
    return effectPrefixes.some(prefix => name.startsWith(prefix));
  }
}
