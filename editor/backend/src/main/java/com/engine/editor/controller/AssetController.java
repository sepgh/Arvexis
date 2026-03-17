package com.engine.editor.controller;

import com.engine.editor.controller.dto.AddTagRequest;
import com.engine.editor.controller.dto.CompatibilityCheckRequest;
import com.engine.editor.controller.dto.CompatibilityCheckResponse;
import com.engine.editor.controller.dto.ScanResultResponse;
import com.engine.editor.model.Asset;
import com.engine.editor.service.AssetCompatibilityChecker;
import com.engine.editor.service.AssetService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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

    @PostMapping("/assets/compatibility-check")
    public ResponseEntity<CompatibilityCheckResponse> checkCompatibility(
        @RequestBody CompatibilityCheckRequest req
    ) {
        return ResponseEntity.ok(compatibilityChecker.check(req.assetIds()));
    }
}
