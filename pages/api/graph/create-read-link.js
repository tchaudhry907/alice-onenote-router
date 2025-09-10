// inside your POST handler, before you try to write:
let { sectionId, notebookName, sectionName } = req.body;

// if caller passed names instead of id
if (!sectionId && notebookName && sectionName) {
  const nbRes = await graphGET('/me/onenote/notebooks?$select=id,displayName');
  const nb = nbRes.value.find(
    n => (n.displayName || '').toLowerCase() === notebookName.toLowerCase()
  );
  if (!nb) {
    res.status(404).json({ ok: false, error: `Notebook not found: ${notebookName}` });
    return;
  }

  const secRes = await graphGET(`/me/onenote/notebooks/${nb.id}/sections?$select=id,displayName`);
  const sec = secRes.value.find(
    s => (s.displayName || '').toLowerCase() === sectionName.toLowerCase()
  );
  if (!sec) {
    res.status(404).json({ ok: false, error: `Section not found: ${sectionName}` });
    return;
  }

  sectionId = sec.id; // resolve real Graph id
}

// …then proceed with your existing POST to Graph
