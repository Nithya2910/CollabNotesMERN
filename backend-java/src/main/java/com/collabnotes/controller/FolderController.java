package com.collabnotes.controller;

import com.collabnotes.model.Folder;
import com.collabnotes.model.User;
import com.collabnotes.repository.UserRepository;
import com.collabnotes.service.folderservice.FolderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/folders")
public class FolderController {

    @Autowired
    private FolderService folderService;

    @Autowired
    private UserRepository userRepository;

    // ── Helper ─────────────────────────────────────────────────────────────
    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    // GET /api/folders — FIX: was @RequestParam String ownerId
    @GetMapping
    public ResponseEntity<?> getFolders() {
        User user = getCurrentUser();
        return ResponseEntity.ok(Map.of("folders", folderService.getFoldersByOwner(user.getId())));
    }

    @PostMapping
    public ResponseEntity<?> createFolder(@RequestBody Map<String, String> body) {
        User user = getCurrentUser();
        String name = body.get("name");
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Folder name is required"));
        }
        Folder folder = new Folder();
        folder.setName(name);
        folder.setOwner(user);
        return ResponseEntity.status(201).body(Map.of("folder", folderService.createFolder(folder)));
    }

    // FIX: Added missing PUT /api/folders/:id that frontend calls
    @PutMapping("/{id}")
    public ResponseEntity<?> updateFolder(@PathVariable String id, @RequestBody Map<String, String> body) {
        User user = getCurrentUser();
        Optional<Folder> folderOpt = folderService.getFolderById(id);
        if (folderOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("message", "Folder not found"));
        }
        Folder folder = folderOpt.get();
        if (!folder.getOwner().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("message", "Access denied"));
        }
        String name = body.get("name");
        if (name != null && !name.isBlank()) {
            folder.setName(name);
        }
        return ResponseEntity.ok(Map.of("folder", folderService.createFolder(folder)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteFolder(@PathVariable String id) {
        User user = getCurrentUser();
        Optional<Folder> folderOpt = folderService.getFolderById(id);
        if (folderOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("message", "Folder not found"));
        }
        if (!folderOpt.get().getOwner().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("message", "Access denied"));
        }
        folderService.deleteFolder(id);
        return ResponseEntity.ok(Map.of("message", "Folder deleted successfully"));
    }
}
