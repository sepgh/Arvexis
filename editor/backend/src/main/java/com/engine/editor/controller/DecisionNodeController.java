package com.engine.editor.controller;

import com.engine.editor.controller.dto.ConditionRequest;
import com.engine.editor.service.DecisionNodeService;
import com.engine.editor.service.DecisionNodeService.DecisionDataResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/nodes/{id}/decision")
public class DecisionNodeController {

    private final DecisionNodeService decisionNodeService;

    public DecisionNodeController(DecisionNodeService decisionNodeService) {
        this.decisionNodeService = decisionNodeService;
    }

    @GetMapping
    public ResponseEntity<DecisionDataResponse> getDecision(@PathVariable String id) {
        return ResponseEntity.ok(decisionNodeService.getDecisionData(id));
    }

    @PutMapping("/conditions")
    public ResponseEntity<DecisionDataResponse> saveConditions(
        @PathVariable String id,
        @RequestBody List<ConditionRequest> conditions
    ) {
        return ResponseEntity.ok(decisionNodeService.saveConditions(id, conditions));
    }
}
