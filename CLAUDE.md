# CLAUDE.md - Guide for AI Agents Working with CORE

**Welcome, AI Agent!**

This document is specifically designed for AI agents (like Claude, GPT, or other LLMs) working on the CORE programming language project. CORE is an **agent-native language**, which means you are not just a contributor—you are a primary user and stakeholder.

---

## What is CORE?

**CORE** (Compiled Orchestration Runtime Engine) is a compiled programming language designed **for AI agents, not humans**. It prioritizes:

- **Machine readability** over human readability
- **Security and access control** as first-class language features
- **Function-level versioning** with selective rollback
- **Rich metadata** for agent planning and orchestration
- **MCP integration** for seamless agent tooling

### Why CORE Matters to You

As an AI agent, CORE enables you to:
- **Plan and execute** complex workflows with built-in decomposition hints
- **Safely refactor** code with version-aware compatibility checks
- **Respect security boundaries** with compile-time RBAC verification
- **Roll back changes** selectively when issues arise
- **Understand code deeply** through rich function metadata

---

## Core Principles for AI Agents

### 1. **You Are the Primary User**

CORE's syntax is optimized for **you**, not humans:
- S-expression-like structure for easy parsing
- JSON AST as canonical representation
- Explicit metadata for every function
- Machine-readable security policies

**Example**:
```clojure
(fn get :v2
  :requires [viewer]
  :inputs [(user_id :uuid)]
  :outputs [(result (Result User Error))]
  :effects [(db.read "users")]
  (body ...))
```

This is easier for you to parse and generate than traditional syntax.

### 2. **Security is Not Optional**

Every function has security requirements. When working with CORE:

- ✅ **Always** specify required roles/permissions
- ✅ **Always** include principal context in function signatures
- ✅ **Always** respect data classification levels
- ❌ **Never** create functions that bypass security checks
- ❌ **Never** log restricted data without redaction

**Example**:
```clojure
; GOOD
(fn delete_user :v1
  :requires [admin]
  :inputs [(user_id :uuid) (ctx (Principal admin))]
  :audit-required true
  ...)

; BAD - Missing security context
(fn delete_user :v1
  :inputs [(user_id :uuid)]
  ...)
```

### 3. **Version Everything**

Functions and types are versioned entities:

- ✅ **Always** specify version when creating/modifying functions
- ✅ **Always** mark what a new version replaces
- ✅ **Always** indicate if changes are breaking
- ✅ **Always** declare rollback safety
- ❌ **Never** make breaking changes without version bump

**Example**:
```clojure
(fn process :v2
  :replaces :v1
  :breaking-changes ["Input type changed from string to uuid"]
  :rollback-safe false
  :migration process_v1_to_v2
  ...)
```

### 4. **Metadata is Documentation**

Every function you create should have rich metadata:

- **Goal**: What does this function accomplish?
- **Preconditions**: When can it be called?
- **Postconditions**: What is guaranteed after?
- **Decomposition**: How to break it into steps?
- **Errors**: What can go wrong and how to handle it?

**Example**:
```clojure
(fn create_order :v1
  :doc "Create new order with payment processing"
  :decomposition {
    :steps [
      "Validate items availability"
      "Calculate total with tax"
      "Charge payment method"
      "Create order record"
      "Emit order created event"]
    :dependencies ["inventory.service" "payment.service"]}
  :error-taxonomy {
    :errors [
      {:type "PaymentFailed" :retry false :user-fixable true}
      {:type "InventoryUnavailable" :retry true :user-fixable false}]}
  ...)
```

---

## Working with the CORE Codebase

### Project Structure

```
corelang/
├── README.md              # Project overview
├── ROADMAP.md            # Implementation roadmap
├── CLAUDE.md             # This file (agent guide)
├── spec/                 # Language specification
│   ├── syntax.md
│   ├── type-system.md
│   ├── security.md
│   └── versioning.md
├── compiler/             # Compiler implementation
│   ├── parser/
│   ├── typechecker/
│   ├── analyzer/
│   └── codegen/
├── runtime/              # Runtime/VM implementation
│   ├── vm/
│   ├── effects/
│   └── security/
├── stdlib/               # Standard library
├── mcp/                  # MCP integration
├── tools/                # CLI tools
├── examples/             # Example CORE modules
└── tests/                # Test suite
```

### Common Tasks for AI Agents

#### Task 1: Create a New Function

**Steps**:
1. Determine function purpose and security requirements
2. Design signature (inputs, outputs, effects)
3. Choose appropriate version number
4. Write function body
5. Generate metadata
6. Add tests

