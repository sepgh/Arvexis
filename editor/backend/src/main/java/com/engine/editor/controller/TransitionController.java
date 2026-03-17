package com.engine.editor.controller;

import com.engine.editor.controller.dto.AudioTrackRequest;
import com.engine.editor.controller.dto.VideoLayerRequest;
import com.engine.editor.service.TransitionService;
import com.engine.editor.service.TransitionService.TransitionResponse;
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
}
