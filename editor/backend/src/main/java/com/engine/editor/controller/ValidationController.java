package com.engine.editor.controller;

import com.engine.editor.service.ValidationService;
import com.engine.editor.service.ValidationService.ValidationReport;
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
