/**
 * Policy Evaluation Example
 *
 * This example demonstrates how to use the CORE runtime policy evaluation
 * engine to make access control decisions at runtime.
 */

import { tokenize } from '../compiler/lexer/lexer';
import { parse } from '../compiler/parser/parser';
import { SecurityContext } from '../compiler/security/analyzer';
import { PolicyEvaluator } from '../compiler/security/policy';

// Define a CORE module with security primitives
const coreSource = `(mod hospital.system
  :version "1.0.0"

  ; Define permissions
  (perm patient.read
    :doc "Read patient records"
    :classify :confidential
    :audit-required true)

  (perm patient.write
    :doc "Update patient records"
    :classify :confidential
    :audit-required true)

  (perm patient.delete
    :doc "Delete patient records"
    :classify :restricted
    :audit-required true)

  (perm report.read
    :doc "Read medical reports"
    :classify :confidential
    :audit-required false)

  ; Define roles with inheritance
  (role receptionist
    :perms [patient.read])

  (role nurse
    :perms [patient.read patient.write report.read]
    :inherits [receptionist])

  (role doctor
    :perms [patient.read patient.write report.read]
    :inherits [nurse])

  (role admin
    :perms [patient.delete]
    :inherits [doctor])

  ; Define access policy
  (policy hospital_access
    :doc "Hospital system access control policy"
    :rules [
      ; Receptionists can only read patient basic info
      (allow [receptionist] [patient.read] :all-versions)

      ; Nurses can read and update patients
      (allow [nurse] [patient.read patient.write report.read] :all-versions)

      ; Doctors have full access except delete
      (allow [doctor] [patient.read patient.write report.read] :stable-only)

      ; Only admins can delete patients
      (allow [admin] [patient.delete] :stable-only)])

  ; Define functions
  (fn view_patient :v1
    :stability stable
    :requires [receptionist]
    :inputs [(patient_id :uuid)]
    :outputs [(patient :Patient)]
    (body true))

  (fn update_patient :v1
    :stability stable
    :requires [nurse]
    :inputs [(patient_id :uuid) (data :PatientData)]
    :outputs [(result :bool)]
    (body true))

  (fn delete_patient :v1
    :stability stable
    :requires [admin]
    :inputs [(patient_id :uuid)]
    :outputs [(result :bool)]
    (body true))

  (fn view_report :v1
    :stability stable
    :requires [nurse]
    :inputs [(report_id :uuid)]
    :outputs [(report :Report)]
    (body true)))`;

// Parse and setup security context
console.log('='.repeat(70));
console.log('CORE Runtime Policy Evaluation Example');
console.log('='.repeat(70));
console.log();

const tokens = tokenize(coreSource);
const ast = parse(tokens);

const securityContext = new SecurityContext();
const evaluator = new PolicyEvaluator(securityContext);

// Register security primitives and functions
ast.elements.forEach((element: any) => {
  if (element.type === 'Role') {
    securityContext.registerRole(element);
  } else if (element.type === 'Permission') {
    securityContext.registerPermission(element);
  } else if (element.type === 'Policy') {
    securityContext.registerPolicy(element);
  } else if (element.type === 'Function') {
    // Manually set required permissions for this example
    if (element.name === 'view_patient') {
      element.security.requiredPermissions = ['patient.read'];
    } else if (element.name === 'update_patient') {
      element.security.requiredPermissions = ['patient.write'];
    } else if (element.name === 'delete_patient') {
      element.security.requiredPermissions = ['patient.delete'];
    } else if (element.name === 'view_report') {
      element.security.requiredPermissions = ['report.read'];
    }
    securityContext.registerFunction(element);
  }
});

console.log('✓ Loaded security model with:');
console.log(`  - ${securityContext.getAllRoles().length} roles`);
console.log(`  - ${securityContext.getAllPermissions().length} permissions`);
console.log(`  - ${securityContext.getAllPolicies().length} policies`);
console.log(`  - ${securityContext.getAllFunctions().length} functions`);
console.log();

// Demonstrate access control decisions
console.log('Runtime Access Control Decisions:');
console.log('-'.repeat(70));
console.log();

// Test 1: Receptionist viewing patient
console.log('1. Receptionist trying to view patient:');
const decision1 = evaluator.evaluate({
  role: 'receptionist',
  functionName: 'view_patient',
});
console.log(`   Result: ${decision1.allowed ? '✓ ALLOWED' : '✗ DENIED'}`);
console.log(`   Reason: ${decision1.reason}`);
console.log();

// Test 2: Receptionist trying to update patient (should be denied)
console.log('2. Receptionist trying to update patient:');
const decision2 = evaluator.evaluate({
  role: 'receptionist',
  functionName: 'update_patient',
});
console.log(`   Result: ${decision2.allowed ? '✓ ALLOWED' : '✗ DENIED'}`);
console.log(`   Reason: ${decision2.reason}`);
console.log();

// Test 3: Nurse updating patient
console.log('3. Nurse trying to update patient:');
const decision3 = evaluator.evaluate({
  role: 'nurse',
  functionName: 'update_patient',
});
console.log(`   Result: ${decision3.allowed ? '✓ ALLOWED' : '✗ DENIED'}`);
console.log(`   Reason: ${decision3.reason}`);
console.log();

// Test 4: Doctor trying to delete patient (should be denied - no permission)
console.log('4. Doctor trying to delete patient:');
const decision4 = evaluator.evaluate({
  role: 'doctor',
  functionName: 'delete_patient',
});
console.log(`   Result: ${decision4.allowed ? '✓ ALLOWED' : '✗ DENIED'}`);
console.log(`   Reason: ${decision4.reason}`);
console.log();

// Test 5: Admin deleting patient
console.log('5. Admin trying to delete patient:');
const decision5 = evaluator.evaluate({
  role: 'admin',
  functionName: 'delete_patient',
});
console.log(`   Result: ${decision5.allowed ? '✓ ALLOWED' : '✗ DENIED'}`);
console.log(`   Reason: ${decision5.reason}`);
console.log();

// Get access report for each role
console.log();
console.log('Access Reports by Role:');
console.log('-'.repeat(70));
console.log();

const roles = ['receptionist', 'nurse', 'doctor', 'admin'];
for (const role of roles) {
  const report = evaluator.getAccessReport(role);
  console.log(`${role.toUpperCase()}:`);
  console.log(`  Total functions: ${report.totalFunctions}`);
  console.log(`  Accessible: ${report.accessibleFunctions}`);
  console.log(`  Denied: ${report.deniedFunctions}`);
  console.log(`  Coverage: ${Math.round((report.accessibleFunctions / report.totalFunctions) * 100)}%`);

  const accessible = evaluator.getAccessibleFunctions(role);
  console.log(`  Can access: ${accessible.map(f => f.name).join(', ')}`);
  console.log();
}

// Demonstrate bulk evaluation
console.log();
console.log('Bulk Access Check for Nurse:');
console.log('-'.repeat(70));
console.log();

const bulkResults = evaluator.evaluateBulk('nurse', [
  'view_patient',
  'update_patient',
  'delete_patient',
  'view_report'
]);

bulkResults.forEach((decision, functionName) => {
  console.log(`  ${functionName}: ${decision.allowed ? '✓ ALLOWED' : '✗ DENIED'}`);
});
console.log();

console.log('='.repeat(70));
console.log('Example complete!');
console.log('='.repeat(70));
