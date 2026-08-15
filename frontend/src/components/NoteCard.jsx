import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { notesAPI } from '../services/api';

/**
 * NoteCard — displays a note's summary with edit and delete actions.
 *
 * @param {object} note - The note object
 * @param {string} currentUserId - ID of the logged-in user
 * @param {Function} onDelete - Callback to remove note from parent state
 */
const NoteCard = ({ note, currentUserId, onDelete }) => {
  const navigate = useNavigate();
  const isOwner = note.owner?._id === currentUserId || note.owner === currentUserId;

  /* Truncate content for preview */
  const snippet = note.content
    ? note.content.replace(/[#*`>_~\[\]]/g, '').slice(0, 120) + (note.content.length > 120 ? '…' : '')
    : 'No content yet…';

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    try {
      await notesAPI.delete(note._id);
      onDelete(note._id);
      toast.success('Note deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete note');
    }
  };

  return (
    <div
      id={`note-card-${note._id}`}
      onClick={() => navigate(`/editor/${note._id}`)}
      className="group relative glass rounded-2xl p-5 cursor-pointer
                 hover:shadow-2xl hover:shadow-brand-500/10 hover:-translate-y-0.5
                 transition-all duration-200 animate-fade-in"
    >
      {/* Owner / Shared badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-base truncate group-hover:text-brand-500 transition-colors">
            {note.title || 'Untitled Note'}
          </h3>
        </div>
        <span className={`badge shrink-0 ${
          isOwner
            ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
        }`}>
          {isOwner ? 'Owner' : 'Shared'}
        </span>
      </div>

      {/* Content snippet */}
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3 mb-4">
        {snippet}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{timeAgo(note.updatedAt)}</span>
        </div>

        {/* Collaborator avatars */}
        {note.collaborators?.length > 0 && (
          <div className="flex -space-x-1.5">
            {note.collaborators.slice(0, 3).map((collab) => (
              <div
                key={collab._id}
                title={collab.username}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-500
                           flex items-center justify-center text-white text-xs font-bold
                           ring-2 ring-white dark:ring-gray-900"
              >
                {collab.username?.[0]?.toUpperCase()}
              </div>
            ))}
            {note.collaborators.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700
                             flex items-center justify-center text-gray-600 dark:text-gray-300
                             text-xs font-bold ring-2 ring-white dark:ring-gray-900">
                +{note.collaborators.length - 3}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons (visible on hover) */}
      <div
        className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          id={`edit-note-${note._id}`}
          onClick={() => navigate(`/editor/${note._id}`)}
          className="p-1.5 rounded-lg bg-white dark:bg-gray-800 shadow-md text-brand-500
                     hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
          title="Edit note"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        {isOwner && (
          <button
            id={`delete-note-${note._id}`}
            onClick={handleDelete}
            className="p-1.5 rounded-lg bg-white dark:bg-gray-800 shadow-md text-red-500
                       hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete note"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default NoteCard;
