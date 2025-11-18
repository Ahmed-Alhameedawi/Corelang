#!/usr/bin/env node

/**
 * CORE Language CLI Tool
 */

import * as fs from 'fs';
import * as path from 'path';
import { program } from 'commander';
import { tokenize } from '../compiler/lexer/lexer';
import { parse } from '../compiler/parser/parser';
import { CompilerContext } from '../compiler/context';
import { formatVersion } from '../compiler/versioning/semver';

program
  .name('core')
  .description('CORE Language Compiler CLI')
  .version('0.2.0');

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
  .option('-v, --versions', 'Show detailed version information')
  .option('-d, --diagnostics', 'Show compilation diagnostics')
  .action((file: string, options: { versions?: boolean; diagnostics?: boolean }) => {
    try {
      const source = fs.readFileSync(file, 'utf-8');
      const tokens = tokenize(source);
      const ast = parse(tokens);

      // Create compiler context and register module
      const context = new CompilerContext();
      context.registerModule(ast);

      console.log('Module Information:');
      console.log('==================');
      console.log(`Name: ${ast.name}`);
      console.log(`Version: ${ast.metadata.version || 'not specified'}`);

      // Show diagnostics if requested
      if (options.diagnostics) {
        const diagnostics = context.getDiagnostics();
        if (diagnostics.length > 0) {
          console.log(`\n⚠️  Diagnostics (${diagnostics.length}):`);
          diagnostics.forEach(d => {
            const severity = d.severity === 'error' ? '❌' : d.severity === 'warning' ? '⚠️ ' : 'ℹ️ ';
            console.log(`   ${severity} ${d.message}${d.code ? ` [${d.code}]` : ''}`);
            if (d.hint) {
              console.log(`      💡 ${d.hint}`);
            }
          });
        } else {
          console.log('\n✅ No diagnostics');
        }
      }

      console.log(`\nElements (${ast.elements.length}):`);

      ast.elements.forEach((element, index) => {
        if (element.type === 'Function') {
          const fn = element as any;
          console.log(`\n${index + 1}. Function: ${fn.name}:${fn.version?.version || 'unversioned'}`);
          console.log(`   Stability: ${fn.version?.stability || 'unspecified'}`);

          if (fn.version?.deprecated) {
            console.log(`   ⚠️  DEPRECATED`);
          }
          if (fn.version?.replaces && fn.version.replaces.length > 0) {
            console.log(`   Replaces: ${fn.version.replaces.join(', ')}`);
          }

          console.log(`   Inputs: ${fn.signature.inputs.length}`);
          console.log(`   Outputs: ${fn.signature.outputs.length}`);
          console.log(`   Effects: ${fn.effects.length}`);
          console.log(`   Roles: ${fn.security.requiredRoles.join(', ') || 'none'}`);
          console.log(`   Pure: ${fn.metadata.pure ? 'yes' : 'no'}`);
          console.log(`   Rollback-safe: ${fn.version?.rollbackSafe ? 'yes' : 'no'}`);

        } else if (element.type === 'TypeDef') {
          const type = element as any;
          console.log(`\n${index + 1}. Type: ${type.name}:${type.version?.version || 'unversioned'}`);
          console.log(`   Stability: ${type.version?.stability || 'unspecified'}`);
          console.log(`   Fields: ${type.fields.length}`);

          if (type.version?.replaces && type.version.replaces.length > 0) {
            console.log(`   Replaces: ${type.version.replaces.join(', ')}`);
          }
        }
      });

      // Show version statistics if requested
      if (options.versions) {
        const stats = context.getVersionStats();

        console.log('\n\nVersion Statistics:');
        console.log('==================');

        if (stats.functions.size > 0) {
          console.log('\nFunctions:');
          stats.functions.forEach((fnStats, name) => {
            console.log(`\n  ${name}:`);
            console.log(`    Total versions: ${fnStats.totalVersions}`);
            console.log(`    Stable: ${fnStats.stableVersions}`);
            console.log(`    Beta: ${fnStats.betaVersions}`);
            console.log(`    Alpha: ${fnStats.alphaVersions}`);
            console.log(`    Deprecated: ${fnStats.deprecatedVersions}`);

            if (fnStats.latestVersion) {
              console.log(`    Latest: ${formatVersion(fnStats.latestVersion)}`);
            }
            if (fnStats.latestStableVersion) {
              console.log(`    Latest stable: ${formatVersion(fnStats.latestStableVersion)}`);
            }

            // Show version chain
            const allVersions = context.versionRegistry.functions.getAllVersions(name);
            if (allVersions.length > 1) {
              console.log(`    Evolution chain:`);
              allVersions.forEach((v, i) => {
                const arrow = i < allVersions.length - 1 ? ' →' : '';
                const deprecated = v.stability === 'deprecated' ? ' (deprecated)' : '';
                console.log(`      ${formatVersion(v.version)}${deprecated}${arrow}`);
              });
            }
          });
        }

        if (stats.types.size > 0) {
          console.log('\nTypes:');
          stats.types.forEach((typeStats, name) => {
            console.log(`\n  ${name}:`);
            console.log(`    Total versions: ${typeStats.totalVersions}`);
            console.log(`    Stable: ${typeStats.stableVersions}`);

            if (typeStats.latestVersion) {
              console.log(`    Latest: ${formatVersion(typeStats.latestVersion)}`);
            }
          });
        }
      }

      console.log('\n');
    } catch (error) {
      console.error('✗ Inspection failed:');
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
