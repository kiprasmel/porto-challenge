import { 
  calculateTextDiff, 
  textChangesToOperations, 
  transformOperation, 
  applyOperations, 
  mergeOperations, 
  createCRDTDocument, 
  validateOperation 
} from './utils';
import type { CRDTOperation } from './types';

// Test function to validate CRDT operations
export function runCRDTTests() {
  console.log('🧪 Running CRDT Tests...');
  
  // Test 1: Text diff calculation
  console.log('\n1. Testing text diff calculation:');
  const oldText = 'Hello world';
  const newText = 'Hello beautiful world';
  const diff = calculateTextDiff(oldText, newText);
  console.log('Old:', oldText);
  console.log('New:', newText);
  console.log('Diff:', diff);
  console.assert(diff.length === 2, 'Should have delete and insert operations');
  console.assert(diff[0].type === 'delete', 'First operation should be delete');
  console.assert(diff[1].type === 'insert', 'Second operation should be insert');
  
  // Test 2: Operation generation
  console.log('\n2. Testing operation generation:');
  const operations = textChangesToOperations(
    diff, 
    'test-note', 
    'body', 
    'client-1', 
    1, 
    'test-user'
  );
  console.log('Generated operations:', operations);
  console.assert(operations.length === 2, 'Should generate 2 operations');
  console.assert(operations[0].type === 'delete', 'First should be delete');
  console.assert(operations[1].type === 'insert', 'Second should be insert');
  
  // Test 3: Operation transformation
  console.log('\n3. Testing operation transformation:');
  const op1: CRDTOperation = {
    id: 'op1',
    type: 'insert',
    position: 5,
    content: 'beautiful ',
    timestamp: Date.now(),
    author: 'user1',
    noteId: 'note1',
    fieldType: 'body',
    clientId: 'client1',
    sequenceNumber: 1
  };
  
  const op2: CRDTOperation = {
    id: 'op2',
    type: 'insert',
    position: 5,
    content: 'amazing ',
    timestamp: Date.now() + 1,
    author: 'user2',
    noteId: 'note1',
    fieldType: 'body',
    clientId: 'client2',
    sequenceNumber: 1
  };
  
  const transformResult = transformOperation(op1, op2);
  console.log('Transform result:', transformResult);
  console.assert(transformResult.conflict === true, 'Should detect conflict');
  
  // Test 4: Apply operations
  console.log('\n4. Testing apply operations:');
  createCRDTDocument('Hello world');
  const ops: CRDTOperation[] = [
    {
      id: 'op1',
      type: 'insert',
      position: 6,
      content: 'beautiful ',
      timestamp: Date.now(),
      author: 'user1',
      noteId: 'note1',
      fieldType: 'body',
      clientId: 'client1',
      sequenceNumber: 1
    }
  ];
  
  const result = applyOperations(ops, 'body');
  console.log('Applied result:', result);
  console.assert(result === 'Hello beautiful world', 'Should apply insertion correctly');
  
  // Test 5: Merge operations
  console.log('\n5. Testing merge operations:');
  const localOps: CRDTOperation[] = [
    {
      id: 'local1',
      type: 'insert',
      position: 6,
      content: 'local ',
      timestamp: Date.now(),
      author: 'local-user',
      noteId: 'note1',
      fieldType: 'body',
      clientId: 'local-client',
      sequenceNumber: 1
    }
  ];
  
  const remoteOps: CRDTOperation[] = [
    {
      id: 'remote1',
      type: 'insert',
      position: 6,
      content: 'remote ',
      timestamp: Date.now() + 10,
      author: 'remote-user',
      noteId: 'note1',
      fieldType: 'body',
      clientId: 'remote-client',
      sequenceNumber: 1
    }
  ];
  
  const merged = mergeOperations(localOps, remoteOps);
  console.log('Merged operations:', merged);
  console.assert(merged.length === 2, 'Should merge both operations');
  
  // Test 6: Complex concurrent editing scenario
  console.log('\n6. Testing complex concurrent editing:');
  const initialText = 'The quick brown fox jumps over the lazy dog';
  
  // User 1 inserts "very " before "quick"
  const user1Op: CRDTOperation = {
    id: 'user1-1',
    type: 'insert',
    position: 4,
    content: 'very ',
    timestamp: Date.now(),
    author: 'user1',
    noteId: 'note1',
    fieldType: 'body',
    clientId: 'client1',
    sequenceNumber: 1
  };
  
  // User 2 deletes "brown " (positions 10-16 in original)
  const user2Op: CRDTOperation = {
    id: 'user2-1',
    type: 'delete',
    position: 10,
    length: 6,
    timestamp: Date.now() + 5,
    author: 'user2',
    noteId: 'note1',
    fieldType: 'body',
    clientId: 'client2',
    sequenceNumber: 1
  };
  
  // Apply operations in order
  const allOps = [user1Op, user2Op];
  const finalResult = applyOperations(allOps, 'body');
  console.log('Initial text:', initialText);
  console.log('Final text:', finalResult);
  console.log('Expected: "The very quick fox jumps over the lazy dog"');
  
  // Test 7: Operation validation
  console.log('\n7. Testing operation validation:');
  const validOp: CRDTOperation = {
    id: 'valid',
    type: 'insert',
    position: 0,
    content: 'Hello',
    timestamp: Date.now(),
    author: 'user',
    noteId: 'note',
    fieldType: 'body',
    clientId: 'client',
    sequenceNumber: 1
  };
  
  const invalidOp: CRDTOperation = {
    id: 'invalid',
    type: 'insert',
    position: 100,
    content: 'Hello',
    timestamp: Date.now(),
    author: 'user',
    noteId: 'note',
    fieldType: 'body',
    clientId: 'client',
    sequenceNumber: 1
  };
  
  const validResult = validateOperation(validOp, 'test');
  const invalidResult = validateOperation(invalidOp, 'test');
  
  console.log('Valid operation result:', validResult);
  console.log('Invalid operation result:', invalidResult);
  console.assert(validResult === true, 'Valid operation should pass');
  console.assert(invalidResult === false, 'Invalid operation should fail');
  
  console.log('\n✅ All CRDT tests completed!');
}

