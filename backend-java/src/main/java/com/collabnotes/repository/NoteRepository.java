package com.collabnotes.repository;

import com.collabnotes.model.Note;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NoteRepository extends MongoRepository<Note, String> {

    @Query("{ $and: [ { $or: [ { 'owner.$id': ?0 }, { 'collaborators.$id': ?0 } ] }, { 'isDeleted': false } ] }")
    List<Note> findUserNotes(ObjectId userId);
}
