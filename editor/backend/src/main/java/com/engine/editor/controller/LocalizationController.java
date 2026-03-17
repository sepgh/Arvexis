package com.engine.editor.controller;

import com.engine.editor.service.LocalizationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class LocalizationController {

    private final LocalizationService localizationService;

    public LocalizationController(LocalizationService localizationService) {
        this.localizationService = localizationService;
    }

    // ── Locales ───────────────────────────────────────────────────────────────

    @GetMapping("/api/locales")
    public ResponseEntity<List<Map<String, Object>>> listLocales() {
        return ResponseEntity.ok(localizationService.listLocales());
    }

    @PostMapping("/api/locales")
    public ResponseEntity<Map<String, Object>> addLocale(@RequestBody Map<String, String> body) {
        String code = required(body, "code");
        String name = required(body, "name");
        return ResponseEntity.ok(localizationService.addLocale(code, name));
    }

    @DeleteMapping("/api/locales/{code}")
    public ResponseEntity<Map<String, Object>> deleteLocale(@PathVariable String code) {
        localizationService.deleteLocale(code);
        return ResponseEntity.ok(Map.of("deleted", code));
    }

    // ── Subtitles ─────────────────────────────────────────────────────────────

    @GetMapping("/api/subtitles")
    public ResponseEntity<List<Map<String, Object>>> getSubtitles(
            @RequestParam(required = false) String sceneId,
            @RequestParam(required = false) String locale) {
        return ResponseEntity.ok(localizationService.getSubtitles(sceneId, locale));
    }

    @PostMapping("/api/subtitles")
    public ResponseEntity<Map<String, Object>> upsertSubtitle(@RequestBody Map<String, Object> body) {
        String id         = (String) body.get("id");
        String sceneId    = requiredStr(body, "sceneId");
        String localeCode = requiredStr(body, "localeCode");
        double startTime  = toDouble(body.get("startTime"));
        double endTime    = toDouble(body.get("endTime"));
        String text       = requiredStr(body, "text");
        return ResponseEntity.ok(
            localizationService.upsertSubtitle(id, sceneId, localeCode, startTime, endTime, text));
    }

    @DeleteMapping("/api/subtitles/{id}")
    public ResponseEntity<Map<String, Object>> deleteSubtitle(@PathVariable String id) {
        localizationService.deleteSubtitle(id);
        return ResponseEntity.ok(Map.of("deleted", id));
    }

    // ── Decision translations ─────────────────────────────────────────────────

    @GetMapping("/api/decision-translations")
    public ResponseEntity<List<Map<String, Object>>> getDecisionTranslations(
            @RequestParam(required = false) String sceneId,
            @RequestParam(required = false) String locale) {
        return ResponseEntity.ok(localizationService.getDecisionTranslations(sceneId, locale));
    }

    @PostMapping("/api/decision-translations")
    public ResponseEntity<Map<String, Object>> upsertDecisionTranslation(
            @RequestBody Map<String, Object> body) {
        String id          = (String) body.get("id");
        String decisionKey = requiredStr(body, "decisionKey");
        String sceneId     = requiredStr(body, "sceneId");
        String localeCode  = requiredStr(body, "localeCode");
        String label       = requiredStr(body, "label");
        return ResponseEntity.ok(
            localizationService.upsertDecisionTranslation(id, decisionKey, sceneId, localeCode, label));
    }

    @DeleteMapping("/api/decision-translations/{id}")
    public ResponseEntity<Map<String, Object>> deleteDecisionTranslation(@PathVariable String id) {
        localizationService.deleteDecisionTranslation(id);
        return ResponseEntity.ok(Map.of("deleted", id));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String required(Map<String, String> body, String key) {
        String v = body.get(key);
        if (v == null || v.isBlank()) throw new IllegalArgumentException("Missing field: " + key);
        return v;
    }

    private String requiredStr(Map<String, Object> body, String key) {
        Object v = body.get(key);
        if (v == null || v.toString().isBlank()) throw new IllegalArgumentException("Missing field: " + key);
        return v.toString();
    }

    private double toDouble(Object val) {
        if (val == null) return 0;
        if (val instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(val.toString()); } catch (Exception e) { return 0; }
    }
}
