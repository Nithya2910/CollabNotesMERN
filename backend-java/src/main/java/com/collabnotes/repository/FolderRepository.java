package com.collabnotes.repository;

import com.collabnotes.model.Folder;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FolderRepository extends MongoRepository<Folder, String> {
    // FIX: Derived query findByOwnerId() doesn't work with @DBRef fields.
    // Must use explicit @Query to match on the DBRef's $id field.
    @Query("{ 'owner.$id': ?0 }")
    List<Folder> findByOwnerId(String ownerId);
}
