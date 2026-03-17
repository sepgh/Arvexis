package com.engine.editor.ffmpeg;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;

/**
 * Checks FFmpeg and FFprobe availability on the system PATH at startup and
 * logs the result. This is a non-fatal check: the editor starts regardless,
 * because FFmpeg is only required when compiling/previewing — not for graph
 * editing or project management.
 */
@Component
public class FFmpegStartupChecker {

    private static final Logger log = LoggerFactory.getLogger(FFmpegStartupChecker.class);

    @EventListener(ApplicationReadyEvent.class)
    public void checkOnStartup() {
        AvailabilityStatus ffmpeg = checkTool("ffmpeg", List.of("ffmpeg", "-version"));
        AvailabilityStatus ffprobe = checkTool("ffprobe", List.of("ffprobe", "-version"));

        if (ffmpeg.available && ffprobe.available) {
            log.info("FFmpeg availability: OK — ffmpeg {}, ffprobe {}",
                     ffmpeg.version, ffprobe.version);
        } else {
            log.warn("FFmpeg availability: UNAVAILABLE — video compilation and preview will not work. " +
                     "Install FFmpeg and ensure 'ffmpeg' and 'ffprobe' are on the system PATH. " +
                     "(ffmpeg={}, ffprobe={})", ffmpeg.available, ffprobe.available);
        }
    }

    /**
     * Public API for other services to query availability at runtime.
     */
    public boolean isFfmpegAvailable() {
        return checkTool("ffmpeg", List.of("ffmpeg", "-version")).available &&
               checkTool("ffprobe", List.of("ffprobe", "-version")).available;
    }

    private AvailabilityStatus checkTool(String name, List<String> versionCommand) {
        try {
            ProcessResult result = ProcessRunner.run(versionCommand, 10);
            if (result.isSuccess()) {
                String firstLine = result.getStdout().lines().findFirst().orElse("").trim();
                return new AvailabilityStatus(true, firstLine);
            }
            return new AvailabilityStatus(false, null);
        } catch (IOException e) {
            log.debug("{} not found on PATH: {}", name, e.getMessage());
            return new AvailabilityStatus(false, null);
        }
    }

    private record AvailabilityStatus(boolean available, String version) {}
}
