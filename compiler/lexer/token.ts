/**
 * CORE Language Token Definitions
 */

import { SourceLocation } from '../ast/types';

export enum TokenType {
  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  IDENTIFIER = 'IDENTIFIER',

  // Keywords
  MOD = 'MOD',
  FN = 'FN',
  TYPE = 'TYPE',
  ROLE = 'ROLE',
  PERM = 'PERM',
  POLICY = 'POLICY',
  PRINCIPAL = 'PRINCIPAL',
  CHAN = 'CHAN',
  CONTRACT = 'CONTRACT',
  TASK = 'TASK',
  EFFECT = 'EFFECT',
  BODY = 'BODY',
  LET = 'LET',
  IF = 'IF',
  MATCH = 'MATCH',
  COND = 'COND',
  DO = 'DO',
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',

  // Symbols
  LPAREN = 'LPAREN',          // (
  RPAREN = 'RPAREN',          // )
  LBRACKET = 'LBRACKET',      // [
  RBRACKET = 'RBRACKET',      // ]
  LBRACE = 'LBRACE',          // {
  RBRACE = 'RBRACE',          // }
  COLON = 'COLON',            // :
  DOT = 'DOT',                // .
  COMMA = 'COMMA',            // ,
  PIPE = 'PIPE',              // |
  ARROW = 'ARROW',            // ->
  QUESTION = 'QUESTION',      // ?

  // Special
  KEYWORD_MARKER = 'KEYWORD_MARKER',  // : followed by identifier (e.g., :version)
  VERSION_MARKER = 'VERSION_MARKER',  // :v followed by number

  EOF = 'EOF',
  INVALID = 'INVALID',
}

export interface Token {
  type: TokenType;
  value: string;
  loc: SourceLocation;
}

export function createToken(type: TokenType, value: string, loc: SourceLocation): Token {
  return { type, value, loc };
}

export const KEYWORDS: Record<string, TokenType> = {
  'mod': TokenType.MOD,
  'fn': TokenType.FN,
  'type': TokenType.TYPE,
  'role': TokenType.ROLE,
  'perm': TokenType.PERM,
  'policy': TokenType.POLICY,
  'principal': TokenType.PRINCIPAL,
  'chan': TokenType.CHAN,
  'contract': TokenType.CONTRACT,
  'task': TokenType.TASK,
  'effect': TokenType.EFFECT,
  'body': TokenType.BODY,
  'let': TokenType.LET,
  'if': TokenType.IF,
  'match': TokenType.MATCH,
  'cond': TokenType.COND,
  'do': TokenType.DO,
  'import': TokenType.IMPORT,
  'export': TokenType.EXPORT,
  'true': TokenType.BOOLEAN,
  'false': TokenType.BOOLEAN,
};
