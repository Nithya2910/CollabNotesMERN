package com.collabnotes.controller;

import com.collabnotes.model.Note;
import com.collabnotes.model.User;
import com.collabnotes.repository.FolderRepository;
import com.collabnotes.repository.UserRepository;
import com.collabnotes.service.noteservice.NoteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    @Autowired
    private NoteService noteService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FolderRepository folderRepository;

    // ── Helper: get the authenticated user from the JWT principal ─────────
    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    // GET /api/notes — FIX: was @RequestParam String userId (frontend never sends it)
    @GetMapping
    public ResponseEntity<?> getNotes() {
        User user = getCurrentUser();
        return ResponseEntity.ok(Map.of("notes", noteService.getUserNotes(user.getId())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getNoteById(@PathVariable String id) {
        User user = getCurrentUser();
        Optional<Note> noteOpt = noteService.getNoteById(id);
        if (noteOpt.isEmpty() || noteOpt.get().isDeleted()) {
            return ResponseEntity.status(404).body(Map.of("message", "Note not found"));
        }
        Note note = noteOpt.get();
        if (!noteService.hasAccess(note, user.getId())) {
            return ResponseEntity.status(403).body(Map.of("message", "Access denied"));
        }
        return ResponseEntity.ok(Map.of("note", note));
    }

    @PostMapping
    public ResponseEntity<?> createNote(@RequestBody Map<String, Object> body) {
        User user = getCurrentUser();
        Note note = new Note();
        note.setTitle((String) body.getOrDefault("title", "Untitled Note"));
        note.setContent((String) body.getOrDefault("content", ""));
        note.setOwner(user);

        if (body.containsKey("folder") && body.get("folder") != null) {
            String folderId = (String) body.get("folder");
            folderRepository.findById(folderId).ifPresent(note::setFolder);
        }

        return ResponseEntity.status(201).body(Map.of("note", noteService.createNote(note)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateNote(@PathVariable String id, @RequestBody Map<String, Object> body) {
        User user = getCurrentUser();
        Optional<Note> noteOpt = noteService.getNoteById(id);
        if (noteOpt.isEmpty() || noteOpt.get().isDeleted()) {
            return ResponseEntity.status(404).body(Map.of("message", "Note not found"));
        }
        Note note = noteOpt.get();
        if (!noteService.hasAccess(note, user.getId())) {
            return ResponseEntity.status(403).body(Map.of("message", "Access denied"));
        }
        return ResponseEntity.ok(Map.of("note", noteService.updateNote(note, body, user)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteNote(@PathVariable String id) {
        User user = getCurrentUser();
        Optional<Note> noteOpt = noteService.getNoteById(id);
        if (noteOpt.isEmpty() || noteOpt.get().isDeleted()) {
            return ResponseEntity.status(404).body(Map.of("message", "Note not found"));
        }
        Note note = noteOpt.get();
        if (!note.getOwner().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("message", "Only the owner can delete this note"));
        }
        noteService.softDeleteNote(id);
        return ResponseEntity.ok(Map.of("message", "Note deleted successfully"));
    }

    // FIX: Added missing /api/notes/:id/share endpoint
    @PostMapping("/{id}/share")
    public ResponseEntity<?> shareNote(@PathVariable String id, @RequestBody Map<String, String> body) {
        User user = getCurrentUser();
        String identifier = body.get("identifier");
        if (identifier == null || identifier.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email or username is required"));
        }
        try {
            return ResponseEntity.ok(noteService.shareNote(id, identifier, user));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // FIX: Added missing /api/notes/:id/restore endpoint
    @PostMapping("/{id}/restore")
    public ResponseEntity<?> restoreVersion(@PathVariable String id, @RequestBody Map<String, Integer> body) {
        User user = getCurrentUser();
        Integer versionIndex = body.get("versionIndex");
        if (versionIndex == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Version index is required"));
        }
        try {
            return ResponseEntity.ok(Map.of("note", noteService.restoreVersion(id, versionIndex, user)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
