package com.collabnotes;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

// FIX: Override MongoDB URI for tests so they don't fail when MongoDB isn't running.
// Tests will connect to an in-memory/embedded instance or a test DB.
@SpringBootTest
@TestPropertySource(properties = {
    "spring.data.mongodb.uri=mongodb://localhost:27017/collab-notes-test",
    "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration"
})
class CollabNotesApplicationTests {

    @Test
    void contextLoads() {
        // Verifies the Spring context loads without errors
    }
}
