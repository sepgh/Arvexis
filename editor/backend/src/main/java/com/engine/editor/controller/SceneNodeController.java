package com.engine.editor.controller;

import com.engine.editor.controller.dto.AudioTrackRequest;
import com.engine.editor.controller.dto.DecisionItemRequest;
import com.engine.editor.controller.dto.VideoLayerRequest;
import com.engine.editor.service.SceneNodeService;
import com.engine.editor.service.SceneNodeService.SceneDataResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/nodes/{id}/scene")
public class SceneNodeController {

    private final SceneNodeService sceneNodeService;

    public SceneNodeController(SceneNodeService sceneNodeService) {
        this.sceneNodeService = sceneNodeService;
    }

    @GetMapping
    public ResponseEntity<SceneDataResponse> getScene(@PathVariable String id) {
        return ResponseEntity.ok(sceneNodeService.getSceneData(id));
    }

    @PutMapping("/layers")
    public ResponseEntity<SceneDataResponse> saveLayers(
        @PathVariable String id,
        @RequestBody List<VideoLayerRequest> layers
    ) {
        return ResponseEntity.ok(sceneNodeService.saveVideoLayers(id, layers));
    }

    @PutMapping("/audio")
    public ResponseEntity<SceneDataResponse> saveAudio(
        @PathVariable String id,
        @RequestBody List<AudioTrackRequest> tracks
    ) {
        return ResponseEntity.ok(sceneNodeService.saveAudioTracks(id, tracks));
    }

    @PutMapping("/decisions")
    public ResponseEntity<SceneDataResponse> saveDecisions(
        @PathVariable String id,
        @RequestBody List<DecisionItemRequest> decisions
    ) {
        return ResponseEntity.ok(sceneNodeService.saveDecisions(id, decisions));
    }
}
