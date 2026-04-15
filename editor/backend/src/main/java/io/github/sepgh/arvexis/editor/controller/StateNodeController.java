package io.github.sepgh.arvexis.editor.controller;

import io.github.sepgh.arvexis.editor.controller.dto.AssignmentRequest;
import io.github.sepgh.arvexis.editor.service.StateNodeService;
import io.github.sepgh.arvexis.editor.service.StateNodeService.StateDataResponse;
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
