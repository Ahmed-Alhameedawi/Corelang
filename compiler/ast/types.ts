/**
 * CORE Language AST Type Definitions
 * Version 0.1.0
 */

// ========== Base Types ==========

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

export interface SourceRange {
  start: SourceLocation;
  end: SourceLocation;
}

export interface ASTNode {
  type: string;
  loc?: SourceRange;
}

// ========== Module ==========

export interface ModuleNode extends ASTNode {
  type: 'Module';
  name: string;
  version?: string;
  metadata: MetadataMap;
  elements: ElementNode[];
}

export type MetadataMap = Record<string, MetadataValue>;
export type MetadataValue = string | number | boolean | object | null;

export type ElementNode =
  | TypeDefNode
  | FunctionNode
  | RoleNode
  | PermissionNode
  | PolicyNode
  | ChannelNode
  | ContractNode
  | ImportNode
  | ExportNode;

// ========== Type Definitions ==========

export interface TypeDefNode extends ASTNode {
  type: 'TypeDef';
  name: string;
  version: VersionInfo;
  fields: FieldDefNode[];
  metadata: MetadataMap;
}

export interface FieldDefNode extends ASTNode {
  type: 'FieldDef';
  name: string;
  fieldType: TypeExprNode;
  classification?: ClassificationLevel;
}

export type ClassificationLevel = 'public' | 'internal' | 'confidential' | 'restricted';

export type TypeExprNode =
  | PrimitiveTypeNode
  | NamedTypeNode
  | GenericTypeNode
  | SumTypeNode
  | FunctionTypeNode;

export interface PrimitiveTypeNode extends ASTNode {
  type: 'PrimitiveType';
  name: 'unit' | 'bool' | 'int' | 'float' | 'string' | 'bytes' | 'timestamp' | 'uuid' | 'json';
}

export interface NamedTypeNode extends ASTNode {
  type: 'NamedType';
  name: string;
  version?: string;
}

export interface GenericTypeNode extends ASTNode {
  type: 'GenericType';
  constructor: 'List' | 'Map' | 'Option' | 'Result';
  typeArgs: TypeExprNode[];
}

export interface SumTypeNode extends ASTNode {
  type: 'SumType';
  variants: VariantNode[];
}

export interface VariantNode extends ASTNode {
  type: 'Variant';
  name: string;
  valueType?: TypeExprNode;
}

export interface FunctionTypeNode extends ASTNode {
  type: 'FunctionType';
  params: TypeExprNode[];
  returnType: TypeExprNode;
}

// ========== Version Information ==========

export interface VersionInfo {
  version: string;
  replaces?: string[];
  stability?: StabilityLevel;
  deprecated?: boolean;
  rollbackSafe?: boolean;
  rollbackRequires?: string;
  breakingChanges?: string[];
  migration?: string;
}

export type StabilityLevel = 'stable' | 'beta' | 'alpha' | 'deprecated';

// ========== Functions ==========

export interface FunctionNode extends ASTNode {
  type: 'Function';
  name: string;
  version: VersionInfo;
  security: SecurityAttributes;
  signature: FunctionSignature;
  effects: EffectDeclaration[];
  metadata: FunctionMetadata;
  body: ExprNode;
}

export interface SecurityAttributes {
  requiredRoles: string[];
  requiredCapabilities: string[];
  requiredPermissions: string[];
  auditRequired: boolean;
  handlesSecrets: boolean;
  crossesBoundary: boolean;
}

export interface FunctionSignature {
  inputs: ParameterNode[];
  outputs: ParameterNode[];
}

export interface ParameterNode extends ASTNode {
  type: 'Parameter';
  name: string;
  paramType: TypeExprNode;
  optional: boolean;
}

export interface EffectDeclaration {
  effectType: EffectType;
  target: string;
  classification?: ClassificationLevel;
}

export type EffectType =
  | 'db.read'
  | 'db.write'
  | 'http.call'
  | 'fs.read'
  | 'fs.write'
  | 'event.emit'
  | 'event.subscribe'
  | 'log'
  | 'random'
  | 'time';

export interface FunctionMetadata {
  doc?: string;
  pure?: boolean;
  idempotent?: boolean;
  decomposition?: DecompositionHints;
  errorTaxonomy?: ErrorTaxonomy;
  examples?: Example[];
}

export interface DecompositionHints {
  steps: DecompositionStep[];
  dependencies?: string[];
  parallelizable?: boolean;
}

export interface DecompositionStep {
  order: number;
  description: string;
  subFunction?: string;
}

export interface ErrorTaxonomy {
  errors: ErrorInfo[];
}

export interface ErrorInfo {
  type: string;
  description?: string;
  retryable: boolean;
  userFixable: boolean;
  suggestedAction?: string;
}

export interface Example {
  scenario: string;
  exampleCall: string;
  expectedOutcome: string;
}

// ========== Expressions ==========

export type ExprNode =
  | LiteralNode
  | IdentifierNode
  | LetNode
  | IfNode
  | CondNode
  | MatchNode
  | CallNode
  | DoNode
  | LambdaNode
  | BinaryOpNode
  | UnaryOpNode;

export interface LiteralNode extends ASTNode {
  type: 'Literal';
  value: string | number | boolean | null;
  literalType: 'string' | 'number' | 'boolean' | 'unit';
}

