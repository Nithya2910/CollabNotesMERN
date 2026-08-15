import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import NoteCard from '../components/NoteCard';
import { notesAPI, foldersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Dashboard — lists all notes with folder organisation, search, and tab filtering.
 */
const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Notes ──────────────────────────────────────────────────────────
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('mine');        // 'mine' | 'shared'
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  // ── Folders ────────────────────────────────────────────────────────
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null); // null = "All Notes"
  const [newFolderName, setNewFolderName] = useState('');
  const [folderInputOpen, setFolderInputOpen] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState(null); // {id, name}
  const folderInputRef = useRef(null);

  // ── Move note dropdown state ────────────────────────────────────────
  const [moveMenuNoteId, setMoveMenuNoteId] = useState(null);

  // ── Fetch notes + folders on mount ──────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [notesRes, foldersRes] = await Promise.all([
          notesAPI.getAll(),
          foldersAPI.getAll(),
        ]);
        // Defensive: accept both wrapped { notes: [] } and raw [] shapes
        const fetchedNotes   = notesRes.data?.notes   ?? notesRes.data   ?? [];
        const fetchedFolders = foldersRes.data?.folders ?? foldersRes.data ?? [];
        setNotes(Array.isArray(fetchedNotes)   ? fetchedNotes   : []);
        setFolders(Array.isArray(fetchedFolders) ? fetchedFolders : []);
      } catch {
        toast.error('Failed to load notes');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Focus folder name input when it appears
  useEffect(() => {
    if (folderInputOpen) folderInputRef.current?.focus();
  }, [folderInputOpen]);

  // Close move-menu when clicking outside
  useEffect(() => {
    const handler = () => setMoveMenuNoteId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // ── Create a new blank note ──────────────────────────────────────────
  const handleCreateNote = async () => {
    setCreating(true);
    try {
      const payload = { title: 'Untitled Note', content: '' };
      if (selectedFolder) payload.folder = selectedFolder;
      const { data } = await notesAPI.create(payload);
      // Spring Boot serializes @Id as 'id'; Node.js used '_id'. Accept either.
      const noteId = data.note?.id || data.note?._id;
      navigate(`/editor/${noteId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create note');
      setCreating(false);
    }
  };

  // ── Delete note from local state ─────────────────────────────────────
  const handleDeleteNote = (id) => {
    setNotes((prev) => prev.filter((n) => (n.id || n._id) !== id));
  };

  // ── Folder CRUD ──────────────────────────────────────────────────────
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const { data } = await foldersAPI.create({ name: newFolderName.trim() });
      setFolders((prev) => [...prev, data.folder]);
      setNewFolderName('');
      setFolderInputOpen(false);
      toast.success(`📁 "${data.folder.name}" created`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create folder');
    }
  };

  const handleRenameFolder = async (e, id) => {
    e.preventDefault();
    if (!renamingFolder?.name.trim()) return;
    try {
      const { data } = await foldersAPI.update(id, { name: renamingFolder.name.trim() });
      setFolders((prev) => prev.map((f) => ((f.id || f._id) === id ? data.folder : f)));
      setRenamingFolder(null);
    } catch {
      toast.error('Failed to rename folder');
    }
  };

  const handleDeleteFolder = async (id) => {
    try {
      await foldersAPI.delete(id);
      setFolders((prev) => prev.filter((f) => (f.id || f._id) !== id));
      // Un-folder notes that were in this folder
      setNotes((prev) => prev.map((n) => ((n.folder?.id || n.folder?._id || n.folder) === id ? { ...n, folder: null } : n)));
      if (selectedFolder === id) setSelectedFolder(null);
      toast.success('Folder deleted');
    } catch {
      toast.error('Failed to delete folder');
    }
  };

  // ── Move note to folder ───────────────────────────────────────────────
  const handleMoveNote = async (noteId, folderId, e) => {
    e.stopPropagation();
    setMoveMenuNoteId(null);
    try {
      await notesAPI.move(noteId, folderId);
      setNotes((prev) =>
        prev.map((n) => ((n.id || n._id) === noteId ? { ...n, folder: folderId } : n))
      );
      const folderName = folderId
        ? folders.find((f) => (f.id || f._id) === folderId)?.name
        : 'Unfiled';
      toast.success(`Moved to ${folderName}`);
    } catch {
      toast.error('Failed to move note');
    }
  };

  // ── Filter notes ─────────────────────────────────────────────────────
  const filteredNotes = useMemo(() => {
    // Guard: notes must be an array (avoids crash if API shape is unexpected)
    let result = Array.isArray(notes) ? notes : [];

    // Normalize: Spring Boot may return 'id' or '_id' — always use nId() helper
    const nId  = (n) => n.id || n._id;
    const ownId = (n) => n.owner?.id || n.owner?._id || n.owner;

    if (tab === 'mine') {
      result = result.filter((n) => ownId(n) === user?.id);
    } else {
      result = result.filter((n) => ownId(n) !== user?.id);
    }

    if (selectedFolder === 'unfiled') {
      result = result.filter((n) => !n.folder);
    } else if (selectedFolder) {
      result = result.filter((n) => {
        const fId = n.folder?.id || n.folder?._id || n.folder;
        return fId === selectedFolder;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((n) => n.title?.toLowerCase().includes(q));
    }

    return result;
  }, [notes, tab, search, user, selectedFolder]);

  const safeNotes   = Array.isArray(notes) ? notes : [];
  const myCount     = safeNotes.filter((n) => (n.owner?.id || n.owner?._id || n.owner) === user?.id).length;
  const sharedCount = safeNotes.filter((n) => (n.owner?.id || n.owner?._id || n.owner) !== user?.id).length;

  const activeFolderLabel = selectedFolder === 'unfiled'
    ? 'Unfiled'
    : selectedFolder
    ? folders.find((f) => (f.id || f._id) === selectedFolder)?.name || 'Folder'
    : 'All Notes';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-6">

        {/* ── Folder Sidebar ── */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 gap-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Folders</p>

          {/* All Notes */}
          <button
            id="folder-all"
            onClick={() => setSelectedFolder(null)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium w-full text-left transition-colors ${
              selectedFolder === null
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            All Notes
            <span className="ml-auto text-xs opacity-70">{notes.length}</span>
          </button>

          {/* Unfiled */}
          <button
            id="folder-unfiled"
            onClick={() => setSelectedFolder('unfiled')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium w-full text-left transition-colors ${
              selectedFolder === 'unfiled'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Unfiled
          </button>

          {/* Divider */}
          {folders.length > 0 && <div className="my-1 border-t border-gray-200 dark:border-gray-700" />}

          {/* User folders */}
          {folders.map((folder) => (
            <div key={folder.id || folder._id} className="group relative">
              {renamingFolder?.id === (folder.id || folder._id) ? (
                <form onSubmit={(e) => handleRenameFolder(e, folder.id || folder._id)} className="flex gap-1 px-2">
                  <input
                    autoFocus
                    value={renamingFolder.name}
                    onChange={(e) => setRenamingFolder({ ...renamingFolder, name: e.target.value })}
                    onBlur={() => setRenamingFolder(null)}
                    className="input text-xs py-1 flex-1 min-w-0"
                  />
                </form>
              ) : (
                <button
                  id={`folder-${folder.id || folder._id}`}
                  onClick={() => setSelectedFolder(folder.id || folder._id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium w-full text-left transition-colors ${
                    selectedFolder === (folder.id || folder._id)
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  <span className="truncate flex-1">{folder.name}</span>
                  {/* Edit / Delete icons on hover */}
                  <span className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    <span
                      role="button"
                      title="Rename"
                      onClick={(e) => { e.stopPropagation(); setRenamingFolder({ id: folder.id || folder._id, name: folder.name }); }}
                      className="p-0.5 rounded hover:bg-black/10"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </span>
                    <span
                      role="button"
                      title="Delete folder"
                      onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id || folder._id); }}
                      className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </span>
                  </span>
                </button>
              )}
            </div>
          ))}

          {/* New folder */}
          {folderInputOpen ? (
            <form onSubmit={handleCreateFolder} className="mt-1 flex gap-1 px-2">
              <input
                ref={folderInputRef}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name…"
                onBlur={() => { setFolderInputOpen(false); setNewFolderName(''); }}
                className="input text-xs py-1 flex-1 min-w-0"
              />
            </form>
          ) : (
            <button
              id="new-folder-btn"
              onClick={() => setFolderInputOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-brand-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full mt-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New folder
            </button>
          )}
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {activeFolderLabel}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-sm">
                {filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              id="create-note-btn"
              onClick={handleCreateNote}
              disabled={creating}
              className="btn-primary"
            >
              {creating ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
              New Note
            </button>
          </div>

          {/* Search bar */}
          <div className="relative mb-5">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="search-notes"
              type="text"
              placeholder="Search notes by title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 max-w-lg"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit mb-6">
            <button
              id="tab-mine"
              onClick={() => setTab('mine')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === 'mine'
                  ? 'bg-white dark:bg-gray-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              My Notes
              <span className="ml-2 text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded-full">
                {myCount}
              </span>
            </button>
            <button
              id="tab-shared"
              onClick={() => setTab('shared')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === 'shared'
                  ? 'bg-white dark:bg-gray-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Shared With Me
              <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-full">
                {sharedCount}
              </span>
            </button>
          </div>

          {/* Note grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass rounded-2xl p-5 h-40">
                  <div className="skeleton h-5 w-3/4 rounded-lg mb-3" />
                  <div className="skeleton h-3 w-full rounded mb-2" />
                  <div className="skeleton h-3 w-5/6 rounded mb-2" />
                  <div className="skeleton h-3 w-2/3 rounded" />
                </div>
              ))}
            </div>
          ) : filteredNotes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredNotes.map((note) => {
                const nId = note.id || note._id;
                const isNoteOwner = (note.owner?.id || note.owner?._id || note.owner) === user?.id;
                return (
                  <div key={nId} className="relative group">
                    <NoteCard
                      note={note}
                      currentUserId={user?.id}
                      onDelete={handleDeleteNote}
                    />
                    {/* Move to folder dropdown */}
                    {isNoteOwner && (
                      <div className="absolute top-3 right-10 z-10">
                        <button
                          id={`move-note-${nId}`}
                          title="Move to folder"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoveMenuNoteId((prev) => prev === nId ? null : nId);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand-600"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                          </svg>
                        </button>
                        {moveMenuNoteId === nId && (
                          <div
                            className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-20 animate-fade-in"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-xs text-gray-400 px-3 pt-2 pb-1 font-medium uppercase tracking-wider">Move to</p>
                            <button
                              onClick={(e) => handleMoveNote(nId, null, e)}
                              className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Unfiled
                            </button>
                            {folders.map((f) => {
                              const fId = f.id || f._id;
                              return (
                                <button
                                  key={fId}
                                  onClick={(e) => handleMoveNote(nId, fId, e)}
                                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                >
                                  <svg className="w-3.5 h-3.5 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                  </svg>
                                  <span className="truncate">{f.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          ) : (
            /* Empty state */
            <div className="text-center py-20">
              <div className="text-6xl mb-4">{tab === 'mine' ? '📝' : '🤝'}</div>
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {search
                  ? `No notes matching "${search}"`
                  : selectedFolder && selectedFolder !== 'unfiled'
                  ? `This folder is empty`
                  : tab === 'mine'
                  ? 'No notes yet'
                  : 'No shared notes'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                {!search && tab === 'mine' && 'Create your first note to get started.'}
              </p>
              {!search && tab === 'mine' && (
                <button onClick={handleCreateNote} className="btn-primary">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Note
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
