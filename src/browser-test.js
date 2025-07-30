// Browser test for CRDT functionality
// Run this in the browser console to test the fixes

window.testCRDTFixes = function() {
  console.log('🧪 Testing CRDT Fixes...');
  
  // Test 1: Workspace switching
  console.log('\n1. Testing workspace functionality...');
  
  // Check if workspaces exist in localStorage
  const workspaces = localStorage.getItem('workspaces');
  console.log('Workspaces:', workspaces ? JSON.parse(workspaces) : 'None found');
  
  // Test 2: Note storage
  console.log('\n2. Testing note storage...');
  
  // Check for notes in default workspace
  const defaultNotes = localStorage.getItem('crdt_default_notes');
  console.log('Default workspace notes:', defaultNotes ? JSON.parse(defaultNotes).length : 0);
  
  // Test 3: Create test note
  console.log('\n3. Testing note creation...');
  
  const testNote = {
    id: Date.now(),
    localId: `test_${Date.now()}`,
    titleDocument: {
      operations: [],
      currentText: 'Test Note ' + Date.now(),
      version: 0,
      lastModified: Date.now()
    },
    bodyDocument: {
      operations: [],
      currentText: 'This is a test note created by the browser test.',
      version: 0,
      lastModified: Date.now()
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    isDirty: false,
    isLocalOnly: true
  };
  
  // Save test note
  const existingNotes = defaultNotes ? JSON.parse(defaultNotes) : [];
  existingNotes.push(testNote);
  localStorage.setItem('crdt_default_notes', JSON.stringify(existingNotes));
  
  console.log('✅ Test note created:', testNote.titleDocument.currentText);
  
  // Test 4: Workspace creation
  console.log('\n4. Testing workspace creation...');
  
  const testWorkspace = {
    id: `test-workspace-${Date.now()}`,
    name: 'Test Workspace',
    created_at: new Date().toISOString()
  };
  
  const existingWorkspaces = workspaces ? JSON.parse(workspaces) : [];
  existingWorkspaces.push(testWorkspace);
  localStorage.setItem('workspaces', JSON.stringify(existingWorkspaces));
  
  console.log('✅ Test workspace created:', testWorkspace.name);
  
  // Test 5: Check app state
  console.log('\n5. Checking app state...');
  
  // Try to access React components (if available)
  const appElement = document.querySelector('.note-app');
  if (appElement) {
    console.log('✅ App container found');
    
    const titleInput = document.querySelector('.note-title-input');
    const textarea = document.querySelector('.note-textarea');
    const notesList = document.querySelector('.sticky-notes-grid');
    
    console.log('Title input:', titleInput ? '✅ Found' : '❌ Not found');
    console.log('Textarea:', textarea ? '✅ Found' : '❌ Not found');
    console.log('Notes list:', notesList ? '✅ Found' : '❌ Not found');
    
    if (notesList) {
      const noteCards = notesList.querySelectorAll('.sticky-note');
      console.log('Note cards count:', noteCards.length);
    }
  } else {
    console.log('❌ App container not found');
  }
  
  console.log('\n🎉 Browser test completed! Check the app to see if notes and workspaces are working.');
  console.log('💡 Try:');
  console.log('  1. Refresh the page');
  console.log('  2. Create a new note');
  console.log('  3. Switch workspaces');
  console.log('  4. Type in a note and see if it saves (should sync every 500ms)');
  console.log('  5. Check Network tab to see API calls with format: {id, body: "JSON string"}');
  
  // Test the new API format
  console.log('\n📡 Testing API format:');
  const sampleAPIRequest = {
    id: 123,
    body: JSON.stringify({
      title: 'Sample Note',
      content: 'This is the note content',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1
    })
  };
  console.log('Sample API request body:', JSON.stringify(sampleAPIRequest, null, 2));
  
  return {
    workspacesCount: existingWorkspaces.length,
    notesCount: existingNotes.length,
    testNote,
    testWorkspace
  };
};

// Auto-run test if in browser
if (typeof window !== 'undefined' && window.location) {
  console.log('🚀 CRDT browser test loaded. Run testCRDTFixes() to test the fixes.');
} 
