package com.engine.editor.controller;

import com.engine.editor.controller.dto.ConditionRequest;
import com.engine.editor.service.ConditionNodeService;
import com.engine.editor.service.ConditionNodeService.ConditionDataResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/nodes/{id}/condition")
public class ConditionNodeController {

    private final ConditionNodeService conditionNodeService;

    public ConditionNodeController(ConditionNodeService conditionNodeService) {
        this.conditionNodeService = conditionNodeService;
    }

    @GetMapping
    public ResponseEntity<ConditionDataResponse> getCondition(@PathVariable String id) {
        return ResponseEntity.ok(conditionNodeService.getConditionData(id));
    }

    @PutMapping("/conditions")
    public ResponseEntity<ConditionDataResponse> saveConditions(
        @PathVariable String id,
        @RequestBody List<ConditionRequest> conditions
    ) {
        return ResponseEntity.ok(conditionNodeService.saveConditions(id, conditions));
    }
}
