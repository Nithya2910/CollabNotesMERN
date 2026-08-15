import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import ImageGalleryModal from '../components/ImageGalleryModal';
import DrawingCanvas from '../components/DrawingCanvas';
import { notesAPI, uploadAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import useSocket from '../hooks/useSocket';

/**
 * Editor — full collaborative note editor with:
 * - Split write / preview panes
 * - Real-time sync via Socket.IO
 * - Autosave (1.5s debounce)
 * - Typing indicators
 * - Active collaborator avatars
 * - Share modal
 * - Version history drawer
 * - Image gallery modal
 * - Drawing canvas (uploads PNG then inserts as markdown image)
 * - Drag-and-drop image uploads
 */
const Editor = () => {
  const { id: noteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Note state ──────────────────────────────────────────────────────
  const [note, setNote] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [uploading, setUploading] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────
  const [view, setView] = useState('split');    // 'write' | 'split' | 'preview'
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [drawingOpen, setDrawingOpen] = useState(false);
  const [shareInput, setShareInput] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);

  // ── Collaboration state ─────────────────────────────────────────────
  const [activeUsers, setActiveUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  // ── Refs ────────────────────────────────────────────────────────────
  const autosaveTimerRef = useRef(null);
  const remoteUpdateRef  = useRef(false);
  const fileInputRef     = useRef(null);
  const textareaRef      = useRef(null);

  // ── Socket callbacks ────────────────────────────────────────────────
  const handleNoteUpdated = useCallback(({ content: remoteContent, title: remoteTitle }) => {
    remoteUpdateRef.current = true;
    if (remoteContent !== undefined) setContent(remoteContent);
    if (remoteTitle   !== undefined) setTitle(remoteTitle);
  }, []);

  const handleActiveUsers = useCallback((users) => {
    setActiveUsers(users);
  }, []);

  const handleUserTyping = useCallback(({ username }) => {
    setTypingUsers((prev) => [...new Set([...prev, username])]);
  }, []);

  const handleUserStoppedTyping = useCallback(({ username }) => {
    setTypingUsers((prev) => prev.filter((u) => u !== username));
  }, []);

  const { emitUpdate, emitTyping } = useSocket(noteId, {
    onNoteUpdated:      handleNoteUpdated,
    onActiveUsers:      handleActiveUsers,
    onUserTyping:       handleUserTyping,
    onUserStoppedTyping: handleUserStoppedTyping,
  });

  // ── Fetch note on mount ─────────────────────────────────────────────
  useEffect(() => {
    const fetchNote = async () => {
      try {
        const { data } = await notesAPI.getById(noteId);
        setNote(data.note);
        setTitle(data.note.title || '');
        setContent(data.note.content || '');
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load note');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchNote();
  }, [noteId]);

  // ── Autosave with 1.5s debounce ─────────────────────────────────────
  const saveNote = useCallback(async (newTitle, newContent) => {
    setSaving(true);
    try {
      await notesAPI.update(noteId, { title: newTitle, content: newContent });
      setLastSaved(new Date());
    } catch {
      // Silent fail — socket kept peers in sync
    } finally {
      setSaving(false);
    }
  }, [noteId]);

  const scheduleAutosave = useCallback((newTitle, newContent) => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => saveNote(newTitle, newContent), 1500);
  }, [saveNote]);

  // ── Insert markdown at cursor (shared helper) ───────────────────────
  const insertAtCursor = useCallback((md) => {
    const textarea = textareaRef.current;
    let newContent;
    if (textarea) {
      const start = textarea.selectionStart;
      const end   = textarea.selectionEnd;
      newContent = content.substring(0, start) + md + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + md.length;
        textarea.focus();
      }, 0);
    } else {
      newContent = content + '\n' + md;
      setContent(newContent);
    }
    if (!remoteUpdateRef.current) {
      emitUpdate(newContent, title);
      scheduleAutosave(title, newContent);
    }
  }, [content, title, emitUpdate, scheduleAutosave]);

  // ── Handle content change ───────────────────────────────────────────
  const handleContentChange = (e) => {
    const val = e.target.value;
    setContent(val);
    if (!remoteUpdateRef.current) {
      emitUpdate(val, title);
      emitTyping();
      scheduleAutosave(title, val);
    }
    remoteUpdateRef.current = false;
  };

  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitle(val);
    if (!remoteUpdateRef.current) {
      emitUpdate(content, val);
      scheduleAutosave(val, content);
    }
    remoteUpdateRef.current = false;
  };

  // ── Generic file uploader ────────────────────────────────────────────
  const uploadAndInsert = async (file) => {
    setUploading(true);
    const toastId = toast.loading('Uploading file…');
    try {
      const { data } = await uploadAPI.uploadFile(file);
      const isImage = file.type.startsWith('image/');
      const encodedUrl = encodeURI(data.url);
      const md = isImage ? `![${file.name}](${encodedUrl})` : `[${file.name}](${encodedUrl})`;
      insertAtCursor(md);
      toast.success('File uploaded successfully', { id: toastId });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload file', { id: toastId });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAndInsert(file);
  };

  // ── Drag-and-drop image upload ───────────────────────────────────────
  const handleDragOver = (e) => {
    e.preventDefault();
    setDraggingOver(true);
  };

  const handleDragLeave = () => setDraggingOver(false);

  const handleDrop = async (e) => {
    e.preventDefault();
    setDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Only images and PDFs can be dropped here');
      return;
    }
    await uploadAndInsert(file);
  };

  // ── Drawing insertion callback ───────────────────────────────────────
  const handleInsertDrawing = useCallback((md) => {
    insertAtCursor(md);
  }, [insertAtCursor]);

  // ── Image gallery insertion callback ─────────────────────────────────
  const handleInsertImage = useCallback((md) => {
    insertAtCursor(md);
  }, [insertAtCursor]);

  // ── Share note ───────────────────────────────────────────────────────
  const handleShare = async (e) => {
    e.preventDefault();
    if (!shareInput.trim()) return;
    setShareLoading(true);
    try {
      const { data } = await notesAPI.share(noteId, { identifier: shareInput.trim() });
      toast.success(data.message);
      setNote((n) => ({ ...n, collaborators: data.collaborators }));
      setShareInput('');
      setShareOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to share note');
    } finally {
      setShareLoading(false);
    }
  };

  // ── Restore version ──────────────────────────────────────────────────
  const handleRestoreVersion = async (versionIndex) => {
    try {
      const { data } = await notesAPI.restoreVersion(noteId, { versionIndex });
      setContent(data.note.content);
      setTitle(data.note.title);
      setNote(data.note);
      setHistoryOpen(false);
      toast.success('Version restored successfully');
    } catch {
      toast.error('Failed to restore version');
    }
  };

  const isOwner = note?.owner?._id === user?.id || note?.owner === user?.id;

  const formatTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="flex flex-col items-center gap-4">
            <svg className="animate-spin w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">Loading note…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Navbar />

      {/* ── Editor toolbar ── */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">

          {/* View toggle */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {['write', 'split', 'preview'].map((v) => (
              <button
                key={v}
                id={`view-${v}`}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                  view === v
                    ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Status and actions */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500 italic animate-pulse">
                {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing…
              </span>
            )}

            {/* Save status */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              {saving ? (
                <>
                  <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </>
              ) : lastSaved ? (
                <>
                  <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Saved {formatTime(lastSaved)}
                </>
              ) : null}
            </div>

            {/* Active collaborators */}
            {activeUsers.length > 0 && (
              <div className="flex -space-x-2">
                {activeUsers.map((u) => (
                  <div
                    key={u.id}
                    title={`${u.username} is editing`}
                    className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-purple-500
                               flex items-center justify-center text-white text-xs font-bold
                               ring-2 ring-white dark:ring-gray-900"
                  >
                    {u.username?.[0]?.toUpperCase()}
                  </div>
                ))}
              </div>
            )}

            {/* Divider */}
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />

            {/* 🖊 Draw button */}
            <button
              id="draw-btn"
              onClick={() => setDrawingOpen(true)}
              title="Open drawing canvas"
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Draw
            </button>

            {/* 🖼 Image gallery button */}
            <button
              id="gallery-btn"
              onClick={() => setGalleryOpen(true)}
              title="Insert image from gallery"
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Image
            </button>

            {/* File upload (PDF / any) */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            />
            <button
              id="upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload a file (image or PDF)"
              className={`btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>

            {/* Version history */}
            {note?.versions?.length > 0 && (
              <button
                id="history-btn"
                onClick={() => setHistoryOpen(true)}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History ({note.versions.length})
              </button>
            )}

            {/* Share (owner only) */}
            {isOwner && (
              <button
                id="share-btn"
                onClick={() => setShareOpen(true)}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Title bar ── */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto">
          <input
            id="note-title"
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Note title…"
            className="w-full text-2xl font-bold bg-transparent text-gray-900 dark:text-white
                       placeholder-gray-300 dark:placeholder-gray-700 outline-none border-none"
          />
        </div>
      </div>

      {/* ── Editor panes ── */}
      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto">

        {/* Write pane */}
        {(view === 'write' || view === 'split') && (
          <div className={`flex flex-col ${view === 'split' ? 'w-1/2 border-r border-gray-200 dark:border-gray-800' : 'w-full'}`}>
            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Markdown</span>
              <span className="text-xs text-gray-300 dark:text-gray-600">Drop images here to upload</span>
            </div>
            <textarea
              id="note-content"
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              placeholder={`Start writing in markdown…\n\n# Heading 1\n## Heading 2\n\n**Bold**, *italic*, \`code\`\n\n- List item 1\n- List item 2\n\n> Blockquote\n\n\`\`\`js\nconsole.log('Hello!');\n\`\`\``}
              className={`flex-1 p-5 resize-none bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100
                         font-mono text-sm leading-relaxed outline-none border-none
                         placeholder-gray-300 dark:placeholder-gray-700 transition-colors
                         ${draggingOver ? 'bg-brand-50 dark:bg-brand-950/20 ring-2 ring-inset ring-brand-400' : ''}`}
            />
          </div>
        )}

        {/* Preview pane */}
        {(view === 'preview' || view === 'split') && (
          <div className={`flex flex-col ${view === 'split' ? 'w-1/2' : 'w-full'}`}>
            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Preview</span>
            </div>
            <div className="flex-1 p-5 overflow-y-auto bg-white dark:bg-gray-950">
              {content ? (
                <div className="prose-custom">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-gray-300 dark:text-gray-700 italic text-sm">Preview will appear here…</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Collaborators footer bar */}
      {note?.collaborators?.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Collaborators:</span>
            {note.collaborators.map((c) => (
              <span key={c._id} className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">
                {c.username}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Share Modal ── */}
      {shareOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Share Note</h3>
              <button onClick={() => setShareOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {note?.collaborators?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                  Current collaborators
                </p>
                <div className="flex flex-wrap gap-2">
                  {note.collaborators.map((c) => (
                    <span key={c._id} className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm px-3 py-1 rounded-full">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                        {c.username?.[0]?.toUpperCase()}
                      </div>
                      {c.username}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <form id="share-form" onSubmit={handleShare} className="flex gap-2">
              <input
                id="share-input"
                type="text"
                value={shareInput}
                onChange={(e) => setShareInput(e.target.value)}
                placeholder="Email or username"
                className="input flex-1"
                required
              />
              <button id="share-submit" type="submit" disabled={shareLoading} className="btn-primary shrink-0">
                {shareLoading ? 'Adding…' : 'Add'}
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-2">Enter the exact email or username of the person to invite.</p>
          </div>
        </div>
      )}

      {/* ── Version History Drawer ── */}
      {historyOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:justify-end z-50">
          <div className="glass w-full sm:w-96 h-[70vh] sm:h-full sm:max-h-screen rounded-t-2xl sm:rounded-none sm:rounded-l-2xl flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Version History</h3>
              <button onClick={() => setHistoryOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {[...(note?.versions || [])].reverse().map((v, idx) => (
                <div key={idx} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Version {note.versions.length - idx}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(v.savedAt).toLocaleString()} · {v.savedBy?.username || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2 font-mono">
                        {v.content?.slice(0, 100) || '(empty)'}…
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestoreVersion(note.versions.length - 1 - idx)}
                      className="btn-secondary text-xs py-1 px-2.5 shrink-0"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Image Gallery Modal ── */}
      {galleryOpen && (
        <ImageGalleryModal
          onInsert={handleInsertImage}
          onClose={() => setGalleryOpen(false)}
        />
      )}

      {/* ── Drawing Canvas ── */}
      {drawingOpen && (
        <DrawingCanvas
          onInsert={handleInsertDrawing}
          onClose={() => setDrawingOpen(false)}
        />
      )}
    </div>
  );
};

export default Editor;
