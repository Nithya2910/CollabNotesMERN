package com.collabnotes.controller;

import com.collabnotes.dto.LoginRequest;
import com.collabnotes.dto.SignupRequest;
import com.collabnotes.model.User;
import com.collabnotes.repository.UserRepository;
import com.collabnotes.service.authservice.AuthService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/signup")
    public ResponseEntity<?> registerUser(@Valid @RequestBody SignupRequest request) {
        try {
            return ResponseEntity.status(201).body(authService.registerUser(request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest request) {
        try {
            return ResponseEntity.ok(authService.authenticateUser(request));
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(Map.of("message", e.getMessage()));
        }
    }

    // FIX: Added missing /api/auth/me endpoint that frontend calls
    @GetMapping("/me")
    public ResponseEntity<?> getMe() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String email = auth.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(Map.of("user", Map.of(
                "id", user.getId(),
                "username", user.getUsername(),
                "email", user.getEmail()
        )));
    }
}
