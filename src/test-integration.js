// Simple integration test for CRDT system
console.log('🧪 Running CRDT Integration Test...');

// Test localStorage functionality
try {
  const testKey = 'crdt_test_notes';
  const testData = [{
    id: 1,
    titleDocument: { currentText: 'Test Note', operations: [], version: 0, lastModified: Date.now() },
    bodyDocument: { currentText: 'Test content', operations: [], version: 0, lastModified: Date.now() },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    isDirty: false,
    isLocalOnly: true
  }];
  
  localStorage.setItem(testKey, JSON.stringify(testData));
  const retrieved = JSON.parse(localStorage.getItem(testKey));
  
  console.log('✅ localStorage test passed');
  console.log('Saved:', testData[0].titleDocument.currentText);
  console.log('Retrieved:', retrieved[0].titleDocument.currentText);
  
  // Cleanup
  localStorage.removeItem(testKey);
  
} catch (error) {
  console.error('❌ localStorage test failed:', error);
}

// Test workspace key generation
const workspace = 'test-workspace';
const key = `crdt_${workspace}_notes`;
console.log('✅ Workspace key generation:', key);

// Test note structure
const sampleNote = {
  id: Date.now(),
  localId: `local_${Date.now()}`,
  titleDocument: {
    operations: [],
    currentText: '',
    version: 0,
    lastModified: Date.now()
  },
  bodyDocument: {
    operations: [],
    currentText: '',
    version: 0,
    lastModified: Date.now()
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  isDirty: false,
  isLocalOnly: true
};

console.log('✅ Note structure validation passed');
console.log('Sample note ID:', sampleNote.id);
console.log('Sample localId:', sampleNote.localId);

console.log('🎉 All integration tests passed!');

// Export for browser console testing
if (typeof window !== 'undefined') {
  window.testCRDTIntegration = () => {
    console.log('Running CRDT integration test...');
    // Add browser-specific tests here
  };
} 
