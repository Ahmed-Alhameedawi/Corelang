/**
 * CORE Language Lexer (Tokenizer)
 */

import { Token, TokenType, createToken, KEYWORDS } from './token';
import { createSourceLocation, SourceLocation } from '../ast/types';

export class Lexer {
  private source: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(source: string) {
    this.source = source;
  }

  /**
   * Tokenize the entire source code
   */
  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let token = this.nextToken();

    while (token.type !== TokenType.EOF) {
      if (token.type !== TokenType.INVALID) {
        tokens.push(token);
      }
      token = this.nextToken();
    }

    tokens.push(token); // Add EOF token
    return tokens;
  }

  /**
   * Get the next token from the source
   */
  public nextToken(): Token {
    this.skipWhitespaceAndComments();

    if (this.isAtEnd()) {
      return this.makeToken(TokenType.EOF, '');
    }

    const char = this.peek();
    const loc = this.currentLocation();

    // Single-character tokens
    switch (char) {
      case '(':
        this.advance();
        return createToken(TokenType.LPAREN, '(', loc);
      case ')':
        this.advance();
        return createToken(TokenType.RPAREN, ')', loc);
      case '[':
        this.advance();
        return createToken(TokenType.LBRACKET, '[', loc);
      case ']':
        this.advance();
        return createToken(TokenType.RBRACKET, ']', loc);
      case '{':
        this.advance();
        return createToken(TokenType.LBRACE, '{', loc);
      case '}':
        this.advance();
        return createToken(TokenType.RBRACE, '}', loc);
      case ',':
        this.advance();
        return createToken(TokenType.COMMA, ',', loc);
      case '|':
        this.advance();
        return createToken(TokenType.PIPE, '|', loc);
      case '?':
        this.advance();
        return createToken(TokenType.QUESTION, '?', loc);
      case '.':
        this.advance();
        return createToken(TokenType.DOT, '.', loc);
    }

    // Colon (keyword marker or version marker)
    if (char === ':') {
      return this.lexKeywordMarker();
    }

    // Minus (could be number or arrow)
    if (char === '-') {
      if (this.peekNext() === '>') {
        this.advance();
        this.advance();
        return createToken(TokenType.ARROW, '->', loc);
      } else if (this.isDigit(this.peekNext())) {
        return this.lexNumber();
      }
      // Otherwise, treat as start of identifier
      return this.lexIdentifier();
    }

    // Strings
    if (char === '"') {
      return this.lexString();
    }

    // Numbers
    if (this.isDigit(char)) {
      return this.lexNumber();
    }

    // Identifiers and keywords
    if (this.isAlpha(char)) {
      return this.lexIdentifier();
    }

    // Unknown character
    this.advance();
    return createToken(TokenType.INVALID, char, loc);
  }

  /**
   * Lex a string literal
   */
  private lexString(): Token {
    const start = this.currentLocation();
    const startPos = this.position;

    this.advance(); // Opening quote

    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\\') {
        this.advance(); // Skip escape character
        if (!this.isAtEnd()) {
          this.advance(); // Skip escaped character
        }
      } else {
        this.advance();
      }
    }

    if (this.isAtEnd()) {
      return createToken(TokenType.INVALID, 'Unterminated string', start);
    }

    this.advance(); // Closing quote

    const value = this.source.substring(startPos, this.position);
    return createToken(TokenType.STRING, value, start);
  }

  /**
   * Lex a number literal
   */
  private lexNumber(): Token {
    const start = this.currentLocation();
    const startPos = this.position;

    // Handle negative numbers
    if (this.peek() === '-') {
      this.advance();
    }

    // Integer part
    while (this.isDigit(this.peek())) {
      this.advance();
    }

    // Decimal part
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance(); // Consume '.'
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }

    const value = this.source.substring(startPos, this.position);
    return createToken(TokenType.NUMBER, value, start);
  }

  /**
   * Lex an identifier or keyword
   */
  private lexIdentifier(): Token {
    const start = this.currentLocation();
    const startPos = this.position;

    while (this.isAlphaNumeric(this.peek()) || this.peek() === '-' || this.peek() === '_') {
      this.advance();
    }

    const value = this.source.substring(startPos, this.position);
    const type = KEYWORDS[value] || TokenType.IDENTIFIER;

    return createToken(type, value, start);
  }

  /**
   * Lex keyword marker (:version, :requires, etc.) or version marker (:v1, :v2, etc.)
   */
  private lexKeywordMarker(): Token {
    const start = this.currentLocation();
    const startPos = this.position;

    this.advance(); // Consume ':'

    // Check for version marker (:v followed by number)
    if (this.peek() === 'v' && this.isDigit(this.peekNext())) {
      this.advance(); // Consume 'v'

      // Consume version number (can include dots for semver)
      while (this.isDigit(this.peek()) || this.peek() === '.') {
        this.advance();
      }

      const value = this.source.substring(startPos, this.position);
      return createToken(TokenType.VERSION_MARKER, value, start);
    }

    // Regular keyword marker
    while (this.isAlphaNumeric(this.peek()) || this.peek() === '-') {
      this.advance();
    }

    const value = this.source.substring(startPos, this.position);
    return createToken(TokenType.KEYWORD_MARKER, value, start);
  }

  /**
   * Skip whitespace and comments
   */
  private skipWhitespaceAndComments(): void {
    while (true) {
      const char = this.peek();

      switch (char) {
        case ' ':
        case '\r':
        case '\t':
          this.advance();
          break;

        case '\n':
          this.line++;
          this.column = 0;
          this.advance();
          break;

        case ';':
          // Comment - skip to end of line
          while (!this.isAtEnd() && this.peek() !== '\n') {
            this.advance();
          }
          break;

        default:
          return;
      }
    }
  }

  /**
   * Character classification helpers
   */
  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  /**
   * Position tracking
   */
  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.position];
  }

  private peekNext(): string {
    if (this.position + 1 >= this.source.length) return '\0';
    return this.source[this.position + 1];
  }

  private advance(): string {
    const char = this.source[this.position];
    this.position++;
    this.column++;
    return char;
  }

  private isAtEnd(): boolean {
    return this.position >= this.source.length;
  }

  private currentLocation(): SourceLocation {
    return createSourceLocation(this.line, this.column, this.position);
  }

  private makeToken(type: TokenType, value: string): Token {
    return createToken(type, value, this.currentLocation());
  }
}

/**
 * Convenience function to tokenize source code
 */
export function tokenize(source: string): Token[] {
  const lexer = new Lexer(source);
  return lexer.tokenize();
}
