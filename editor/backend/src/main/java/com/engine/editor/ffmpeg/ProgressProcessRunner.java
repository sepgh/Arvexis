package com.engine.editor.ffmpeg;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.function.BiConsumer;
import java.util.function.BooleanSupplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Like {@link ProcessRunner} but reads FFmpeg stderr line-by-line to report
 * progress (0-100) via a callback, and supports mid-flight cancellation by
 * destroying the process.
 *
 * <p>Progress is derived from the {@code time=HH:MM:SS.xx} values FFmpeg emits
 * to stderr, compared against the known output duration.</p>
 */
public final class ProgressProcessRunner {

    private static final Logger log = LoggerFactory.getLogger(ProgressProcessRunner.class);
    private static final Pattern TIME_RE = Pattern.compile(
        "time=(\\d+):(\\d+):(\\d+\\.\\d+)");

    private ProgressProcessRunner() {}

    /**
     * @param command         full FFmpeg command
     * @param timeoutSeconds  hard timeout
     * @param durationSeconds expected output duration used to compute %; pass ≤0 to skip
     * @param onProgress      called with (percent 0-100, statusText) during encoding
     * @param cancelCheck     called periodically; return true to kill the process
     */
    public static ProcessResult run(List<String> command,
                                    int timeoutSeconds,
                                    double durationSeconds,
                                    BiConsumer<Integer, String> onProgress,
                                    BooleanSupplier cancelCheck,
                                    ProcessRef processRef) throws IOException {

        log.info("FFmpeg (progress): {}", String.join(" ", command));
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectErrorStream(false);
        Process process = pb.start();
        if (processRef != null) processRef.set(process);

        // Drain stdout silently (not normally used by FFmpeg)
        Thread stdoutDrainer = new Thread(() -> {
            try { process.getInputStream().transferTo(OutputStream.nullOutputStream()); }
            catch (IOException ignored) {}
        }, "ffmpeg-stdout");
        stdoutDrainer.setDaemon(true);
        stdoutDrainer.start();

        // Read stderr line-by-line for progress
        StringBuilder stderrBuf = new StringBuilder();
        Thread stderrReader = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    stderrBuf.append(line).append('\n');
                    log.debug("FFmpeg: {}", line);

                    if (cancelCheck != null && cancelCheck.getAsBoolean()) {
                        process.destroyForcibly();
                        return;
                    }

                    if (durationSeconds > 0 && onProgress != null) {
                        Matcher m = TIME_RE.matcher(line);
                        if (m.find()) {
                            double t = Integer.parseInt(m.group(1)) * 3600.0
                                     + Integer.parseInt(m.group(2)) * 60.0
                                     + Double.parseDouble(m.group(3));
                            int pct = Math.min(95, (int)(t / durationSeconds * 95));
                            onProgress.accept(pct, "Encoding… " + formatTime(t) + " / " + formatTime(durationSeconds));
                        }
                    }
                }
            } catch (IOException ignored) {}
        }, "ffmpeg-stderr-progress");
        stderrReader.setDaemon(true);
        stderrReader.start();

        boolean finished;
        try {
            finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
            throw new IOException("Process interrupted", e);
        }

        if (!finished) {
            process.destroyForcibly();
            throw new IOException("FFmpeg timed out after " + timeoutSeconds + "s");
        }

        try { stderrReader.join(2000); } catch (InterruptedException ignored) {}

        if (processRef != null) processRef.set(null);

        int exitCode = process.exitValue();
        return new ProcessResult(exitCode, "", stderrBuf.toString());
    }

    private static String formatTime(double secs) {
        int s = (int) secs;
        return String.format("%d:%02d", s / 60, s % 60);
    }

    /** Mutable holder so the caller can attach the process to a PreviewJob. */
    public static final class ProcessRef {
        private volatile Process value;
        public void set(Process p) { this.value = p; }
        public Process get()       { return value; }
    }
}
