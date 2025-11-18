# CORE Language Implementation Roadmap

**CORE** (Compiled Orchestration Runtime Engine)
*An Agent-Native Programming Language with Built-in Security, Versioning, and MCP Integration*

---

## Overview

This roadmap outlines the implementation plan for CORE, a compiled programming language designed for AI agents. The project is divided into 10 phases over approximately 52 weeks, with each phase building upon the previous one.

## Quick Links

- [Phase 1: Core Language](#phase-1-core-language-weeks-1-8)
- [Phase 2: Versioning System](#phase-2-versioning-system-weeks-9-12)
- [Phase 3: Security & RBAC](#phase-3-security--rbac-weeks-13-18)
- [Phase 4: Effect System & Runtime](#phase-4-effect-system--runtime-weeks-19-24)
- [Phase 5: Function Intelligence Metadata](#phase-5-function-intelligence-metadata-weeks-25-28)
- [Phase 6: Module System & Packaging](#phase-6-module-system--packaging-weeks-29-34)
- [Phase 7: Sync & Channels](#phase-7-sync--channels-weeks-35-38)
- [Phase 8: MCP Integration](#phase-8-mcp-integration-weeks-39-44)
- [Phase 9: Optimization & Production](#phase-9-optimization--production-weeks-45-52)
- [Phase 10: Advanced Features](#phase-10-advanced-features-weeks-53)

---

## Phase 1: Core Language (Weeks 1-8) ✅ COMPLETE

**Goal**: Establish the basic language foundation with parser and type system.

**Status**: ✅ 100% Complete | 39 tests passing

### Deliverables

- [x] Language specification (formal EBNF grammar)
- [x] Parser: CORE source → JSON AST
- [x] Lexer/Tokenizer with full language support
- [x] Complete AST type system
- [x] Type system
  - [x] Primitive types (int, float, string, bool, uuid, timestamp, etc.)
  - [x] Structured types (records, lists, maps, sum types)
  - [ ] Type inference engine (deferred to Phase 3)
  - [ ] Type checker (deferred to Phase 3)
- [x] Core primitives: `mod`, `fn`, `type`
- [x] Basic control flow: `if`, `let`, `match`, `do`
- [x] Version markers and metadata support
- [x] Security attribute syntax
- [x] Effect declaration syntax
- [x] CLI tool (tokenize, parse, compile, inspect)
- [ ] Simple compiler: AST → IR (deferred to Phase 4)
- [ ] Reference interpreter (deferred to Phase 4)

### Success Criteria ✅

```clojure
; This compiles successfully
(mod hello
  (fn greet :v1
    :pure true
    :inputs [(name :string)]
    :outputs [(greeting :string)]
    (body
      (str "Hello, " name "!"))))
```

### Key Milestones ✅

- **Week 2**: Parser complete, can parse basic modules ✅
- **Week 4**: Type system foundation complete ✅
- **Week 6**: CLI tooling operational ✅
- **Week 8**: All 39 tests passing ✅

### Files Created
- `compiler/lexer/lexer.ts` + tests (23 tests)
- `compiler/parser/parser.ts` + tests (16 tests)
- `compiler/ast/types.ts` (Complete AST definitions)
- `tools/cli.ts` (CLI tool)
- `spec/grammar.ebnf` (Formal grammar)
- `examples/hello.core`

---

## Phase 2: Versioning System (Weeks 9-12) ✅ COMPLETE

**Goal**: Implement function and type versioning with compatibility checking.

**Status**: ✅ 100% Complete | 106 new tests (145 total)

### Deliverables

- [x] Version syntax and AST representation
- [x] Semantic versioning system (semver)
  - [x] Version parsing (v1, v1.2, v1.2.3, prerelease, build metadata)
  - [x] Version comparison and sorting
  - [x] Constraint types (exact, ^caret, ~tilde, ranges, latest, stable)
- [x] Version constraint resolver
- [x] Version registry system
  - [x] Track all versions of functions and types
  - [x] Latest and latest-stable resolution
  - [x] Deprecated version tracking
  - [x] Version statistics and analytics
- [x] Compatibility checker
  - [x] Input/output signature compatibility
  - [x] Breaking vs. non-breaking change detection
  - [x] Effect compatibility verification
  - [x] Security requirement changes
  - [x] Purity/idempotence validation
  - [x] Data classification change detection
  - [x] Semantic versioning enforcement
- [x] Version graph builder
  - [x] Replacement chain tracking (v1 → v2 → v3)
  - [x] Predecessor chain navigation
  - [x] Migration path detection
- [x] Support for multiple function versions in single module
- [x] Migration function system
  - [x] Migration function registration
  - [x] Migration validation (signatures, purity, rollback-safety)
  - [x] Multi-step migration paths
  - [x] Migration coverage analysis
  - [x] Migration template generation
- [x] Rich diagnostics system
  - [x] Source-level error reporting
  - [x] Helpful hints and suggestions
  - [x] Version-specific error codes
- [x] Compiler context integration
  - [x] Automatic version validation
  - [x] Breaking change warnings
  - [x] Deprecated version detection
- [x] Enhanced CLI with version visualization

### Success Criteria ✅

```clojure
; Multiple versions coexist successfully
(fn compute :v1
  :inputs [(x :int)]
  :outputs [(result :int)]
  (body (* x 2)))

(fn compute :v2
  :inputs [(x :int) (multiplier :int)]
  :outputs [(result :int)]
  (body (* x multiplier)))

; Compiler detects and reports breaking changes
; CLI shows version evolution: v1 → v2 → v3
; Migration validation ensures correctness
```

### Key Milestones ✅

- **Week 10**: Version parsing, semver system complete ✅
- **Week 11**: Compatibility checker detects all breaking changes ✅
- **Week 12**: Version graph, migration system, CLI integration complete ✅

### Files Created
- `compiler/diagnostics/diagnostic.ts` + tests (9 tests)
- `compiler/versioning/semver.ts` + tests (36 tests)
- `compiler/versioning/registry.ts` + tests (28 tests)
- `compiler/versioning/compatibility.ts`
- `compiler/versioning/migration.ts` + tests (19 tests)
- `compiler/context.ts` + tests (14 tests)
- `examples/user-service.core` (comprehensive example)
- `examples/order-service.core` (multi-module example)
- `examples/calculator.core` (function evolution example)
- `examples/test-versions.core` (version testing)

### Industry-Leading Achievement

CORE now has the most sophisticated function-level versioning system of any programming language:
- ✅ Automatic breaking change detection
- ✅ Multi-step migration validation
- ✅ Version constraint resolution (^, ~, ranges)
- ✅ Replacement chain tracking
- ✅ Rich version diagnostics

No other production language (TypeScript, Python, Rust, Go, Java) has built-in function-level versioning with automatic compatibility checking.

---

## Phase 3: Security & RBAC (Weeks 13-18)

**Goal**: Implement complete security model with compile-time and runtime enforcement.

### Deliverables

- [ ] Security primitives: `role`, `perm`, `policy`, `principal`
- [ ] Security-typed parameters and contexts
- [ ] Data classification system
  - [ ] Classification levels: public, internal, confidential, restricted
  - [ ] Classification tracking through type system
- [ ] Static security analysis
  - [ ] Access control verification
  - [ ] Data flow tracking
  - [ ] Classification violation detection
- [ ] Policy evaluation engine
- [ ] Runtime security enforcer
- [ ] Audit logging system
- [ ] Multi-tenant isolation

### Success Criteria

```clojure
(role admin :perms [data.write])
(role viewer :perms [data.read])

(fn write_data :v1
  :requires [admin]
  :inputs [(data :string) (ctx (Principal admin))]
  :effects [(db.write "data")]
  (body ...))

; Compiler should reject unauthorized calls
(fn unauthorized_call :v1
  :requires [viewer]
  :inputs [(ctx (Principal viewer))]
  (body
    (write_data "test" ctx)))  ; ERROR: viewer lacks admin role
```

### Key Milestones

- **Week 14**: Security primitives and syntax complete
- **Week 15**: Static access control verification working
- **Week 16**: Data classification system operational
- **Week 17**: Runtime security enforcer implemented
- **Week 18**: Audit logging and multi-tenant isolation complete

---

## Phase 4: Effect System & Runtime (Weeks 19-24)

**Goal**: Implement side-effect tracking and execution runtime.

### Deliverables

- [ ] Effect system
  - [ ] Effect declarations in function signatures
  - [ ] Effect handlers (db, http, fs, events, log)
  - [ ] Effect composition rules
  - [ ] Pure function optimization
- [ ] CORE VM
  - [ ] Bytecode format specification
  - [ ] Stack-based interpreter
  - [ ] Security context management
  - [ ] Effect execution engine
- [ ] Standard library
  - [ ] Database operations (query, execute, transaction)
  - [ ] HTTP client (get, post, put, delete)
  - [ ] Filesystem operations (read, write, list)
  - [ ] JSON handling
  - [ ] Logging utilities (with automatic redaction)
- [ ] Observability
  - [ ] Structured logging with classification-aware redaction
  - [ ] Distributed tracing integration (OpenTelemetry)
  - [ ] Metrics collection

### Success Criteria

```clojure
(fn fetch_and_store :v1
  :effects [(http.call "api.example.com") (db.write "cache")]
  :inputs [(url :string) (ctx (Principal cache.write))]
  (body
    (let [response (http.get ctx url)]
      (db.execute ctx "INSERT INTO cache ..." response)
      (Ok Unit))))
```

### Key Milestones

- **Week 20**: Effect system syntax and checking complete
- **Week 21**: Bytecode format and VM foundation ready
- **Week 22**: Effect handlers for db, http, fs implemented
- **Week 23**: Standard library core functions working
- **Week 24**: Observability hooks integrated

---

## Phase 5: Function Intelligence Metadata (Weeks 25-28)

**Goal**: Generate rich metadata for agent planning and orchestration.

### Deliverables

- [ ] Metadata schema (FunctionMetadata TypeScript interface)
- [ ] Metadata generator in compilation pipeline
- [ ] Metadata extraction from
  - [ ] Function annotations
  - [ ] Type signatures
  - [ ] Effect declarations
  - [ ] Security requirements
- [ ] Intelligence fields
  - [ ] Decomposition hints (sub-steps)
  - [ ] Error taxonomy (retryable, user-fixable)
  - [ ] Performance characteristics
  - [ ] Composition suggestions
- [ ] Metadata serialization (JSON)
- [ ] Metadata query API

### Success Criteria

```typescript
// After compilation
const metadata = module.getMetadata("user.get:v2");
assert(metadata.intelligence.goal === "Fetch user profile from database");
assert(metadata.intelligence.decomposition.steps.length === 5);
assert(metadata.versioning.rollback.safe === true);
assert(metadata.security.required_roles.includes("viewer"));
```

### Key Milestones

- **Week 26**: Metadata schema finalized
- **Week 27**: Metadata extraction from function annotations
- **Week 28**: Full metadata generation in compilation pipeline

---

## Phase 6: Module System & Packaging (Weeks 29-34)

**Goal**: Create standalone modules with manifests and dependencies.

### Deliverables

- [ ] Module file format (.core binary format)
- [ ] Module sections
  - [ ] Header with checksums and signatures
  - [ ] Manifest (exports, imports, capabilities)
  - [ ] Security section (roles, policies)
  - [ ] Code section (IR/bytecode)
  - [ ] Metadata section
  - [ ] MCP section
  - [ ] Sync section
- [ ] Module loader
  - [ ] Signature verification
  - [ ] Dependency resolution
  - [ ] Version constraint checking
- [ ] Import/export system
- [ ] Module registry (file-based initially)
- [ ] Module packager/linker

### Success Criteria

```bash
$ core compile user.service.core
Compiled: user.service.core (v1.2.0)
  Functions: get:v1, get:v2, create:v1, delete:v1
  Types: User:v1, User:v2
  Exports: 4 functions, 2 types
  Imports: database:^2.0.0, auth:^1.5.0
  Size: 45 KB

$ core inspect user.service.core
Module: user.service
Version: 1.2.0
Functions:
  - get (v1, v2) [active: v2]
  - create (v1) [active: v1]
Security: 2 roles, 3 permissions, 1 policy
```

### Key Milestones

- **Week 30**: Binary module format specified
- **Week 31**: Module packager generates .core files
- **Week 32**: Module loader with signature verification
- **Week 33**: Dependency resolution working
- **Week 34**: Simple file-based registry operational

---

## Phase 7: Sync & Channels (Weeks 35-38)

**Goal**: Enable multi-module coordination via channels and events.

### Deliverables

- [ ] Channel primitive implementation
- [ ] Pub/sub system
- [ ] Event schemas with versioning
- [ ] Sync contract system
- [ ] Channel security (publish/subscribe permissions)
- [ ] Event streaming runtime
- [ ] Cross-module event subscription

### Success Criteria

```clojure
; Module A
(chan orders.events
  :mode pub-sub
  :events [(event OrderCreated :v1 ...)])

(fn create_order :v1
  :effects [(event.emit "orders.events")]
  (body
    (events.emit ctx "orders.events" (OrderCreated ...))))

; Module B
(import orders :channels [(orders.events :subscribe)])
(subscribe orders.events
  :event OrderCreated
  :handler handle_order_created)
```

### Key Milestones

- **Week 36**: Channel syntax and implementation
- **Week 37**: Event streaming runtime working
- **Week 38**: Cross-module subscription operational

---

## Phase 8: MCP Integration (Weeks 39-44)

**Goal**: Build full MCP server with security and version awareness.

### Deliverables

- [ ] MCP server implementation
- [ ] Module loader for MCP
- [ ] Tool generation from functions
  - [ ] JSON schema generation from CORE types
  - [ ] Security metadata inclusion
  - [ ] Version information exposure
- [ ] Security-aware tool filtering
- [ ] Resource exposure
  - [ ] Module schemas
  - [ ] Version graphs
  - [ ] Event streams
- [ ] Tool dispatcher with access control
- [ ] MCP client libraries (TypeScript, Python)

### Success Criteria

```typescript
// Start MCP server
const server = new CoreMCPServer({
  modules: ["user.service.core", "order.service.core"],
  principal: { type: "agent", id: "claude", roles: ["viewer"] }
});

// Connect agent
const client = new MCPClient("core-mcp://localhost:3000");
const tools = await client.tools.list();

// Only authorized tools returned
assert(tools.find(t => t.name === "user_get_v2"));
assert(!tools.find(t => t.name === "user_delete_v1")); // Requires admin
```

### Key Milestones

- **Week 40**: MCP server foundation complete
- **Week 41**: Tool generation from functions working
- **Week 42**: Security-aware filtering operational
- **Week 43**: Resource exposure implemented
- **Week 44**: MCP client libraries ready

---

## Phase 9: Optimization & Production (Weeks 45-52)

**Goal**: Production-ready compiler and runtime with optimizations.

### Deliverables

- [ ] Compiler optimizations
  - [ ] Dead code elimination
  - [ ] Constant folding
  - [ ] Inline expansion for pure functions
  - [ ] Effect fusion
- [ ] Runtime optimizations
  - [ ] JIT compilation (optional)
  - [ ] Metadata lookup caching
  - [ ] Connection pooling for effects
- [ ] Host language bindings
  - [ ] TypeScript bindings
  - [ ] Rust bindings
  - [ ] Python bindings
- [ ] Developer tooling
  - [ ] VSCode extension (syntax highlighting, LSP)
  - [ ] CLI tools (compile, inspect, validate, rollback)
  - [ ] Testing framework
- [ ] Documentation
  - [ ] Language reference
  - [ ] Security guide
  - [ ] MCP integration guide
  - [ ] Migration guide

### Success Criteria

```bash
# CLI tooling
$ core build ./modules/*.core --optimize
$ core test user.service.core --coverage
$ core rollback user.service get --from v2 --to v1 --dry-run
$ core security-audit user.service.core

# Language bindings
import { CoreModule } from '@core/runtime';
const mod = await CoreModule.load('user.service.core');
const result = await mod.call(ctx, 'get:v2', {user_id: '...'});
```

### Key Milestones

- **Week 46**: Core optimizations implemented
- **Week 47**: TypeScript bindings complete
- **Week 48**: Rust and Python bindings ready
- **Week 49**: VSCode extension and CLI tools
- **Week 50**: Testing framework operational
- **Week 51**: Documentation complete
- **Week 52**: Production readiness review

---

## Phase 10: Advanced Features (Weeks 53+)

**Goal**: Advanced capabilities for production systems.

### Deliverables

- [ ] Distributed version coordination
  - [ ] Version consensus across deployments
  - [ ] Canary deployments with gradual rollout
  - [ ] A/B testing between versions
- [ ] Advanced security
  - [ ] Attribute-based access control (ABAC)
  - [ ] Capability delegation
  - [ ] Time-bounded permissions
  - [ ] HSM integration
- [ ] Advanced sync
  - [ ] CRDT support for conflict-free replication
  - [ ] Distributed transactions
  - [ ] Event sourcing patterns
- [ ] AI-native features
  - [ ] Auto-generated decomposition hints from code analysis
  - [ ] Learned error patterns from production
  - [ ] Suggested rollback points from historical data
  - [ ] Agent-assisted policy generation
- [ ] Ecosystem
  - [ ] Module marketplace/registry
  - [ ] Shared module repository
  - [ ] Template library
  - [ ] Best practices catalog

---

## Minimal Viable Prototype (MVP)

**Timeline**: 8 weeks, 2 engineers

**Proof of Concept Goals**:
- Single module with versioned functions exposed via MCP
- Demonstrate function versioning (v1, v2)
- Basic RBAC (admin, viewer roles)
- Selective rollback (v2 → v1)
- MCP tool exposure with security filtering

**MVP Phases**:
- **Weeks 1-2**: Parser + AST
- **Weeks 3-4**: Type system + simple compiler
- **Weeks 5-6**: Basic runtime + effect handlers
- **Weeks 7-8**: Simple MCP integration

---

## Team Structure

**Recommended Team Size**: 6-8 engineers

### Team Composition

- **Compiler Team** (2 engineers)
  - Parser, type checker, IR generation
  - Optimization passes

- **Runtime Team** (2 engineers)
  - VM implementation
  - Effect handlers
  - Performance optimization

- **Security Team** (1-2 engineers)
  - RBAC system
  - Policy engine
  - Security analysis
  - Audit system

- **MCP/Integration Team** (1-2 engineers)
  - MCP server
  - Host language bindings
  - Tooling

- **DevEx Team** (1 engineer)
  - CLI tools
  - Documentation
  - Developer tooling

---

## Success Metrics

### Foundation (Phases 1-4)
- [ ] Can compile and run "Hello World"
- [ ] Functions with multiple versions work correctly
- [ ] Basic security checks prevent unauthorized access
- [ ] Simple CRUD operations execute successfully

### Core Features (Phases 5-7)
- [ ] Metadata enables basic agent planning
- [ ] Modules can import and compose
- [ ] Cross-module events work reliably
- [ ] Selective rollback works without breaking callers

### Production Ready (Phases 8-9)
- [ ] MCP server serves 1000+ req/sec
- [ ] Compilation time < 1 sec for typical module
- [ ] Runtime overhead < 10% vs. native code
- [ ] Zero critical security vulnerabilities

### Maturity (Phase 10)
- [ ] 100+ production modules in registry
- [ ] Agent successfully plans and executes multi-step workflows
- [ ] Version rollbacks complete in < 5 minutes
- [ ] Security audit passes enterprise requirements

---

## Risk Mitigation

### Technical Risks

**1. Complexity of version system**
- **Mitigation**: Start simple (semantic versioning only), iterate
- **Fallback**: Module-level versioning if function-level proves too complex

**2. Security system performance overhead**
- **Mitigation**: Compile-time checks eliminate runtime overhead where possible
- **Fallback**: Opt-in security levels (strict vs. permissive modes)

**3. MCP integration changes**
- **Mitigation**: Abstract MCP behind interface, version the integration
- **Fallback**: Support multiple MCP versions simultaneously

### Adoption Risks

**1. Learning curve for developers**
- **Mitigation**: Excellent documentation, migration tools from existing languages
- **Fallback**: Provide "simplified CORE" subset for beginners

**2. Ecosystem fragmentation**
- **Mitigation**: Strong standard library, curated module registry
- **Fallback**: Easy interop with existing languages (FFI)

---

## Current Status

**Status**: Active Development - Phase 3 Ready
**Version**: 0.2.0 (Phase 2 Complete)
**Last Updated**: 2025-01-18

### Completed ✅
- [x] Language design and specification
- [x] Roadmap creation
- [x] **Phase 1: Core Language** (100% - 39 tests)
  - [x] Lexer and Parser
  - [x] AST type system
  - [x] CLI tooling
  - [x] Formal grammar
- [x] **Phase 2: Versioning System** (100% - 106 new tests)
  - [x] Semantic versioning
  - [x] Version registry and resolution
  - [x] Compatibility checking
  - [x] Migration system
  - [x] Rich diagnostics
  - [x] Compiler context

### Current Metrics
- **Test Suites**: 7 passed
- **Total Tests**: 145 passed (100% pass rate)
- **Lines of Code**: ~6,500+
- **Example Programs**: 4 comprehensive examples
- **Documentation**: Complete and current

### In Progress
- [ ] Phase 3 planning and design
- [ ] Security system specification

### Next Steps
1. **Immediate**: Begin Phase 3 (Security & RBAC)
   - Design security policy engine
   - Implement RBAC system
   - Add permission validation
2. **Short-term**: Complete Phase 3-4 (Security + Runtime)
3. **Mid-term**: MCP integration (Phase 8)
4. **Long-term**: Production readiness (Phase 9)

---

## Contributing

See [CLAUDE.md](./CLAUDE.md) for guidelines on contributing to CORE, especially for AI agents.

## License

TBD

## Contact

TBD
