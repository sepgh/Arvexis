package com.engine.editor.controller;

import com.engine.editor.controller.dto.AssignmentRequest;
import com.engine.editor.service.StateNodeService;
import com.engine.editor.service.StateNodeService.StateDataResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/nodes/{id}/state")
public class StateNodeController {

    private final StateNodeService stateNodeService;

    public StateNodeController(StateNodeService stateNodeService) {
        this.stateNodeService = stateNodeService;
    }

    @GetMapping
    public ResponseEntity<StateDataResponse> getState(@PathVariable String id) {
        return ResponseEntity.ok(stateNodeService.getStateData(id));
    }

    @PutMapping("/assignments")
    public ResponseEntity<StateDataResponse> saveAssignments(
        @PathVariable String id,
        @RequestBody List<AssignmentRequest> assignments
    ) {
        return ResponseEntity.ok(stateNodeService.saveAssignments(id, assignments));
    }
}
