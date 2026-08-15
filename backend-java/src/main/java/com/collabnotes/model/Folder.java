package com.collabnotes.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DBRef;

import java.time.LocalDateTime;

@Document(collection = "folders")
public class Folder {

    @Id
    @JsonProperty("_id")
    private String id;

    private String name;

    @DBRef
    @Indexed
    private User owner;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Folder() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public String getId() {
        return id;
    }

    // Alias so JSON contains both 'id' and '_id'
    @JsonProperty("id")
    public String getIdAlias() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public User getOwner() {
        return owner;
    }

    public void setOwner(User owner) {
        this.owner = owner;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
