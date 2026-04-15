package io.github.sepgh.arvexis.editor.controller;

import io.github.sepgh.arvexis.editor.service.ValidationService;
import io.github.sepgh.arvexis.editor.service.ValidationService.ValidationReport;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/graph")
public class ValidationController {

    private final ValidationService validationService;

    public ValidationController(ValidationService validationService) {
        this.validationService = validationService;
    }

    @GetMapping("/validate")
    public ResponseEntity<ValidationReport> validate() {
        return ResponseEntity.ok(validationService.validate());
    }
}
