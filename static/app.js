async function showOrphans() {
  if (!st.cur) return toast('Open a note first');
  toast('Loading orphan attachments...');
  try {
    const orphans = await api('/api/orphans');
    if (orphans.length === 0) {
      toast('No orphan attachments found');
      return;
    }
    
    // Show in history dialog for now, or create a new dialog
    let html = '<h3>Orphan Attachments</h3><ul>';
    orphans.forEach(att => {
      html += `<li><strong>${att.name}</strong> (${att.size} bytes, ${att.age_days} days old)<br>` +
              `<a href="/api/attachment?path=${encodeURIComponent(att.path)}" target="_blank">View</a></li>`;
    });
    html += '</ul>';
    
    // Use history dialog for orphan display
    $('#historyList').innerHTML = html;
    $('#historyCount').textContent = `${orphans.length} orphan attachment${orphans.length === 1 ? '' : 's'}`;
    $('#historyDialog').showModal();
    toast(`Found ${orphans.length} orphan attachments`);
  } catch (err) {
    toast('Error loading orphans: ' + err.message);
  }
}

async function showDiff() {
  if (!st.cur) return toast('Open a note first');
  
  // Get two history snapshots
  const h = await api('/api/history?path=' + encodeURIComponent(st.cur.path));
  if (h.length < 2) {
    toast('Not enough history snapshots');
    return;
  }
  
  // Show dialog to select two snapshots
  let html = `
    <h3>Compare History Snapshots</h3>
    <div class="diff-panel">
      <div class="diff-header">
        <label>Snapshot 1</label>
        <input type="text" id="diff1" class="diff-id" value="${h[0].id}">
      </div>
      <div class="diff-header">
        <label>Snapshot 2</label>
        <input type="text" id="diff2" class="diff-id" value="${h[1].id}">
      </div>
      <div class="diff-content">
        <div id="diff1-content"></div>
        <div id="diff2-content"></div>
        <div id="diff-segments"></div>
      </div>
    </div>
  `;
  
  $('#historyDialog').showModal();
  $('#historyList').innerHTML = html;
  
  // Add event listeners
  $('#diff1').onchange = showDiffContent;
  $('#diff2').onchange = showDiffContent;
}

function showDiffContent() {
  const id1 = $('#diff1').value;
  const id2 = $('#diff2').value;
  const path = st.cur.path;
  
  if (!id1 || !id2) return;
  
  api(`/api/history/item?path=${encodeURIComponent(path)}&id=${id1}`)
    .then(item1 => api(`/api/history/item?path=${encodeURIComponent(path)}&id=${id2}`)
      .then(item2 => {
        const sm = difflib.SequenceMatcher(None, item1.content, item2.content, autojunk=False);
        const diff = { from: item1.content, to: item2.content, segments: [] };
        
        for (const [tag, i1, i2, j1, j2] of sm.get_opcodes()) {
          if (tag === 'equal') continue;
          diff.segments.push({
            type: tag,
            from_line: i1 + 1,
            to_line: i2 + 1,
            old_lines: item1.content.splitlines()[i1:i2],
            new_lines: item2.content.splitlines()[j1:j2]
          });
        }
        
        // Render diff
        const content1 = document.getElementById('diff1-content');
        const content2 = document.getElementById('diff2-content');
        const segments = document.getElementById('diff-segments');
        
        content1.innerHTML = item1.content.replace(/\n/g, '<br>');
        content2.innerHTML = item2.content.replace(/\n/g, '<br>');
        segments.innerHTML = '';
        
        diff.segments.forEach(seg => {
          const div = document.createElement('div');
          div.className = 'diff-segment';
          div.innerHTML = `
            <div class="diff-type" style="color: ${getDiffColor(seg.type)};">${seg.type}</div>
            <div class="diff-lines">
              <div class="diff-old">${seg.old_lines.join('<br>')} </div>
              <div class="diff-new">${seg.new_lines.join('<br>')} </div>
            </div>
          `;
          segments.appendChild(div);
        });
      }))
    .catch(err => {
      toast('Error loading snapshots: ' + err.message);
      $('#historyDialog').close();
    });
}

function getDiffColor(type) {
  switch (type) {
    case 'equal': return 'black';
    case 'insert': return 'green';
    case 'delete': return 'red';
    case 'replace': return 'orange';
    default: return 'black';
  }
}