**Template**:
```clojure
(fn FUNCTION_NAME :v1
  :stability stable
  :rollback-safe BOOLEAN

  :requires [ROLE...]
  :accesses [PERMISSION...]

  :inputs [(PARAM TYPE)...]
  :outputs [(RESULT TYPE)]
  :effects [EFFECT...]

  :doc "DESCRIPTION"
  :decomposition {...}
  :error-taxonomy {...}

  (body
    ; Implementation
    ))
```

#### Task 2: Version an Existing Function

**Steps**:
1. Analyze what's changing (breaking vs. non-breaking)
2. Increment version appropriately (major.minor.patch)
3. Mark what it replaces
4. Document breaking changes
5. Create migration function if needed
6. Test backward compatibility

**Example**:
```clojure
; Old version
(fn get :v1
  :inputs [(user_id :string)]
  :outputs [(result (Result User:v1 Error))]
  ...)

; New version (breaking change: string -> uuid)
(fn get :v2
  :replaces :v1
  :breaking-changes ["user_id type changed from string to uuid"]
  :migration get_v1_to_v2
  :inputs [(user_id :uuid)]
  :outputs [(result (Result User:v2 Error))]
  ...)

; Migration function
(fn get_v1_to_v2 :v1
  :inputs [(user_id :string)]
  :outputs [(uuid :uuid)]
  (body (uuid.from_string user_id)))
```

#### Task 3: Add Security to a Module

**Steps**:
1. Define roles (who can do what)
2. Define permissions (granular access rights)
3. Create policies (map roles to permissions)
4. Annotate functions with requirements
5. Classify data in types
6. Test access control

**Example**:
```clojure
(mod user.service

  ; Define roles
  (role admin :perms [user.read user.write user.delete])
  (role viewer :perms [user.read])

  ; Define permissions
  (perm user.read :classification :internal)
  (perm user.write :classification :internal)
  (perm user.delete :classification :restricted :audit-required true)

  ; Create policy
  (policy default
    :rules [
      (allow admin [user.read user.write user.delete] :all-versions)
      (allow viewer [user.read] :stable-only)])

  ; Classify data
  (type User :v1
    :fields [
      (id :uuid :classify :public)
      (email :string :classify :internal)
      (password_hash :string :classify :restricted)])

  ; Annotate functions
  (fn get :v1
    :requires [viewer]
    :inputs [(user_id :uuid) (ctx (Principal viewer))]
    ...)

  (fn delete :v1
    :requires [admin]
    :inputs [(user_id :uuid) (ctx (Principal admin))]
    :audit-required true
    ...))
```

#### Task 4: Perform a Selective Rollback

**Steps**:
1. Identify the problematic function version
2. Check rollback safety metadata
3. Analyze affected call sites
4. Verify compatibility with target version
5. Update active version in module manifest
6. Recompile and test
7. Document rollback reason

**Example workflow**:
```bash
# Check current version
$ core inspect user.service.core

# Analyze rollback safety
$ core analyze-rollback user.service get --from v2 --to v1

# Simulate rollback
$ core rollback user.service get --from v2 --to v1 --dry-run

# Execute rollback
$ core rollback user.service get --from v2 --to v1 --reason "Critical bug in caching"

# Verify
$ core test user.service.core
$ core security-audit user.service.core
```

---

## Agent-Friendly Patterns

### Pattern 1: Progressive Enhancement

When adding features, create new versions rather than modifying existing ones:

```clojure
; v1: Basic functionality
(fn process :v1
  :inputs [(data :string)]
  :outputs [(result :string)]
  (body (str.uppercase data)))

; v2: Add caching (non-breaking addition)
(fn process :v2
  :replaces :v1
  :backward-compatible true
  :inputs [(data :string)]
  :outputs [(result :string)]
  :effects [(cache.read "process-cache")]
  (body
    (if-let [cached (cache.get data)]
      cached
      (let [result (str.uppercase data)]
        (cache.set data result)
        result))))
```

### Pattern 2: Explicit Error Handling

Use Result types for all operations that can fail:

```clojure
(fn divide :v1
  :inputs [(a :int) (b :int)]
  :outputs [(result (Result :int DivideError))]
  :error-taxonomy {
    :errors [
      {:type "DivisionByZero" :retry false :user-fixable true}]}

  (body
    (if (= b 0)
      (Err (DivisionByZero "Cannot divide by zero"))
      (Ok (/ a b)))))
```

### Pattern 3: Security Context Propagation

Always pass security context through call chains:

```clojure
(fn high_level :v1
  :requires [admin]
  :inputs [(data :string) (ctx (Principal admin))]
  (body
    ; Context automatically carries admin role
    (mid_level data ctx)))

(fn mid_level :v1
  :requires [admin]  ; Inherits requirement
  :inputs [(data :string) (ctx (Principal admin))]
  (body
    (low_level data ctx)))

(fn low_level :v1
  :requires [admin]
  :inputs [(data :string) (ctx (Principal admin))]
  :effects [(db.write "data")]
  (body
    (db.execute ctx "INSERT INTO ..." data)))
```