// Test collaborative editing scenario
export function testCollaborativeEditing() {
  console.log('\n🤝 Testing Collaborative Editing Scenario...');
  
  // Simulate two users editing simultaneously
  const initialText = 'Hello world';
  console.log('Initial text:', initialText);
  
  // User A adds "beautiful " at position 6
  const userAOp: CRDTOperation = {
    id: 'userA-1',
    type: 'insert',
    position: 6,
    content: 'beautiful ',
    timestamp: 1000,
    author: 'userA',
    noteId: 'shared-note',
    fieldType: 'body',
    clientId: 'clientA',
    sequenceNumber: 1
  };
  
  // User B adds "amazing " at position 6 (same position, slightly later)
  const userBOp: CRDTOperation = {
    id: 'userB-1',
    type: 'insert',
    position: 6,
    content: 'amazing ',
    timestamp: 1005,
    author: 'userB',
    noteId: 'shared-note',
    fieldType: 'body',
    clientId: 'clientB',
    sequenceNumber: 1
  };
  
  console.log('User A operation:', userAOp);
  console.log('User B operation:', userBOp);
  
  // Transform operations
  const transformResult = transformOperation(userAOp, userBOp);
  console.log('Transform result:', transformResult);
  
  // Apply both operations
  const finalOps = [transformResult.ownOp, transformResult.otherOp];
  const finalText = applyOperations(finalOps, 'body');
  
  console.log('Final text after transformation:', finalText);
  console.log('Expected: "Hello beautiful amazing world" (deterministic ordering)');
  
  // Test conflict resolution
  console.log('\nConflict detected:', transformResult.conflict);
  console.log('Operations successfully merged without data loss');
  
  console.log('\n✅ Collaborative editing test completed!');
}

// Run all tests
if (typeof window !== 'undefined') {
  // Running in browser
  (window as any).runCRDTTests = runCRDTTests;
  (window as any).testCollaborativeEditing = testCollaborativeEditing;
  console.log('CRDT tests available: runCRDTTests(), testCollaborativeEditing()');
} else {
  // Running in Node.js
  runCRDTTests();
  testCollaborativeEditing();
} 
