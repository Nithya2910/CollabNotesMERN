package com.collabnotes.service.authservice;

import com.collabnotes.dto.JwtResponse;
import com.collabnotes.dto.LoginRequest;
import com.collabnotes.dto.SignupRequest;
import com.collabnotes.model.User;
import com.collabnotes.repository.UserRepository;
import com.collabnotes.security.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtils jwtUtils;

    public JwtResponse registerUser(SignupRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Username is already taken!");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email is already in use!");
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail().toLowerCase());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        userRepository.save(user);

        String token = jwtUtils.generateToken(user.getEmail());
        return new JwtResponse("Account created successfully", token,
                new JwtResponse.UserDto(user.getId(), user.getUsername(), user.getEmail()));
    }

    public JwtResponse authenticateUser(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail().toLowerCase())
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid email or password");
        }

        String token = jwtUtils.generateToken(user.getEmail());
        return new JwtResponse("Login successful", token,
                new JwtResponse.UserDto(user.getId(), user.getUsername(), user.getEmail()));
    }
}