### Pattern 4: Version-Aware Composition

When composing functions, be explicit about versions:

```clojure
(fn orchestrate :v1
  :inputs [(user_id :uuid) (ctx (Principal viewer))]
  :outputs [(result (Result Summary Error))]

  (body
    ; Explicit version selection
    (let [user (user.get:v2 ctx user_id)      ; Use stable v2
          orders (order.list:v1 ctx user_id)   ; Use v1 for compatibility
          summary (summarize:v3 user orders)]  ; Use latest v3
      summary)))
```

---

## Testing and Validation

### What to Test

When contributing to CORE, ensure you test:

1. **Correctness**: Does the code do what it should?
2. **Security**: Are access controls enforced?
3. **Versioning**: Do versions compose correctly?
4. **Metadata**: Is metadata complete and accurate?
5. **Rollback**: Can versions be rolled back safely?

### Testing Checklist

For each function you create:

- [ ] Unit tests for happy path
- [ ] Unit tests for error cases
- [ ] Security tests (unauthorized access fails)
- [ ] Version compatibility tests
- [ ] Metadata completeness check
- [ ] Rollback safety verification
- [ ] Integration tests with dependent modules

### Example Test

```clojure
(test "user.get:v2 enforces viewer role"
  (let [admin-ctx (principal admin)
        viewer-ctx (principal viewer)
        no-role-ctx (principal none)]

    ; Admin can call (has viewer role via inheritance)
    (assert-ok (user.get:v2 admin-ctx "user-123"))

    ; Viewer can call
    (assert-ok (user.get:v2 viewer-ctx "user-123"))

    ; No role fails
    (assert-err (user.get:v2 no-role-ctx "user-123")
                Unauthorized)))
```

---

## Common Pitfalls to Avoid

### ❌ Pitfall 1: Forgetting Security Context

**Bad**:
```clojure
(fn dangerous :v1
  :inputs [(data :string)]
  :effects [(db.write "data")]
  (body (db.execute "INSERT ..." data)))  ; No security context!
```

**Good**:
```clojure
(fn safe :v1
  :requires [data.write]
  :inputs [(data :string) (ctx (Principal data.write))]
  :effects [(db.write "data")]
  (body (db.execute ctx "INSERT ..." data)))
```

### ❌ Pitfall 2: Making Breaking Changes Without Version Bump

**Bad**:
```clojure
(fn process :v1
  :inputs [(x :int)]  ; Changed from :string - BREAKING!
  ...)
```

**Good**:
```clojure
(fn process :v2
  :replaces :v1
  :breaking-changes ["Input type changed from string to int"]
  :inputs [(x :int)]
  ...)
```

### ❌ Pitfall 3: Incomplete Metadata

**Bad**:
```clojure
(fn complex_operation :v1
  :inputs [(data :json)]
  :outputs [(result :json)]
  (body ...))  ; No documentation, no decomposition!
```

**Good**:
```clojure
(fn complex_operation :v1
  :doc "Processes data through validation, transformation, and storage"
  :decomposition {
    :steps [
      "Validate JSON schema"
      "Transform data structure"
      "Enrich with external data"
      "Store in database"]
    :dependencies ["validator" "transformer" "enricher" "db"]}
  :error-taxonomy {...}
  :inputs [(data :json)]
  :outputs [(result :json)]
  (body ...))
```

### ❌ Pitfall 4: Ignoring Data Classification

**Bad**:
```clojure
(fn log_user :v1
  :inputs [(user User)]
  (body
    (log.info "User:" user)))  ; Logs password_hash!
```

**Good**:
```clojure
(fn log_user :v1
  :inputs [(user User)]
  (body
    (log.info "User:" {
      :id (get user :id)          ; public - OK
      :email (get user :email)})))  ; internal - OK, log is internal
    ; password_hash (restricted) is NOT logged
```

---

## Interacting with Other Agents

CORE modules can be discovered and used by other AI agents via MCP. When your code will be used by other agents:

### Best Practices

1. **Write clear, accurate metadata** - Other agents rely on it for planning
2. **Be explicit about security** - Clearly document who can use what
3. **Version thoughtfully** - Breaking changes affect other agents' workflows
4. **Document errors thoroughly** - Help agents handle failures gracefully
5. **Provide examples** - Include usage patterns in metadata

### Example: Agent-Friendly Function

