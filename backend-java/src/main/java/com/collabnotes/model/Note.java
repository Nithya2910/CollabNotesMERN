package com.collabnotes.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.index.TextIndexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "notes")
public class Note {

    @Id
    @JsonProperty("_id")
    private String id;

    @TextIndexed
    private String title;

    private String content;

    @DBRef
    @Indexed
    private User owner;

    @DBRef
    @Indexed
    private List<User> collaborators = new ArrayList<>();

    // FIX: @DBRef is NOT supported inside embedded documents in Spring Data MongoDB.
    // Version is an embedded object; savedBy is stored as a plain userId String.
    private List<Version> versions = new ArrayList<>();

    @DBRef
    private Folder folder;

    private boolean isDeleted = false;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Note() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    // ── Embedded Version class (no @DBRef inside!) ────────────────────────
    public static class Version {
        private String content;
        // Store only the user's id as a String to avoid @DBRef-in-embedded limitation
        private String savedByUserId;
        private String savedByUsername;
        private LocalDateTime savedAt = LocalDateTime.now();

        public Version() {}

        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }

        public String getSavedByUserId() { return savedByUserId; }
        public void setSavedByUserId(String savedByUserId) { this.savedByUserId = savedByUserId; }

        public String getSavedByUsername() { return savedByUsername; }
        public void setSavedByUsername(String savedByUsername) { this.savedByUsername = savedByUsername; }

        public LocalDateTime getSavedAt() { return savedAt; }
        public void setSavedAt(LocalDateTime savedAt) { this.savedAt = savedAt; }
    }

    // ── Getters & Setters ─────────────────────────────────────────────────

    public String getId() { return id; }

    // Alias so JSON contains both 'id' and '_id'
    @JsonProperty("id")
    public String getIdAlias() { return id; }

    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }

    public List<User> getCollaborators() { return collaborators; }
    public void setCollaborators(List<User> collaborators) { this.collaborators = collaborators; }

    public List<Version> getVersions() { return versions; }
    public void setVersions(List<Version> versions) { this.versions = versions; }

    public Folder getFolder() { return folder; }
    public void setFolder(Folder folder) { this.folder = folder; }

    public boolean isDeleted() { return isDeleted; }
    public void setDeleted(boolean deleted) { isDeleted = deleted; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
