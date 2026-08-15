package com.collabnotes.controller;

import com.collabnotes.service.uploadservice.UploadService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/uploads")
public class UploadController {

    @Autowired
    private UploadService uploadService;

    // POST /api/uploads
    @PostMapping
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            String url = uploadService.uploadFile(file);
            return ResponseEntity.ok(Map.of("url", url));
        } catch (IOException e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("message", "File upload failed: " + e.getMessage()));
        }
    }

    // FIX: Added missing GET /api/uploads/images endpoint that frontend calls
    @GetMapping("/images")
    public ResponseEntity<Map<String, List<String>>> getImages() {
        List<String> images = uploadService.getAllImageUrls();
        return ResponseEntity.ok(Map.of("images", images));
    }
}
