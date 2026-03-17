package com.engine.editor.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ProjectException.class)
    public ResponseEntity<Map<String, Object>> handleProjectException(ProjectException ex) {
        log.warn("Project error: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(errorBody(HttpStatus.BAD_REQUEST, ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Bad request: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(errorBody(HttpStatus.BAD_REQUEST, ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneral(Exception ex) {
        log.error("Unexpected error", ex);
        return ResponseEntity.internalServerError()
                .body(errorBody(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error: " + ex.getMessage()));
    }

    private Map<String, Object> errorBody(HttpStatus status, String message) {
        return Map.of(
            "status", status.value(),
            "error", status.getReasonPhrase(),
            "message", message,
            "timestamp", Instant.now().toString()
        );
    }
}
