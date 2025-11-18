#!/usr/bin/env node

/**
 * CORE Language CLI Tool
 */

import * as fs from 'fs';
import * as path from 'path';
import { program } from 'commander';
import { tokenize } from '../compiler/lexer/lexer';
import { parse } from '../compiler/parser/parser';

program
  .name('core')
  .description('CORE Language Compiler CLI')
  .version('0.1.0');

program
  .command('tokenize <file>')
  .description('Tokenize a CORE source file')
  .action((file: string) => {
    const source = fs.readFileSync(file, 'utf-8');
    const tokens = tokenize(source);

    console.log('Tokens:');
    tokens.forEach((token, index) => {
      console.log(`${index.toString().padStart(3)}: ${token.type.padEnd(20)} ${token.value}`);
    });
  });

program
  .command('parse <file>')
  .description('Parse a CORE source file and output AST')
  .option('-j, --json', 'Output as JSON')
  .option('-p, --pretty', 'Pretty print output')
  .action((file: string, options: { json?: boolean; pretty?: boolean }) => {
    const source = fs.readFileSync(file, 'utf-8');
    const tokens = tokenize(source);
    const ast = parse(tokens);

    if (options.json) {
      console.log(JSON.stringify(ast, null, options.pretty ? 2 : 0));
    } else {
      console.log('AST:');
      console.log(JSON.stringify(ast, null, 2));
    }
  });

program
  .command('compile <file>')
  .description('Compile a CORE source file')
  .option('-o, --output <path>', 'Output file path')
  .action((file: string, options: { output?: string }) => {
    try {
      const source = fs.readFileSync(file, 'utf-8');
      const tokens = tokenize(source);
      const ast = parse(tokens);

      const output = {
        module: ast.name,
        version: ast.metadata.version || '0.0.0',
        ast: ast,
        compiled_at: new Date().toISOString(),
      };

      const outputPath = options.output || file.replace('.core', '.json');
      fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

      console.log(`✓ Compiled ${file} → ${outputPath}`);
      console.log(`  Module: ${ast.name}`);
      console.log(`  Elements: ${ast.elements.length}`);
    } catch (error) {
      console.error('✗ Compilation failed:');
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('inspect <file>')
  .description('Inspect a compiled CORE module')
  .action((file: string) => {
    try {
      const source = fs.readFileSync(file, 'utf-8');
      const tokens = tokenize(source);
      const ast = parse(tokens);

      console.log('Module Information:');
      console.log('==================');
      console.log(`Name: ${ast.name}`);
      console.log(`Version: ${ast.metadata.version || 'not specified'}`);
      console.log(`\nElements (${ast.elements.length}):`);

      ast.elements.forEach((element, index) => {
        if (element.type === 'Function') {
          const fn = element as any;
          console.log(`\n${index + 1}. Function: ${fn.name}:${fn.version.version}`);
          console.log(`   Stability: ${fn.version.stability || 'unspecified'}`);
          console.log(`   Inputs: ${fn.signature.inputs.length}`);
          console.log(`   Outputs: ${fn.signature.outputs.length}`);
          console.log(`   Effects: ${fn.effects.length}`);
          console.log(`   Roles: ${fn.security.requiredRoles.join(', ') || 'none'}`);
        } else if (element.type === 'TypeDef') {
          const type = element as any;
          console.log(`\n${index + 1}. Type: ${type.name}:${type.version.version}`);
          console.log(`   Fields: ${type.fields.length}`);
        }
      });

      console.log('\n');
    } catch (error) {
      console.error('✗ Inspection failed:');
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
