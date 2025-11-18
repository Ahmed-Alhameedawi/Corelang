/**
 * CORE Language Parser
 * Converts tokens into an Abstract Syntax Tree (AST)
 */

import { Token, TokenType } from '../lexer/token';
import {
  ModuleNode,
  ElementNode,
  FunctionNode,
  TypeDefNode,
  ExprNode,
  LiteralNode,
  IdentifierNode,
  CallNode,
  LetNode,
  IfNode,
  MatchNode,
  DoNode,
  VersionInfo,
  SecurityAttributes,
  FunctionSignature,
  ParameterNode,
  EffectDeclaration,
  FunctionMetadata,
  TypeExprNode,
  PrimitiveTypeNode,
  NamedTypeNode,
  GenericTypeNode,
  FieldDefNode,
  MetadataMap,
  BindingNode,
  QualifiedNameNode,
  createSourceRange,
  ClassificationLevel,
  EffectType,
} from '../ast/types';

export class ParseError extends Error {
  constructor(message: string, public token: Token) {
    super(message);
    this.name = 'ParseError';
  }
}

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Parse the entire module
   */
  public parseModule(): ModuleNode {
    this.expect(TokenType.LPAREN);
    this.expect(TokenType.MOD);

    const name = this.parseQualifiedIdentifier();
    const metadata = this.parseMetadata();
    const elements: ElementNode[] = [];

    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      elements.push(this.parseElement());
    }

    this.expect(TokenType.RPAREN);

    return {
      type: 'Module',
      name,
      metadata,
      elements,
    };
  }

  /**
   * Parse module elements (functions, types, etc.)
   */
  private parseElement(): ElementNode {
    this.expect(TokenType.LPAREN);

    const tokenType = this.peek().type;

    switch (tokenType) {
      case TokenType.FN:
        return this.parseFunction();
      case TokenType.TYPE:
        return this.parseTypeDef();
      default:
        throw new ParseError(
          `Expected element definition, got ${tokenType}`,
          this.peek()
        );
    }
  }

  /**
   * Parse a function definition
   */
  private parseFunction(): FunctionNode {
    this.expect(TokenType.FN);

    const name = this.expect(TokenType.IDENTIFIER).value;
    const version = this.parseVersionInfo();

    // Initialize with defaults
    const security: SecurityAttributes = {
      requiredRoles: [],
      requiredCapabilities: [],
      requiredPermissions: [],
      auditRequired: false,
      handlesSecrets: false,
      crossesBoundary: false,
    };

    const signature: FunctionSignature = {
      inputs: [],
      outputs: [],
    };

    let effects: EffectDeclaration[] = [];
    const metadata: FunctionMetadata = {};
    let body: ExprNode | null = null;

    // Parse attributes in any order
    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      if (this.check(TokenType.LPAREN)) {
        // Body
        this.advance();
        this.expect(TokenType.BODY);
        body = this.parseExpression();
        this.expect(TokenType.RPAREN);
        break; // Body is the last thing
      } else if (this.checkKeyword(':requires')) {
        this.advance();
        security.requiredRoles = this.parseStringList();
      } else if (this.checkKeyword(':capabilities')) {
        this.advance();
        security.requiredCapabilities = this.parseStringList();
      } else if (this.checkKeyword(':audit-required')) {
        this.advance();
        security.auditRequired = this.parseBoolean();
      } else if (this.checkKeyword(':inputs')) {
        this.advance();
        this.expect(TokenType.LBRACKET);
        while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
          signature.inputs.push(this.parseParameter());
        }
        this.expect(TokenType.RBRACKET);
      } else if (this.checkKeyword(':outputs')) {
        this.advance();
        this.expect(TokenType.LBRACKET);
        while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
          signature.outputs.push(this.parseParameter());
        }
        this.expect(TokenType.RBRACKET);
      } else if (this.checkKeyword(':effects')) {
        this.advance();
        this.expect(TokenType.LBRACKET);
        while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
          this.expect(TokenType.LPAREN);

          let effectType = this.expect(TokenType.IDENTIFIER).value;
          if (this.check(TokenType.DOT)) {
            this.advance();
            effectType += '.' + this.expect(TokenType.IDENTIFIER).value;
          }

          const target = this.expect(TokenType.STRING).value.slice(1, -1);
          this.expect(TokenType.RPAREN);

          effects.push({ effectType: effectType as EffectType, target });
        }
        this.expect(TokenType.RBRACKET);
      } else if (this.checkKeyword(':doc')) {
        this.advance();
        metadata.doc = this.expect(TokenType.STRING).value.slice(1, -1);
      } else if (this.checkKeyword(':pure')) {
        this.advance();
        metadata.pure = this.parseBoolean();
      } else if (this.checkKeyword(':idempotent')) {
        this.advance();
        metadata.idempotent = this.parseBoolean();
      } else {
        // Unknown keyword, skip it
        break;
      }
    }

    if (!body) {
      throw new ParseError('Function must have a body', this.peek());
    }

    this.expect(TokenType.RPAREN); // Close function

    return {
      type: 'Function',
      name,
      version,
      security,
      signature,
      effects,
      metadata,
      body,
    };
  }

  /**
   * Parse a type definition
   */
  private parseTypeDef(): TypeDefNode {
    this.expect(TokenType.TYPE);

    const name = this.expect(TokenType.IDENTIFIER).value;
    const version = this.parseVersionInfo();

    // Parse fields and metadata
    const fields: FieldDefNode[] = [];
    const metadata: MetadataMap = {};

    // Keep parsing attributes until we hit the closing paren
    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      if (this.checkKeyword(':fields')) {
        this.advance();
        this.expect(TokenType.LBRACKET);

        while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
          fields.push(this.parseFieldDef());
        }

        this.expect(TokenType.RBRACKET);
      } else if (this.check(TokenType.KEYWORD_MARKER)) {
        // Parse other metadata
        const key = this.advance().value.substring(1);
        let value: any;
        if (this.check(TokenType.STRING)) {
          value = this.advance().value.slice(1, -1);
        } else if (this.check(TokenType.NUMBER)) {
          value = parseFloat(this.advance().value);
        } else if (this.check(TokenType.BOOLEAN)) {
          value = this.advance().value === 'true';
        } else if (this.check(TokenType.IDENTIFIER)) {
          value = this.advance().value;
        }
        metadata[key] = value;
      } else {
        break;
      }
    }

    this.expect(TokenType.RPAREN);

    return {
      type: 'TypeDef',
      name,
      version,
      fields,
      metadata,
    };
  }

  /**
   * Parse a field definition
   */
  private parseFieldDef(): FieldDefNode {
    this.expect(TokenType.LPAREN);
    const name = this.expect(TokenType.IDENTIFIER).value;
    const fieldType = this.parseTypeExpr();

    let classification: ClassificationLevel | undefined;
    if (this.checkKeyword(':classify')) {
      this.advance();
      classification = this.parseClassification();
    }

    this.expect(TokenType.RPAREN);

    return {
      type: 'FieldDef',
      name,
      fieldType,
      classification,
    };
  }

  /**
   * Parse a type expression
   */
  private parseTypeExpr(): TypeExprNode {
    // Handle keyword marker form (:string, :int, etc.)
    if (this.check(TokenType.KEYWORD_MARKER)) {
      const typeName = this.advance().value.substring(1); // Remove ':'

      const primitiveTypes = ['unit', 'bool', 'int', 'float', 'string', 'bytes', 'timestamp', 'uuid', 'json'];
      if (primitiveTypes.includes(typeName)) {
        return {
          type: 'PrimitiveType',
          name: typeName as any,
        } as PrimitiveTypeNode;
      }

      // Check for generic types
      const genericTypes = ['List', 'Map', 'Option', 'Result'];
      if (genericTypes.includes(typeName)) {
        return {
          type: 'GenericType',
          constructor: typeName as any,
          typeArgs: [],
        } as GenericTypeNode;
      }

      // Named type
      return {
        type: 'NamedType',
        name: typeName,
      } as NamedTypeNode;
    }

    // Handle bare identifier form
    if (this.check(TokenType.IDENTIFIER)) {
      const typeName = this.advance().value;

      const primitiveTypes = ['unit', 'bool', 'int', 'float', 'string', 'bytes', 'timestamp', 'uuid', 'json'];
      if (primitiveTypes.includes(typeName)) {
        return {
          type: 'PrimitiveType',
          name: typeName as any,
        } as PrimitiveTypeNode;
      }

      // Check for generic types
      const genericTypes = ['List', 'Map', 'Option', 'Result'];
      if (genericTypes.includes(typeName)) {
        return {
          type: 'GenericType',
          constructor: typeName as any,
          typeArgs: [],
        } as GenericTypeNode;
      }

      // Named type
      return {
        type: 'NamedType',
        name: typeName,
      } as NamedTypeNode;
    }

    throw new ParseError(`Expected type expression, got ${this.peek().type}`, this.peek());
  }

  /**
   * Parse version information
   */
  private parseVersionInfo(): VersionInfo {
    const version: VersionInfo = {
      version: '1',
    };

    if (this.check(TokenType.VERSION_MARKER)) {
      const versionToken = this.advance();
      version.version = versionToken.value.substring(2); // Remove ':v'
    }

    // Parse optional version attributes
    while (this.checkKeyword(':replaces') || this.checkKeyword(':stability') ||
           this.checkKeyword(':rollback-safe') || this.checkKeyword(':deprecated')) {
      const keyword = this.advance().value;

      switch (keyword) {
        case ':replaces':
          if (this.check(TokenType.VERSION_MARKER)) {
            const replaceToken = this.advance();
            version.replaces = [replaceToken.value.substring(2)];
          }
          break;
        case ':stability':
          version.stability = this.expect(TokenType.IDENTIFIER).value as any;
          break;
        case ':rollback-safe':
          version.rollbackSafe = this.parseBoolean();
          break;
        case ':deprecated':
          version.deprecated = this.parseBoolean();
          break;
      }
    }

    return version;
  }

  /**
   * Parse security attributes
   */
  private parseSecurityAttributes(): SecurityAttributes {
    const security: SecurityAttributes = {
      requiredRoles: [],
      requiredCapabilities: [],
      requiredPermissions: [],
      auditRequired: false,
      handlesSecrets: false,
      crossesBoundary: false,
    };

    while (this.checkKeyword(':requires') || this.checkKeyword(':capabilities') ||
           this.checkKeyword(':audit-required')) {
      const keyword = this.advance().value;

      switch (keyword) {
        case ':requires':
          security.requiredRoles = this.parseStringList();
          break;
        case ':capabilities':
          security.requiredCapabilities = this.parseStringList();
          break;
        case ':audit-required':
          security.auditRequired = this.parseBoolean();
          break;
      }
    }

    return security;
  }

  /**
   * Parse function signature
   */
  private parseFunctionSignature(): FunctionSignature {
    const inputs: ParameterNode[] = [];
    const outputs: ParameterNode[] = [];

    if (this.checkKeyword(':inputs')) {
      this.advance();
      this.expect(TokenType.LBRACKET);
      while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
        inputs.push(this.parseParameter());
      }
      this.expect(TokenType.RBRACKET);
    }

    if (this.checkKeyword(':outputs')) {
      this.advance();
      this.expect(TokenType.LBRACKET);
      while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
        outputs.push(this.parseParameter());
      }
      this.expect(TokenType.RBRACKET);
    }

    return { inputs, outputs };
  }

  /**
   * Parse a parameter
   */
  private parseParameter(): ParameterNode {
    this.expect(TokenType.LPAREN);
    const name = this.expect(TokenType.IDENTIFIER).value;
    const paramType = this.parseTypeExpr();
    this.expect(TokenType.RPAREN);

    return {
      type: 'Parameter',
      name,
      paramType,
      optional: false,
    };
  }

  /**
   * Parse effects
   */
  private parseEffects(): EffectDeclaration[] {
    const effects: EffectDeclaration[] = [];

    if (this.checkKeyword(':effects')) {
      this.advance();
      this.expect(TokenType.LBRACKET);

      while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
        this.expect(TokenType.LPAREN);

        // Parse effect type (can be qualified like "db.write")
        let effectType = this.expect(TokenType.IDENTIFIER).value;
        if (this.check(TokenType.DOT)) {
          this.advance();
          effectType += '.' + this.expect(TokenType.IDENTIFIER).value;
        }

        const target = this.expect(TokenType.STRING).value.slice(1, -1); // Remove quotes
        this.expect(TokenType.RPAREN);

        effects.push({ effectType: effectType as EffectType, target });
      }

      this.expect(TokenType.RBRACKET);
    }

    return effects;
  }

  /**
   * Parse function metadata
   */
  private parseFunctionMetadata(): FunctionMetadata {
    const metadata: FunctionMetadata = {};

    while (this.checkKeyword(':doc') || this.checkKeyword(':pure') ||
           this.checkKeyword(':idempotent')) {
      const keyword = this.advance().value;

      switch (keyword) {
        case ':doc':
          metadata.doc = this.expect(TokenType.STRING).value.slice(1, -1);
          break;
        case ':pure':
          metadata.pure = this.parseBoolean();
          break;
        case ':idempotent':
          metadata.idempotent = this.parseBoolean();
          break;
      }
    }

    return metadata;
  }

  /**
   * Parse metadata key-value pairs
   */
  private parseMetadata(): MetadataMap {
    const metadata: MetadataMap = {};

    while (this.check(TokenType.KEYWORD_MARKER)) {
      const key = this.advance().value.substring(1); // Remove ':'

      let value: any;
      if (this.check(TokenType.STRING)) {
        value = this.advance().value.slice(1, -1); // Remove quotes
      } else if (this.check(TokenType.NUMBER)) {
        value = parseFloat(this.advance().value);
      } else if (this.check(TokenType.BOOLEAN)) {
        value = this.advance().value === 'true';
      } else if (this.check(TokenType.IDENTIFIER)) {
        value = this.advance().value;
      }

      metadata[key] = value;
    }

    return metadata;
  }

  /**
   * Parse an expression
   */
  private parseExpression(): ExprNode {
    // Check for literal values
    if (this.check(TokenType.NUMBER)) {
      const token = this.advance();
      return {
        type: 'Literal',
        value: parseFloat(token.value),
        literalType: 'number',
      } as LiteralNode;
    }

    if (this.check(TokenType.STRING)) {
      const token = this.advance();
      return {
        type: 'Literal',
        value: token.value.slice(1, -1), // Remove quotes
        literalType: 'string',
      } as LiteralNode;
    }

    if (this.check(TokenType.BOOLEAN)) {
      const token = this.advance();
      return {
        type: 'Literal',
        value: token.value === 'true',
        literalType: 'boolean',
      } as LiteralNode;
    }

    // Check for identifiers
    if (this.check(TokenType.IDENTIFIER)) {
      const token = this.advance();
      return {
        type: 'Identifier',
        name: token.value,
      } as IdentifierNode;
    }

    // Check for special forms
    if (this.check(TokenType.LPAREN)) {
      this.advance();

      // Check what kind of expression this is
      if (this.check(TokenType.LET)) {
        return this.parseLet();
      } else if (this.check(TokenType.IF)) {
        return this.parseIf();
      } else if (this.check(TokenType.DO)) {
        return this.parseDo();
      } else {
        // Function call
        return this.parseCall();
      }
    }

    throw new ParseError(`Unexpected token in expression: ${this.peek().type}`, this.peek());
  }

  /**
   * Parse a let expression
   */
  private parseLet(): LetNode {
    this.expect(TokenType.LET);
    this.expect(TokenType.LBRACKET);

    const bindings: BindingNode[] = [];
    while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
      const name = this.expect(TokenType.IDENTIFIER).value;
      const value = this.parseExpression();
      bindings.push({
        type: 'Binding',
        name,
        value,
      });
    }

    this.expect(TokenType.RBRACKET);

    const body: ExprNode[] = [];
    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      body.push(this.parseExpression());
    }

    this.expect(TokenType.RPAREN);

    return {
      type: 'Let',
      bindings,
      body,
    };
  }

  /**
   * Parse an if expression
   */
  private parseIf(): IfNode {
    this.expect(TokenType.IF);

    const condition = this.parseExpression();
    const thenBranch = this.parseExpression();
    const elseBranch = this.parseExpression();

    this.expect(TokenType.RPAREN);

    return {
      type: 'If',
      condition,
      thenBranch,
      elseBranch,
    };
  }

  /**
   * Parse a do expression
   */
  private parseDo(): DoNode {
    this.expect(TokenType.DO);

    const expressions: ExprNode[] = [];
    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      expressions.push(this.parseExpression());
    }

    this.expect(TokenType.RPAREN);

    return {
      type: 'Do',
      expressions,
    };
  }

  /**
   * Parse a function call
   */
  private parseCall(): CallNode {
    const functionName = this.parseQualifiedName();
    const args: ExprNode[] = [];

    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      args.push(this.parseExpression());
    }

    this.expect(TokenType.RPAREN);

    return {
      type: 'Call',
      function: functionName,
      args,
    };
  }

  /**
   * Helper methods
   */

  private parseQualifiedName(): QualifiedNameNode {
    const parts: string[] = [];
    parts.push(this.expect(TokenType.IDENTIFIER).value);

    while (this.check(TokenType.DOT)) {
      this.advance();
      parts.push(this.expect(TokenType.IDENTIFIER).value);
    }

    let version: string | undefined;
    if (this.check(TokenType.VERSION_MARKER)) {
      version = this.advance().value.substring(2);
    }

    return {
      type: 'QualifiedName',
      parts,
      version,
    };
  }

  private parseQualifiedIdentifier(): string {
    const parts: string[] = [];
    parts.push(this.expect(TokenType.IDENTIFIER).value);

    while (this.check(TokenType.DOT)) {
      this.advance();
      parts.push(this.expect(TokenType.IDENTIFIER).value);
    }

    return parts.join('.');
  }

  private parseStringList(): string[] {
    const list: string[] = [];
    this.expect(TokenType.LBRACKET);

    while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
      // Handle qualified identifiers (e.g., db.write)
      let value = this.expect(TokenType.IDENTIFIER).value;
      while (this.check(TokenType.DOT)) {
        this.advance();
        value += '.' + this.expect(TokenType.IDENTIFIER).value;
      }
      list.push(value);
    }

    this.expect(TokenType.RBRACKET);
    return list;
  }

  private parseBoolean(): boolean {
    const token = this.expect(TokenType.BOOLEAN);
    return token.value === 'true';
  }

  private parseClassification(): ClassificationLevel {
    if (this.check(TokenType.KEYWORD_MARKER)) {
      const value = this.advance().value.substring(1); // Remove ':'
      return value as ClassificationLevel;
    }
    throw new ParseError('Expected classification level', this.peek());
  }

  /**
   * Token navigation
   */

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private checkKeyword(keyword: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === TokenType.KEYWORD_MARKER && this.peek().value === keyword;
  }

  private expect(type: TokenType): Token {
    if (this.check(type)) {
      return this.advance();
    }

    throw new ParseError(
      `Expected token type ${type}, but got ${this.peek().type}`,
      this.peek()
    );
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }
}

/**
 * Convenience function to parse source code
 */
export function parse(tokens: Token[]): ModuleNode {
  const parser = new Parser(tokens);
  return parser.parseModule();
}
