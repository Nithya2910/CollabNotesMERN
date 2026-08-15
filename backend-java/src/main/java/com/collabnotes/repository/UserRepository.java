package com.collabnotes.repository;

import com.collabnotes.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);
    Optional<User> findByEmailOrUsername(String email, String username);
    Boolean existsByUsername(String username);
    Boolean existsByEmail(String email);
}
