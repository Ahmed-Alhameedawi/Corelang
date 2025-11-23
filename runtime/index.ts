/**
 * CORE Runtime - Main Exports
 */

// VM exports
export { VM, VMError, SecurityError, TypeMismatchError, Principal } from './vm/vm.js';
export {
  Value,
  UnitValue,
  BoolValue,
  IntValue,
  FloatValue,
  StringValue,
  BytesValue,
  UuidValue,
  TimestampValue,
  JsonValue,
  ListValue,
  MapValue,
  RecordValue,
  VariantValue,
  FunctionValue,
  ResultValue,
  OptionValue,
  ValueFactory,
  ValueTypeChecker,
  ValueOps,
  ClassificationLevel,
} from './vm/value.js';
export {
  OpCode,
  Instruction,
  BytecodeModule,
  BytecodeFunction,
  BytecodeBuilder,
  BytecodeDisassembler,
  CallOperand,
  EffectOperand,
  JumpOperand,
  SourceLocation,
} from './vm/bytecode.js';
export { BytecodeCompiler } from './vm/compiler.js';

// Effect exports
export {
  EffectHandler,
  EffectMetadata,
  EffectHandlerRegistry,
  AuditLogger,
  AuditLogEntry,
} from './effects/registry.js';
export { DatabaseEffectHandler } from './effects/database.js';
export { HttpEffectHandler } from './effects/http.js';
export { FilesystemEffectHandler } from './effects/filesystem.js';
export { LoggingEffectHandler, LogLevel, LogEntry } from './effects/logging.js';
