package io.github.sepgh.arvexis.editor.controller;

import io.github.sepgh.arvexis.editor.controller.dto.AmbientConfigRequest;
import io.github.sepgh.arvexis.editor.controller.dto.AudioTrackRequest;
import io.github.sepgh.arvexis.editor.controller.dto.VideoLayerRequest;
import io.github.sepgh.arvexis.editor.service.TransitionService;
import io.github.sepgh.arvexis.editor.service.TransitionService.TransitionResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/edges/{id}/transition")
public class TransitionController {

    private final TransitionService transitionService;

    public TransitionController(TransitionService transitionService) {
        this.transitionService = transitionService;
    }

    @GetMapping
    public ResponseEntity<TransitionResponse> get(@PathVariable String id) {
        return ResponseEntity.ok(transitionService.getTransition(id));
    }

    @PutMapping
    public ResponseEntity<TransitionResponse> setType(
        @PathVariable String id,
        @RequestBody Map<String, Object> body
    ) {
        String type = (String) body.get("type");
        Double duration = body.get("duration") != null
            ? ((Number) body.get("duration")).doubleValue() : null;
        return ResponseEntity.ok(transitionService.setTransitionType(id, type, duration));
    }

    @PutMapping("/layers")
    public ResponseEntity<TransitionResponse> saveLayers(
        @PathVariable String id,
        @RequestBody List<VideoLayerRequest> layers
    ) {
        return ResponseEntity.ok(transitionService.saveVideoLayers(id, layers));
    }

    @PutMapping("/audio")
    public ResponseEntity<TransitionResponse> saveAudio(
        @PathVariable String id,
        @RequestBody List<AudioTrackRequest> tracks
    ) {
        return ResponseEntity.ok(transitionService.saveAudioTracks(id, tracks));
    }

    @PutMapping("/background-color")
    public ResponseEntity<TransitionResponse> setBackgroundColor(
        @PathVariable String id,
        @RequestBody Map<String, String> body
    ) {
        return ResponseEntity.ok(transitionService.setBackgroundColor(id, body.get("backgroundColor")));
    }

    @PutMapping("/ambient")
    public ResponseEntity<TransitionResponse> setAmbient(
        @PathVariable String id,
        @RequestBody AmbientConfigRequest body
    ) {
        return ResponseEntity.ok(transitionService.setAmbientConfig(id, body));
    }
}
