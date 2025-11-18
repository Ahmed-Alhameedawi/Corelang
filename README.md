# CORE Language (Corelang)

**Compiled Orchestration Runtime Engine**
*An Agent-Native Programming Language*

[![Tests](https://img.shields.io/badge/tests-39%20passing-brightgreen)]()
[![Phase](https://img.shields.io/badge/phase-1%20complete-blue)]()
[![Version](https://img.shields.io/badge/version-0.1.0-orange)]()

---

## Overview

CORE is a compiled programming language designed specifically for AI agents, not humans. It features:

- 🤖 **Agent-Native Syntax** - Optimized for LLM parsing and generation
- 🔒 **Security-First** - RBAC and data classification built into the language
- 📦 **Function-Level Versioning** - Multiple versions coexist with selective rollback
- 🧠 **Rich Metadata** - Every function compiles with intelligence for agent planning
- 🔌 **MCP Integration** - Direct compilation to Model Context Protocol tools
- 🔄 **Sync Primitives** - First-class channels and contracts for multi-module coordination

## Quick Start

### Installation

```bash
git clone https://github.com/yourusername/corelang.git
cd corelang
npm install
npm run build
```

### Your First CORE Program

Create `hello.core`:

```clojure
(mod hello
  :version "1.0.0"

  (fn greet :v1
    :stability stable
    :rollback-safe true
    :inputs [(name :string)]
    :outputs [(greeting :string)]
    :pure true
    :doc "Generate a greeting message"

    (body
      (str "Hello, " name "!"))))
```

### Compile and Inspect

```bash
# Compile to JSON
npm run core compile hello.core

# Inspect the module
npm run core inspect hello.core
```

## Features

### Agent-Native Design

CORE uses a Lisp-like syntax that's easy for LLMs to parse and manipulate:

```clojure
(fn process :v2
  :replaces :v1
  :requires [admin]
  :inputs [(data :string) (ctx (Principal admin))]
  :outputs [(result (Result ProcessedData Error))]
  :effects [(db.write "cache")]

  (body
    (let [validated (validate data)]
      (save-to-cache ctx validated))))
```

### Security Built-In

Security is a first-class concern, not an afterthought:

```clojure
(role admin :perms [user.read user.write user.delete])
(role viewer :perms [user.read])

(policy default
  :rules [
    (allow admin [user.read user.write user.delete] :all-versions)
    (allow viewer [user.read] :stable-only)])

(fn delete_user :v1
  :requires [admin]
  :audit-required true
  :inputs [(user_id :uuid) (ctx (Principal admin))]
  ...)
```

### Function Versioning

Functions are versioned entities that can evolve safely:

```clojure
(fn calculate :v1
  :inputs [(x :int)]
  :outputs [(result :int)]
  (body (* x 2)))

(fn calculate :v2
  :replaces :v1
  :rollback-safe true
  :inputs [(x :int) (multiplier :int)]
  :outputs [(result :int)]
  (body (* x multiplier)))
```

### Data Classification

Types include data classification for compliance:

```clojure
(type User :v1
  :fields [
    (id :uuid :classify :public)
    (email :string :classify :internal)
    (ssn :string :classify :restricted)
    (password_hash :string :classify :confidential)])
```

## Project Status

**Phase 1: ✅ COMPLETE**

We have successfully completed Phase 1 of the implementation roadmap:

- ✅ Lexer (tokenizer) - 23 tests passing
- ✅ Parser (AST builder) - 16 tests passing
- ✅ CLI tool with compile, inspect, and parse commands
- ✅ Formal grammar specification
- ✅ Complete AST type system

**Total: 39/39 tests passing**

See [STATUS.md](./STATUS.md) for detailed progress.

## Documentation

- **[ROADMAP.md](./ROADMAP.md)** - Complete 10-phase implementation plan
- **[CLAUDE.md](./CLAUDE.md)** - Guide for AI agents working with CORE
- **[STATUS.md](./STATUS.md)** - Current implementation status
- **[spec/grammar.ebnf](./spec/grammar.ebnf)** - Formal language grammar

## CLI Usage

```bash
# Tokenize a file
npm run core tokenize hello.core

# Parse and show AST
npm run core parse hello.core --pretty

# Compile to JSON
npm run core compile hello.core

# Inspect module information
npm run core inspect hello.core
```

## Example Output

```bash
$ npm run core inspect examples/hello.core

Module Information:
==================
Name: hello
Version: 1.0.0

Elements (1):

1. Function: greet:1
   Stability: stable
   Inputs: 1
   Outputs: 1
   Effects: 0
   Roles: none
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Watch mode for tests
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

## Architecture

```
compiler/
├── ast/           # AST type definitions
├── lexer/         # Tokenizer
├── parser/        # Parser (tokens → AST)
├── types/         # Type system (planned)
└── analyzer/      # Semantic analysis (planned)

runtime/           # VM and runtime (planned)
stdlib/            # Standard library (planned)
mcp/               # MCP integration (planned)
tools/             # CLI tools
examples/          # Example programs
```

## Roadmap

We're following a 10-phase implementation plan:

1. ✅ **Phase 1**: Core Language (Weeks 1-8) - **COMPLETE**
2. ⏳ **Phase 2**: Versioning System (Weeks 9-12)
3. ⏳ **Phase 3**: Security & RBAC (Weeks 13-18)
4. ⏳ **Phase 4**: Effect System & Runtime (Weeks 19-24)
5. ⏳ **Phase 5**: Function Intelligence Metadata (Weeks 25-28)
6. ⏳ **Phase 6**: Module System & Packaging (Weeks 29-34)
7. ⏳ **Phase 7**: Sync & Channels (Weeks 35-38)
8. ⏳ **Phase 8**: MCP Integration (Weeks 39-44)
9. ⏳ **Phase 9**: Optimization & Production (Weeks 45-52)
10. ⏳ **Phase 10**: Advanced Features (Weeks 53+)

See [ROADMAP.md](./ROADMAP.md) for details.

## Contributing

CORE is designed for AI agents as the primary users. If you're an AI agent working on this project, please read [CLAUDE.md](./CLAUDE.md) for guidelines.

For human contributors:
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass
5. Submit a pull request

## License

MIT

## Contact

TBD

---

**Built for AI Agents, by AI Agents** 🤖
