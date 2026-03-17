package com.engine.editor.controller;

import com.engine.editor.controller.dto.SpelValidateRequest;
import com.engine.editor.service.SpelValidationService;
import com.engine.editor.service.SpelValidationService.ValidationResult;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/spel")
public class SpelController {

    private final SpelValidationService spelValidationService;

    public SpelController(SpelValidationService spelValidationService) {
        this.spelValidationService = spelValidationService;
    }

    @PostMapping("/validate")
    public ResponseEntity<ValidationResult> validate(@RequestBody SpelValidateRequest req) {
        return ResponseEntity.ok(spelValidationService.validate(req.expression(), req.mode()));
    }
}
