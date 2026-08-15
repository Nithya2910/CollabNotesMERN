package com.collabnotes.service.uploadservice;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class UploadService {

    private static final String UPLOAD_DIR = "uploads/";
    private static final List<String> IMAGE_EXTS = List.of(".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg");

    public String uploadFile(MultipartFile file) throws IOException {
        Path uploadPath = Paths.get(UPLOAD_DIR);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }
        String filename = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path filePath = uploadPath.resolve(filename);
        Files.copy(file.getInputStream(), filePath);
        return "/uploads/" + filename;
    }

    // FIX: Added getAllImageUrls to support the GET /api/uploads/images endpoint
    public List<String> getAllImageUrls() {
        Path uploadPath = Paths.get(UPLOAD_DIR);
        if (!Files.exists(uploadPath)) return new ArrayList<>();
        try (Stream<Path> files = Files.list(uploadPath)) {
            return files
                    .filter(p -> IMAGE_EXTS.stream()
                            .anyMatch(ext -> p.toString().toLowerCase().endsWith(ext)))
                    .map(p -> "/uploads/" + p.getFileName().toString())
                    .collect(Collectors.toList());
        } catch (IOException e) {
            return new ArrayList<>();
        }
    }
}
