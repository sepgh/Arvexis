package io.github.sepgh.arvexis.editor.controller;

import io.github.sepgh.arvexis.editor.service.CompileService;
import io.github.sepgh.arvexis.editor.service.ManifestService;
import io.github.sepgh.arvexis.editor.preview.PreviewJob;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

@RestController
@RequestMapping("/api/compile")
public class CompileController {

    private final ManifestService manifestService;
    private final CompileService   compileService;

    public CompileController(ManifestService manifestService, CompileService compileService) {
        this.manifestService = manifestService;
        this.compileService  = compileService;
    }

    @PostMapping({"run", "start"})
    public ResponseEntity<Map<String, Object>> startCompile() {
        PreviewJob job = compileService.startCompilation();
        return ResponseEntity.accepted().body(Map.of(
            "jobId",      job.getId(),
            "status",     job.getStatus().name().toLowerCase(),
            "progress",   job.getProgress(),
            "statusText", job.getStatusText(),
            "statusUrl",  "/api/preview/status/" + job.getId()
        ));
    }

    @GetMapping("/download")
    public ResponseEntity<Resource> downloadPackage() throws Exception {
        Path zip = compileService.getLastZipPath();
        if (zip == null || !Files.exists(zip))
            return ResponseEntity.notFound().build();
        String filename = zip.getFileName().toString();
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .body(new FileSystemResource(zip));
    }

    @PostMapping("/manifest")
    public ResponseEntity<Map<String, Object>> generateManifest() {
        Path file = manifestService.generateManifest();
        return ResponseEntity.ok(Map.of(
            "message", "Manifest generated successfully",
            "path",    file.toAbsolutePath().toString(),
            "downloadUrl", "/api/compile/manifest"
        ));
    }

    @GetMapping("/manifest")
    public ResponseEntity<Resource> downloadManifest() {
        Path file = manifestService.requireManifestFile();
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"manifest.json\"")
            .contentType(MediaType.APPLICATION_JSON)
            .body(new FileSystemResource(file));
    }
}
