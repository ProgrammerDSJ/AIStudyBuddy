// public/notes.js
// Assumes server-side activeUserUUID is set after login
const API = {
  getSubjects: "/api/user/subjects",
  createSubject: "/api/user/subjects",
  createChapter: "/api/user/chapters",
  createNote: "/api/user/notes"
};

const messageEl = document.getElementById("message");
const subjectsContainer = document.getElementById("subjectsContainer");
const chaptersContainer = document.getElementById("chaptersContainer");
const notesContainer = document.getElementById("notesContainer");
const breadcrumbs = document.getElementById("breadcrumbs");
const addSubjectBtn = document.getElementById("addSubjectBtn");

let currentSubject = null; // { _id, name, chapters[] }
let currentChapter = null; // { _id, name, notes[] }

/* Utility: fetch JSON with error handling */
async function apiFetch(url, opts = {}) {
  try {
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  } catch (err) {
    console.error("API error:", err);
    throw err;
  }
}

/* Load subjects on page load */
async function loadSubjects() {
  try {
    const data = await apiFetch(API.getSubjects);
    if (!data.hasSubjects) {
      subjectsContainer.innerHTML = "";
      chaptersContainer.classList.add("hidden");
      notesContainer.classList.add("hidden");
      messageEl.textContent = data.message || "No subjects yet.";
      return;
    }

    messageEl.textContent = "";
    const subjects = data.subjects || [];
    renderSubjects(subjects);
  } catch (err) {
    messageEl.textContent = "Failed to load subjects.";
  }
}

/* Render subject thumbnails */
function renderSubjects(subjects) {
  subjectsContainer.innerHTML = "";
  chaptersContainer.classList.add("hidden");
  notesContainer.classList.add("hidden");
  breadcrumbs.textContent = "";

  subjects.forEach(sub => {
    const el = document.createElement("div");
    el.className = "folder";
    el.dataset.subjectId = sub._id;

    el.innerHTML = `
      <div class="name">${escapeHtml(sub.name)}</div>
      <div class="meta">${(sub.chapters || []).length} chapters • ${countNotes(sub)} notes</div>
    `;

    // Double-click opens chapters
    el.addEventListener("dblclick", () => {
      openSubject(sub);
    });

    subjectsContainer.appendChild(el);
  });
}

