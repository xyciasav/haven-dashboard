import assert from 'node:assert/strict';
import test from 'node:test';
import { vikunjaAssigneeMatches, vikunjaColumn } from '../lib/vikunja.js';

test('Vikunja columns ignore punctuation, spacing, and case',()=>{
  assert.equal(vikunjaColumn('To-Do'),'todo');
  assert.equal(vikunjaColumn('TODO'),'todo');
  assert.equal(vikunjaColumn('Working On'),'working');
  assert.equal(vikunjaColumn('In-Progress'),'working');
});

test('Vikunja assignees match either mapped id or household identity',()=>{
  assert.equal(vikunjaAssigneeMatches({id:8,name:'Someone'},{userId:8,identity:{name:'Mike'}}),true);
  assert.equal(vikunjaAssigneeMatches({id:12,name:'Mike'},{userId:8,identity:{name:'Mike'}}),true);
  assert.equal(vikunjaAssigneeMatches({id:12,username:'mike'},{userId:8,identity:{preferred_username:'mike'}}),true);
  assert.equal(vikunjaAssigneeMatches({id:12,name:'Alex'},{userId:8,identity:{name:'Mike'}}),false);
});
