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
import java.util.Set;

/**
 * Manage the project's custom CSS files for runtime UI customization.
 * Supports three files: custom.css (general), buttons.css, subtitles.css.
 */
@RestController
@RequestMapping("/api/custom-css")
public class CustomCssController {

    private static final Set<String> ALLOWED_FILES = Set.of("custom", "buttons", "subtitles");

    private final ProjectService projectService;

    public CustomCssController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @GetMapping(produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getCustomCss() throws IOException {
        return readCssFile("custom");
    }

    @PutMapping(consumes = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<Map<String, Object>> saveCustomCss(@RequestBody String content) throws IOException {
        return writeCssFile("custom", content);
    }

    @GetMapping(value = "/{name}", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getNamedCss(@PathVariable String name) throws IOException {
        if (!ALLOWED_FILES.contains(name)) return ResponseEntity.notFound().build();
        return readCssFile(name);
    }

    @PutMapping(value = "/{name}", consumes = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<Map<String, Object>> saveNamedCss(@PathVariable String name,
                                                             @RequestBody String content) throws IOException {
        if (!ALLOWED_FILES.contains(name)) return ResponseEntity.notFound().build();
        return writeCssFile(name, content);
    }

    private ResponseEntity<String> readCssFile(String name) throws IOException {
        Path cssFile = cssPath(name);
        if (Files.exists(cssFile)) {
            return ResponseEntity.ok(Files.readString(cssFile, StandardCharsets.UTF_8));
        }
        return ResponseEntity.ok("");
    }

    private ResponseEntity<Map<String, Object>> writeCssFile(String name, String content) throws IOException {
        Path cssFile = cssPath(name);
        Files.writeString(cssFile, content, StandardCharsets.UTF_8);
        return ResponseEntity.ok(Map.of(
            "message", name + ".css saved",
            "path", cssFile.toAbsolutePath().toString()
        ));
    }

    private Path cssPath(String name) {
        return projectService.getCurrentProjectPath().resolve(name + ".css");
    }
}