/* Escape html */
function escapeHtml(s){ return (s+"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* Count notes in a subject */
function countNotes(subject) {
  if (!subject.chapters) return 0;
  return subject.chapters.reduce((acc, ch) => acc + (ch.notes ? ch.notes.length : 0), 0);
}

/* Open subject -> show chapters */
function openSubject(subject) {
  currentSubject = subject;
  currentChapter = null;
  breadcrumbs.innerHTML = `<strong>${escapeHtml(subject.name)}</strong>`;
  subjectsContainer.classList.add("hidden");
  chaptersContainer.classList.remove("hidden");
  notesContainer.classList.add("hidden");
  renderChapters(subject.chapters || []);
}

/* Render chapters */
function renderChapters(chapters) {
  chaptersContainer.innerHTML = "";

  if (!chapters || chapters.length === 0) {
    chaptersContainer.innerHTML = `<div class="kv">No chapters yet. Click "Add Chapter" to create one.</div>`;
  } else {
    const grid = document.createElement("div");
    grid.className = "grid";
    chapters.forEach(ch => {
      const el = document.createElement("div");
      el.className = "folder";
      el.dataset.chapterId = ch._id;
      el.innerHTML = `<div class="name">${escapeHtml(ch.name)}</div>
                      <div class="meta">${(ch.notes || []).length} notes</div>`;
      // Double click opens notes for that chapter
      el.addEventListener("dblclick", () => {
        openChapter(ch);
      });
      grid.appendChild(el);
    });
    chaptersContainer.appendChild(grid);
  }

  // Add chapter button
  const addChapterBtn = document.createElement("button");
  addChapterBtn.className = "btn";
  addChapterBtn.textContent = "+ Add Chapter";
  addChapterBtn.style.marginTop = "12px";
  addChapterBtn.addEventListener("click", async () => {
    const name = prompt("Enter chapter name:");
    if (!name) return;
    try {
      const body = { subjectId: currentSubject._id, name };
      const res = await apiFetch(API.createChapter, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      // Res returns full chapters -> reload subject view
      // fetch fresh data from server to ensure sync
      await loadSubjects(); // refresh subject list
      // Re-open the subject so chapters show
      const data = await apiFetch(API.getSubjects);
      const freshSubject = (data.subjects || []).find(s => s._id === currentSubject._id);
      if (freshSubject) openSubject(freshSubject);
    } catch (err) {
      alert("Failed to add chapter.");
    }
  });

  chaptersContainer.appendChild(addChapterBtn);
}

/* Open chapter -> show notes editor & notes list */
function openChapter(chapter) {
  currentChapter = chapter;
  breadcrumbs.innerHTML = `<a href="#" id="backToSubjects">Subjects</a> / <strong>${escapeHtml(currentSubject.name)}</strong> / <strong>${escapeHtml(chapter.name)}</strong>`;

  document.getElementById("backToSubjects")?.addEventListener("click", (e) => {
    e.preventDefault();
    subjectsContainer.classList.remove("hidden");
    chaptersContainer.classList.add("hidden");
    notesContainer.classList.add("hidden");
    breadcrumbs.textContent = "";
    currentSubject = null;
    currentChapter = null;
    loadSubjects();
  });

  chaptersContainer.classList.add("hidden");
  notesContainer.classList.remove("hidden");
  renderNotesView(chapter);
}

/* Render notes view & form */
function renderNotesView(chapter) {
  // Clear container first
  notesContainer.innerHTML = "";
  
  // Add title
  const title = document.createElement("h2");
  title.textContent = `Notes — ${chapter.name}`;
  notesContainer.appendChild(title);

  // Create notes list section
  const notesList = document.createElement("div");
  notesList.style.marginTop = "20px";
  notesList.style.marginBottom = "20px";
  
  const notesHeader = document.createElement("div");
  notesHeader.className = "kv";
  notesHeader.innerHTML = `<strong>Existing notes:</strong>`;
  notesList.appendChild(notesHeader);

  const list = document.createElement("div");
  list.style.marginTop = "10px";
  
  console.log("Rendering notes for chapter:", chapter.name);
  console.log("Notes array:", chapter.notes);
  
  if (!chapter.notes || chapter.notes.length === 0) {
    list.innerHTML = `<div class="kv">No notes yet for this chapter. Add one using the form below.</div>`;
  } else {
    chapter.notes.forEach((n, index) => {
      console.log(`Note ${index}:`, n);
      
      const item = document.createElement("div");
      item.style.padding = "12px";
      item.style.marginBottom = "8px";
      item.style.background = "rgba(255,255,255,0.02)";
      item.style.borderRadius = "8px";
      item.style.border = "1px solid rgba(255,255,255,0.03)";

      item.innerHTML = `<div style="font-weight:700">${escapeHtml(n.title)}</div>
              <div class="meta">${escapeHtml(n.type)} • ${new Date(n.createdAt).toLocaleString()}</div>`;
      
      if (n.content) {
        const contentDiv = document.createElement("div");
        contentDiv.style.marginTop = "6px";
        contentDiv.style.color = "var(--muted)";
        contentDiv.textContent = n.content;
        item.appendChild(contentDiv);
      }

      // Add file link if it exists
      if (n.fileUrl) {
        const fileLink = document.createElement("a");
        fileLink.href = n.fileUrl;
        fileLink.target = "_blank";
        fileLink.style.display = "inline-block";
        fileLink.style.marginTop = "8px";
        fileLink.style.padding = "6px 12px";
        fileLink.style.background = "var(--accent)";
        fileLink.style.color = "#000";
        fileLink.style.borderRadius = "6px";
        fileLink.style.textDecoration = "none";
        fileLink.style.fontWeight = "600";
        fileLink.style.fontSize = "13px";
        fileLink.textContent = "📎 View File";
        item.appendChild(fileLink);
      }

      list.appendChild(item);
    });
  }
  
  notesList.appendChild(list);
  notesContainer.appendChild(notesList);

  // Note creation form
  const form = document.createElement("div");
  form.className = "notesView";
  form.innerHTML = `
    <div class="kv">Add a new note / metadata</div>
    <div class="formRow">
      <input id="noteTitle" placeholder="Title" class="input" />
      <select id="noteType" class="input small">
        <option value="notes">Notes</option>
        <option value="test">Test</option>
        <option value="assignment">Assignment</option>
        <option value="project">Project</option>
      </select>
    </div>
    <div>
      <textarea id="noteContent" placeholder="Note content / description"></textarea>
    </div>
    <div style="margin-top:8px">
      <input type="file" id="noteFile" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.js,.py,.java,.c,.cpp,.jpg,.png,.gif" />
    </div>
    <div style="margin-top:8px">
      <button id="saveNoteBtn" class="btn">Save Note (metadata + file)</button>
      <button id="backToChapters" class="btn" style="margin-left:8px">Back to Chapters</button>
    </div>
  `;
  notesContainer.appendChild(form);

  // Back to chapters button handler
  document.getElementById("backToChapters").addEventListener("click", () => {
    notesContainer.classList.add("hidden");
    chaptersContainer.classList.remove("hidden");
    renderChapters(currentSubject.chapters || []);
  });

  // Save note button handler
  document.getElementById("saveNoteBtn").addEventListener("click", async () => {
    const titleInput = document.getElementById("noteTitle");
    const contentInput = document.getElementById("noteContent");
    const typeInput = document.getElementById("noteType");
    const fileInput = document.getElementById("noteFile");
    
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const type = typeInput.value;
    const file = fileInput ? fileInput.files[0] : null;

    console.log("Save button clicked");
    console.log("Title:", title);
    console.log("Content:", content);
    console.log("Type:", type);
    console.log("File:", file ? file.name : "No file");

    if (!title && !file) { 
      alert("Title or file required"); 
      return; 
    }

    const saveBtn = document.getElementById("saveNoteBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Uploading...";

    const formData = new FormData();
    formData.append("subjectId", currentSubject._id);
    formData.append("chapterId", currentChapter._id);
    formData.append("title", title || (file ? file.name : "Untitled"));
    formData.append("content", content);
    formData.append("type", type);
    if (file) formData.append("file", file);

    console.log("Sending upload request...");

    try {
      const response = await fetch("/api/user/upload-note-file", {
        method: "POST",
        body: formData
      });
      
      console.log("Response status:", response.status);
      
      const data = await response.json();
      console.log("Response data:", data);
      
      if (!response.ok || data.error) {
        throw new Error(data.error || data.details || "Upload failed");
      }
      
      alert("Note uploaded successfully!");
      
      // Clear form
      titleInput.value = "";
      contentInput.value = "";
      if (fileInput) fileInput.value = "";

      // Refresh UI by reloading subjects and opening the same branch
      console.log("Refreshing UI...");
      const refreshData = await apiFetch(API.getSubjects);
      const freshSubject = (refreshData.subjects || []).find(s => s._id === currentSubject._id);
      if (freshSubject) {
        const freshChapter = freshSubject.chapters.find(c => c._id === currentChapter._id);
        if (freshChapter) {
          currentSubject = freshSubject;
          currentChapter = freshChapter;
          openChapter(currentChapter);
        }
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload note/file: " + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Note (metadata + file)";
    }
  });
}

/* Add subject button handler */
addSubjectBtn.addEventListener("click", async () => {
  const name = prompt("Enter subject name:");
  if (!name) return;
  try {
    await apiFetch(API.createSubject, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    await loadSubjects();
  } catch (err) {
    alert("Failed to create subject.");
  }
});

/* Init */
window.addEventListener("DOMContentLoaded", () => {
  loadSubjects();
});