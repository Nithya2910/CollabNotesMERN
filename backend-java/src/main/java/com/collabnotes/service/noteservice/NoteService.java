package com.collabnotes.service.noteservice;

import com.collabnotes.model.Note;
import com.collabnotes.model.User;
import com.collabnotes.repository.FolderRepository;
import com.collabnotes.repository.NoteRepository;
import com.collabnotes.repository.UserRepository;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class NoteService {

    @Autowired
    private NoteRepository noteRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FolderRepository folderRepository;

    // ── Access control (mirrors hasAccess in Express noteController) ──────
    public boolean hasAccess(Note note, String userId) {
        if (note.getOwner() != null && note.getOwner().getId().equals(userId)) {
            return true;
        }
        if (note.getCollaborators() != null) {
            return note.getCollaborators().stream()
                    .anyMatch(c -> c.getId().equals(userId));
        }
        return false;
    }

    public List<Note> getUserNotes(String userId) {
        return noteRepository.findUserNotes(new ObjectId(userId));
    }

    public Optional<Note> getNoteById(String noteId) {
        return noteRepository.findById(noteId);
    }

    public Note createNote(Note note) {
        note.setCreatedAt(LocalDateTime.now());
        note.setUpdatedAt(LocalDateTime.now());
        return noteRepository.save(note);
    }

    // ── Update: apply title/content/folder changes + version history ──────
    public Note updateNote(Note note, Map<String, Object> body, User actor) {
        if (body.containsKey("title")) {
            note.setTitle((String) body.get("title"));
        }
        if (body.containsKey("content")) {
            String newContent = (String) body.get("content");
            // Save snapshot to version history before overwriting
            if (newContent != null && !newContent.equals(note.getContent())) {
                Note.Version v = new Note.Version();
                v.setContent(note.getContent());
                v.setSavedByUserId(actor.getId());
                v.setSavedByUsername(actor.getUsername());
                v.setSavedAt(LocalDateTime.now());
                note.getVersions().add(v);
                // Keep only last 10 versions
                if (note.getVersions().size() > 10) {
                    note.setVersions(note.getVersions().subList(
                            note.getVersions().size() - 10, note.getVersions().size()));
                }
            }
            note.setContent(newContent);
        }
        if (body.containsKey("folder")) {
            Object folderObj = body.get("folder");
            if (folderObj == null) {
                note.setFolder(null); // un-folder
            } else {
                String folderId = (String) folderObj;
                folderRepository.findById(folderId).ifPresent(note::setFolder);
            }
        }
        note.setUpdatedAt(LocalDateTime.now());
        return noteRepository.save(note);
    }

    public void softDeleteNote(String noteId) {
        noteRepository.findById(noteId).ifPresent(note -> {
            note.setDeleted(true);
            note.setUpdatedAt(LocalDateTime.now());
            noteRepository.save(note);
        });
    }

    // ── Share: add collaborator by email or username ───────────────────────
    public Map<String, Object> shareNote(String noteId, String identifier, User actor) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new RuntimeException("Note not found"));

        if (note.isDeleted()) throw new RuntimeException("Note not found");

        if (!note.getOwner().getId().equals(actor.getId())) {
            throw new RuntimeException("Only the owner can share this note");
        }

        User target = userRepository.findByEmail(identifier.toLowerCase())
                .or(() -> userRepository.findByUsername(identifier))
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (target.getId().equals(actor.getId())) {
            throw new RuntimeException("You cannot share a note with yourself");
        }

        boolean alreadyCollab = note.getCollaborators().stream()
                .anyMatch(c -> c.getId().equals(target.getId()));
        if (alreadyCollab) {
            throw new RuntimeException("User is already a collaborator");
        }

        note.getCollaborators().add(target);
        noteRepository.save(note);

        return Map.of(
                "message", "Note shared with " + target.getUsername(),
                "collaborators", note.getCollaborators()
        );
    }

    // ── Restore: roll back to a previous version by index ─────────────────
    public Note restoreVersion(String noteId, int versionIndex, User actor) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new RuntimeException("Note not found"));

        if (note.isDeleted()) throw new RuntimeException("Note not found");
        if (!hasAccess(note, actor.getId())) throw new RuntimeException("Access denied");

        List<Note.Version> versions = note.getVersions();
        if (versionIndex < 0 || versionIndex >= versions.size()) {
            throw new RuntimeException("Version not found");
        }

        Note.Version target = versions.get(versionIndex);

        // Save current content as a new version snapshot
        Note.Version snapshot = new Note.Version();
        snapshot.setContent(note.getContent());
        snapshot.setSavedByUserId(actor.getId());
        snapshot.setSavedByUsername(actor.getUsername());
        snapshot.setSavedAt(LocalDateTime.now());
        note.getVersions().add(snapshot);

        note.setContent(target.getContent());

        if (note.getVersions().size() > 10) {
            note.setVersions(note.getVersions().subList(
                    note.getVersions().size() - 10, note.getVersions().size()));
        }

        note.setUpdatedAt(LocalDateTime.now());
        return noteRepository.save(note);
    }
}
