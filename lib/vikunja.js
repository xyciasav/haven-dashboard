const identityValues=value=>[value?.id,value?.name,value?.username,value?.preferred_username,value?.email]
  .filter(item=>item!==undefined&&item!==null&&String(item).trim())
  .map(item=>String(item).trim().toLocaleLowerCase());

export function vikunjaColumn(title){
  const normalized=String(title||'').toLocaleLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  if(['todo','to do','ready','ready to do'].includes(normalized))return 'todo';
  if(['working','working on','in progress','doing'].includes(normalized))return 'working';
  return null;
}

export function vikunjaAssigneeMatches(assignee,{userId,identity,selectedUser}={}){
  if(userId!==undefined&&userId!==null&&String(assignee?.id)===String(userId))return true;
  const wanted=new Set([
    ...identityValues(identity),
    ...identityValues(selectedUser),
  ]);
  return identityValues(assignee).some(value=>wanted.has(value));
}
