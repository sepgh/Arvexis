package io.github.sepgh.arvexis.editor.controller;

import io.github.sepgh.arvexis.editor.controller.dto.AddTagRequest;
import io.github.sepgh.arvexis.editor.controller.dto.CompatibilityCheckRequest;
import io.github.sepgh.arvexis.editor.controller.dto.CompatibilityCheckResponse;
import io.github.sepgh.arvexis.editor.controller.dto.ScanResultResponse;
import io.github.sepgh.arvexis.editor.model.Asset;
import io.github.sepgh.arvexis.editor.service.AssetCompatibilityChecker;
import io.github.sepgh.arvexis.editor.service.AssetService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class AssetController {

    private final AssetService assetService;
    private final AssetCompatibilityChecker compatibilityChecker;

    public AssetController(AssetService assetService, AssetCompatibilityChecker compatibilityChecker) {
        this.assetService = assetService;
        this.compatibilityChecker = compatibilityChecker;
    }

    @PostMapping("/assets/scan")
    public ResponseEntity<ScanResultResponse> scan() {
        return ResponseEntity.ok(assetService.scan());
    }

    @GetMapping("/assets")
    public ResponseEntity<List<Asset>> listAssets(
        @RequestParam(required = false) String directory,
        @RequestParam(required = false) String mediaType,
        @RequestParam(required = false) List<String> tags
    ) {
        return ResponseEntity.ok(assetService.listAssets(directory, mediaType, tags));
    }

    @GetMapping("/assets/{id}")
    public ResponseEntity<Asset> getAsset(@PathVariable String id) {
        return ResponseEntity.ok(assetService.getAsset(id));
    }

    @PostMapping("/assets/{id}/tags")
    public ResponseEntity<Asset> addTag(
        @PathVariable String id,
        @RequestBody AddTagRequest req
    ) {
        return ResponseEntity.ok(assetService.addTag(id, req.tag()));
    }

    @DeleteMapping("/assets/{id}/tags/{tag}")
    public ResponseEntity<Void> removeTag(
        @PathVariable String id,
        @PathVariable String tag
    ) {
        assetService.removeTag(id, tag);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/tags")
    public ResponseEntity<List<String>> listTags() {
        return ResponseEntity.ok(assetService.listAllTags());
    }

    @PostMapping("/assets/upload")
    public ResponseEntity<Asset> upload(
        @RequestParam("file")                       MultipartFile file,
        @RequestParam(value = "folder", required = false) String folder
    ) throws IOException {
        Asset created = assetService.uploadAsset(
            folder, file.getOriginalFilename(), file.getBytes());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/assets/folder")
    public ResponseEntity<Map<String, String>> createFolder(
        @RequestBody Map<String, String> body
    ) {
        String path = body.get("path");
        assetService.createFolder(path);
        return ResponseEntity.ok(Map.of("path", path));
    }

    @GetMapping("/assets/folders")
    public ResponseEntity<List<String>> listFolders() {
        return ResponseEntity.ok(assetService.listFolders());
    }

    @PostMapping("/assets/compatibility-check")
    public ResponseEntity<CompatibilityCheckResponse> checkCompatibility(
        @RequestBody CompatibilityCheckRequest req
    ) {
        return ResponseEntity.ok(compatibilityChecker.check(req.assetIds()));
    }
}
