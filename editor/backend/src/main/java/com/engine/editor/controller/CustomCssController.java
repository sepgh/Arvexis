package com.engine.editor.controller;

import com.engine.editor.service.ProjectService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

/**
 * Manage the project's custom.css file for runtime UI customization.
 */
@RestController
@RequestMapping("/api/custom-css")
public class CustomCssController {

    private final ProjectService projectService;

    public CustomCssController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @GetMapping(produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getCustomCss() throws IOException {
        Path cssFile = cssPath();
        if (Files.exists(cssFile)) {
            return ResponseEntity.ok(Files.readString(cssFile, StandardCharsets.UTF_8));
        }
        return ResponseEntity.ok("");
    }

    @PutMapping(consumes = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<Map<String, Object>> saveCustomCss(@RequestBody String content) throws IOException {
        Path cssFile = cssPath();
        Files.writeString(cssFile, content, StandardCharsets.UTF_8);
        return ResponseEntity.ok(Map.of(
            "message", "custom.css saved",
            "path", cssFile.toAbsolutePath().toString()
        ));
    }

    private Path cssPath() {
        return projectService.getCurrentProjectPath().resolve("custom.css");
    }
}
