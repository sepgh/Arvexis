package io.github.sepgh.arvexis.editor.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Receives log entries forwarded from the browser client so they appear in the
 * same log file as the server. The dedicated {@code arvexis.client} logger is
 * always at DEBUG level in logback-spring.xml.
 *
 * <p>Frontend fires {@code POST /api/logs} for {@code console.warn} and
 * {@code console.error} calls — see {@code src/utils/clientLogger.ts}.</p>
 */
@RestController
@RequestMapping("/api/logs")
public class ClientLogController {

    private static final Logger log = LoggerFactory.getLogger("arvexis.client");

    public record ClientLogRequest(String level, String message, String context) {}

    @PostMapping
    public ResponseEntity<Void> receive(@RequestBody ClientLogRequest req) {
        String msg = req.context() != null && !req.context().isBlank()
            ? "[browser][" + req.context() + "] " + req.message()
            : "[browser] " + req.message();

        switch (req.level() == null ? "info" : req.level().toLowerCase()) {
            case "error" -> log.error(msg);
            case "warn"  -> log.warn(msg);
            case "debug" -> log.debug(msg);
            default      -> log.info(msg);
        }
        return ResponseEntity.ok().build();
    }
}
