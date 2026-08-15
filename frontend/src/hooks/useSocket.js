import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../socket/socket';

/**
 * useSocket — custom hook for Socket.IO integration in note editor.
 *
 * @param {string} noteId - The note ID to join as a room
 * @param {object} callbacks - Event handler callbacks
 * @param {Function} callbacks.onNoteUpdated - Called when remote content arrives
 * @param {Function} callbacks.onActiveUsers - Called when active users list changes
 * @param {Function} callbacks.onUserTyping - Called when someone starts typing
 * @param {Function} callbacks.onUserStoppedTyping - Called when someone stops typing
 */
const useSocket = (noteId, callbacks = {}) => {
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const {
    onNoteUpdated,
    onActiveUsers,
    onUserTyping,
    onUserStoppedTyping,
  } = callbacks;

  useEffect(() => {
    if (!noteId) return;

    const socket = getSocket();
    socketRef.current = socket;

    // Join the note's dedicated room
    socket.emit('join-note', noteId);

    // ── Register event listeners ──────────────────────────────────────
    if (onNoteUpdated)       socket.on('note-updated',          onNoteUpdated);
    if (onActiveUsers)       socket.on('active-users',          onActiveUsers);
    if (onUserTyping)        socket.on('user-typing',           onUserTyping);
    if (onUserStoppedTyping) socket.on('user-stopped-typing',   onUserStoppedTyping);

    return () => {
      // Leave room and clean up listeners on unmount
      socket.emit('leave-note', noteId);
      socket.off('note-updated');
      socket.off('active-users');
      socket.off('user-typing');
      socket.off('user-stopped-typing');
    };
  }, [noteId]); // Re-run if noteId changes

  /** Emit content update to room peers */
  const emitUpdate = useCallback((content, title) => {
    if (!socketRef.current || !noteId) return;
    socketRef.current.emit('note-update', { noteId, content, title });
  }, [noteId]);

  /** Emit typing indicator with auto-stop after 2 seconds of silence */
  const emitTyping = useCallback(() => {
    if (!socketRef.current || !noteId) return;

    socketRef.current.emit('typing-start', noteId);

    // Clear any existing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Auto-emit stop after 2 seconds of no typing
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing-stop', noteId);
    }, 2000);
  }, [noteId]);

  /** Emit cursor position */
  const emitCursor = useCallback((position) => {
    if (!socketRef.current || !noteId) return;
    socketRef.current.emit('cursor-move', { noteId, position });
  }, [noteId]);

  return { emitUpdate, emitTyping, emitCursor };
};

export default useSocket;