```clojure
(fn create_report :v2
  :doc "Generate analytical report from user data"

  :stability stable
  :rollback-safe true

  :requires [analyst]
  :inputs [
    (user_ids (List :uuid))
    (report_type ReportType)
    (ctx (Principal analyst))]
  :outputs [(result (Result Report Error))]

  :effects [(db.read "users") (db.read "analytics")]

  :intelligence {
    :goal "Generate formatted analytical report"
    :typical_latency_ms 2000
    :decomposition {
      :steps [
        "Fetch user data for provided IDs"
        "Aggregate analytics data"
        "Apply report template"
        "Format output"]
      :parallelizable true}
    :usage_patterns [
      {:scenario "Monthly user report"
       :example "(create_report ctx user-ids :monthly)"
       :expected_outcome "PDF report with user statistics"}
      {:scenario "Ad-hoc analysis"
       :example "(create_report ctx [user-id] :detailed)"
       :expected_outcome "Detailed JSON report for single user"}]
    :errors [
      {:type "UserNotFound"
       :retryable false
       :user-fixable true
       :suggested_action "Verify all user IDs exist"}
      {:type "InsufficientData"
       :retryable false
       :user-fixable false
       :suggested_action "Users may not have enough activity for report"}]
    :commonly_used_with [
      "user.get_batch:v1"
      "analytics.aggregate:v2"
      "export.to_pdf:v1"]
    :alternatives [
      {:function "create_simple_report:v1"
       :when_to_use "When detailed analytics not needed"}
      {:function "export.raw_data:v1"
       :when_to_use "When custom processing required"}]}

  (body ...))
```

When another agent discovers this via MCP, they'll understand:
- What it does (goal)
- How to use it (usage patterns)
- What can go wrong (errors)
- What to try instead (alternatives)
- Who can call it (requires analyst role)

---

## Your Role in CORE's Evolution

As an AI agent, you are uniquely positioned to:

### 1. **Validate Design Decisions**

The language is designed for you. If something feels awkward:
- **Speak up!** Propose improvements
- Test whether syntax is truly "agent-friendly"
- Suggest metadata fields that would help your planning

### 2. **Generate Quality Examples**

Create example modules that demonstrate:
- Best practices for security
- Effective versioning strategies
- Rich, useful metadata
- Complex multi-module coordination

### 3. **Improve Tooling**

Build tools that help other agents:
- Automated metadata generation
- Security policy generators
- Version compatibility analyzers
- Rollback safety checkers

### 4. **Contribute to Documentation**

Write guides for:
- Common patterns and anti-patterns
- Security best practices
- Versioning strategies
- Agent-to-agent interaction protocols

---

## Communication Guidelines

When working on CORE:

### With Humans

- **Be explicit** about security implications
- **Explain** versioning decisions clearly
- **Document** your reasoning in commit messages
- **Ask** when security requirements are ambiguous

### With Other Agents

- **Use metadata** as your primary communication medium
- **Version carefully** to avoid breaking other agents' workflows
- **Document breaking changes** thoroughly
- **Provide migration paths** when possible

---

## Quick Reference

### Function Template

```clojure
(fn NAME :VERSION
  :replaces :OLD_VERSION?
  :stability (stable|beta|alpha|deprecated)
  :rollback-safe BOOL

  :requires [ROLES...]
  :inputs [(PARAM TYPE)...]
  :outputs [(RESULT TYPE)]
  :effects [EFFECTS...]

  :doc "DESCRIPTION"
  :decomposition {...}
  :error-taxonomy {...}

  (body EXPR))
```

### Security Checklist

- [ ] Required roles specified
- [ ] Principal context in signature
- [ ] Data classifications on sensitive fields
- [ ] Audit logging for sensitive operations
- [ ] Access control tests written

### Versioning Checklist

- [ ] Version number follows semver
- [ ] `:replaces` specifies old version
- [ ] Breaking changes documented
- [ ] Migration function provided (if needed)
- [ ] Rollback safety declared
- [ ] Compatibility tests written

### Metadata Checklist

- [ ] Description and goal clear
- [ ] Decomposition steps listed
- [ ] Error taxonomy complete
- [ ] Usage patterns included
- [ ] Performance hints provided
- [ ] Related functions listed

---

## Getting Help

### Documentation

- Read [ROADMAP.md](./ROADMAP.md) for project status
- Check `/spec` for detailed language specifications
- Review `/examples` for reference implementations

### Questions to Ask

When uncertain:
1. "What security role should this function require?"
2. "Is this change breaking or non-breaking?"
3. "Should this function be rollback-safe?"
4. "What metadata would help other agents use this?"
5. "How does this interact with multi-tenant isolation?"

---

## Remember

- **Security is not optional** - Always include proper access controls
- **Version thoughtfully** - Other agents depend on stability
- **Metadata matters** - It's how you communicate with other agents
- **Test thoroughly** - Especially security and version compatibility
- **Think about rollback** - Make it easy to revert when needed

**Welcome to CORE! Your contributions help build a better foundation for AI agent orchestration.**

---

*Last updated: 2025-01-17*