export interface IdentifierNode extends ASTNode {
  type: 'Identifier';
  name: string;
}

export interface LetNode extends ASTNode {
  type: 'Let';
  bindings: BindingNode[];
  body: ExprNode[];
}

export interface BindingNode extends ASTNode {
  type: 'Binding';
  name: string;
  value: ExprNode;
}

export interface IfNode extends ASTNode {
  type: 'If';
  condition: ExprNode;
  thenBranch: ExprNode;
  elseBranch: ExprNode;
}

export interface CondNode extends ASTNode {
  type: 'Cond';
  clauses: CondClauseNode[];
  elseClause?: ExprNode;
}

export interface CondClauseNode extends ASTNode {
  type: 'CondClause';
  condition: ExprNode;
  body: ExprNode;
}

export interface MatchNode extends ASTNode {
  type: 'Match';
  value: ExprNode;
  clauses: MatchClauseNode[];
}

export interface MatchClauseNode extends ASTNode {
  type: 'MatchClause';
  pattern: PatternNode;
  body: ExprNode;
}

export type PatternNode =
  | LiteralPatternNode
  | IdentifierPatternNode
  | ConstructorPatternNode
  | WildcardPatternNode;

export interface LiteralPatternNode extends ASTNode {
  type: 'LiteralPattern';
  value: string | number | boolean;
}

export interface IdentifierPatternNode extends ASTNode {
  type: 'IdentifierPattern';
  name: string;
}

export interface ConstructorPatternNode extends ASTNode {
  type: 'ConstructorPattern';
  constructor: string;
  patterns: PatternNode[];
}

export interface WildcardPatternNode extends ASTNode {
  type: 'WildcardPattern';
}

export interface CallNode extends ASTNode {
  type: 'Call';
  function: QualifiedNameNode;
  args: ExprNode[];
}

export interface QualifiedNameNode extends ASTNode {
  type: 'QualifiedName';
  parts: string[];
  version?: string;
}

export interface DoNode extends ASTNode {
  type: 'Do';
  expressions: ExprNode[];
}

export interface LambdaNode extends ASTNode {
  type: 'Lambda';
  params: ParameterNode[];
  body: ExprNode;
}

export interface BinaryOpNode extends ASTNode {
  type: 'BinaryOp';
  operator: string;
  left: ExprNode;
  right: ExprNode;
}

export interface UnaryOpNode extends ASTNode {
  type: 'UnaryOp';
  operator: string;
  operand: ExprNode;
}

// ========== Security Primitives ==========

export interface RoleNode extends ASTNode {
  type: 'Role';
  name: string;
  permissions: string[];
  inherits: string[];
}

export interface PermissionNode extends ASTNode {
  type: 'Permission';
  name: string;
  description?: string;
  scope?: ScopeItem[];
  classification?: ClassificationLevel;
  auditRequired: boolean;
}

export interface ScopeItem {
  type: 'resource' | 'action';
  value: string;
}

export interface PolicyNode extends ASTNode {
  type: 'Policy';
  name: string;
  description?: string;
  rules: RuleNode[];
}

export interface RuleNode extends ASTNode {
  type: 'Rule';
  effect: 'allow' | 'deny';
  roles: string[];
  permissions: string[];
  versionConstraint?: VersionConstraint;
  condition?: ExprNode;
  reason?: string;
}

export type VersionConstraint =
  | { type: 'all' }
  | { type: 'stable-only' }
  | { type: 'specific'; versions: string[] }
  | { type: 'range'; range: string };

// ========== Channels and Contracts ==========

export interface ChannelNode extends ASTNode {
  type: 'Channel';
  name: string;
  mode: ChannelMode;
  security: ChannelSecurity;
  events: EventDefNode[];
}

export type ChannelMode = 'pub-sub' | 'queue' | 'stream';

export interface ChannelSecurity {
  publish: string[];
  subscribe: string[];
}

export interface EventDefNode extends ASTNode {
  type: 'EventDef';
  name: string;
  version: VersionInfo;
  schema?: TypeDefNode;
}

export interface ContractNode extends ASTNode {
  type: 'Contract';
  name: string;
  version: VersionInfo;
  operations: string[];
  guarantees: string[];
}

// ========== Import/Export ==========

export interface ImportNode extends ASTNode {
  type: 'Import';
  module: string;
  version?: string;
  functions: ImportedFunction[];
  channels: ImportedChannel[];
}

export interface ImportedFunction {
  name: string;
  versionConstraint: string;
}

export interface ImportedChannel {
  name: string;
  mode: 'subscribe' | 'publish';
}

export interface ExportNode extends ASTNode {
  type: 'Export';
  items: ExportItem[];
}

export interface ExportItem {
  elementType: 'fn' | 'type' | 'chan';
  name: string;
  version: VersionInfo;
  visibility: Visibility;
}

export type Visibility = 'public' | 'internal' | 'private';

// ========== Utility Functions ==========

export function createSourceLocation(line: number, column: number, offset: number): SourceLocation {
  return { line, column, offset };
}

export function createSourceRange(start: SourceLocation, end: SourceLocation): SourceRange {
  return { start, end };
}
