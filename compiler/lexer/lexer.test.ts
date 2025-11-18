/**
 * Tests for CORE Language Lexer
 */

import { Lexer, tokenize } from './lexer';
import { TokenType } from './token';

describe('Lexer', () => {
  describe('Basic Tokens', () => {
    test('should tokenize parentheses', () => {
      const tokens = tokenize('()');
      expect(tokens).toHaveLength(3); // (, ), EOF
      expect(tokens[0].type).toBe(TokenType.LPAREN);
      expect(tokens[1].type).toBe(TokenType.RPAREN);
      expect(tokens[2].type).toBe(TokenType.EOF);
    });

    test('should tokenize brackets', () => {
      const tokens = tokenize('[]');
      expect(tokens[0].type).toBe(TokenType.LBRACKET);
      expect(tokens[1].type).toBe(TokenType.RBRACKET);
    });

    test('should tokenize braces', () => {
      const tokens = tokenize('{}');
      expect(tokens[0].type).toBe(TokenType.LBRACE);
      expect(tokens[1].type).toBe(TokenType.RBRACE);
    });
  });

  describe('Literals', () => {
    test('should tokenize integers', () => {
      const tokens = tokenize('42');
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('42');
    });

    test('should tokenize negative integers', () => {
      const tokens = tokenize('-42');
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('-42');
    });

    test('should tokenize floats', () => {
      const tokens = tokenize('3.14');
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('3.14');
    });

    test('should tokenize strings', () => {
      const tokens = tokenize('"hello world"');
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('"hello world"');
    });

    test('should tokenize strings with escapes', () => {
      const tokens = tokenize('"hello \\"world\\""');
      expect(tokens[0].type).toBe(TokenType.STRING);
    });

    test('should tokenize booleans', () => {
      const tokens = tokenize('true false');
      expect(tokens[0].type).toBe(TokenType.BOOLEAN);
      expect(tokens[0].value).toBe('true');
      expect(tokens[1].type).toBe(TokenType.BOOLEAN);
      expect(tokens[1].value).toBe('false');
    });
  });

  describe('Keywords', () => {
    test('should tokenize mod keyword', () => {
      const tokens = tokenize('mod');
      expect(tokens[0].type).toBe(TokenType.MOD);
    });

    test('should tokenize fn keyword', () => {
      const tokens = tokenize('fn');
      expect(tokens[0].type).toBe(TokenType.FN);
    });

    test('should tokenize type keyword', () => {
      const tokens = tokenize('type');
      expect(tokens[0].type).toBe(TokenType.TYPE);
    });

    test('should tokenize all control flow keywords', () => {
      const tokens = tokenize('let if match cond do');
      expect(tokens[0].type).toBe(TokenType.LET);
      expect(tokens[1].type).toBe(TokenType.IF);
      expect(tokens[2].type).toBe(TokenType.MATCH);
      expect(tokens[3].type).toBe(TokenType.COND);
      expect(tokens[4].type).toBe(TokenType.DO);
    });
  });

  describe('Identifiers', () => {
    test('should tokenize simple identifiers', () => {
      const tokens = tokenize('foo bar baz');
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].value).toBe('foo');
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('bar');
    });

    test('should tokenize identifiers with hyphens', () => {
      const tokens = tokenize('user-service my-function');
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].value).toBe('user-service');
    });

    test('should tokenize identifiers with underscores', () => {
      const tokens = tokenize('user_id get_user');
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].value).toBe('user_id');
    });
  });

  describe('Keyword Markers', () => {
    test('should tokenize keyword markers', () => {
      const tokens = tokenize(':version :requires :inputs');
      expect(tokens[0].type).toBe(TokenType.KEYWORD_MARKER);
      expect(tokens[0].value).toBe(':version');
      expect(tokens[1].type).toBe(TokenType.KEYWORD_MARKER);
      expect(tokens[1].value).toBe(':requires');
    });

    test('should tokenize version markers', () => {
      const tokens = tokenize(':v1 :v2 :v1.0.0');
      expect(tokens[0].type).toBe(TokenType.VERSION_MARKER);
      expect(tokens[0].value).toBe(':v1');
      expect(tokens[1].type).toBe(TokenType.VERSION_MARKER);
      expect(tokens[1].value).toBe(':v2');
      expect(tokens[2].type).toBe(TokenType.VERSION_MARKER);
      expect(tokens[2].value).toBe(':v1.0.0');
    });
  });

  describe('Comments', () => {
    test('should skip line comments', () => {
      const tokens = tokenize('; This is a comment\nfoo');
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].value).toBe('foo');
    });

    test('should skip multiple comments', () => {
      const tokens = tokenize('; Comment 1\n; Comment 2\nbar');
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].value).toBe('bar');
    });
  });

  describe('Complex Expressions', () => {
    test('should tokenize a simple function definition', () => {
      const source = `(fn greet :v1
        :inputs [(name :string)]
        :outputs [(result :string)]
        (body (str "Hello, " name)))`;

      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.LPAREN);
      expect(tokens[1].type).toBe(TokenType.FN);
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].value).toBe('greet');
      expect(tokens[3].type).toBe(TokenType.VERSION_MARKER);
      expect(tokens[3].value).toBe(':v1');
    });

    test('should tokenize a module definition', () => {
      const source = `(mod user.service
        :version "1.0.0"
        (fn get :v1))`;

      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.LPAREN);
      expect(tokens[1].type).toBe(TokenType.MOD);
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].value).toBe('user');
      expect(tokens[3].type).toBe(TokenType.DOT);
      expect(tokens[4].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[4].value).toBe('service');
    });
  });

  describe('Source Location Tracking', () => {
    test('should track line and column numbers', () => {
      const source = `foo\nbar\nbaz`;
      const tokens = tokenize(source);

      expect(tokens[0].loc.line).toBe(1);
      expect(tokens[0].loc.column).toBe(1);

      expect(tokens[1].loc.line).toBe(2);
      expect(tokens[1].loc.column).toBe(1);

      expect(tokens[2].loc.line).toBe(3);
      expect(tokens[2].loc.column).toBe(1);
    });
  });
});
