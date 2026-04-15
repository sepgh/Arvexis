package io.github.sepgh.arvexis.editor.controller;

import io.github.sepgh.arvexis.editor.controller.dto.SpelValidateRequest;
import io.github.sepgh.arvexis.editor.service.SpelValidationService;
import io.github.sepgh.arvexis.editor.service.SpelValidationService.ValidationResult;
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
