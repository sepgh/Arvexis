package io.github.sepgh.arvexis.editor.ffmpeg;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Runs an external process and captures its stdout/stderr.
 * Manages a configurable timeout and drains both streams concurrently
 * to prevent blocking on full pipe buffers.
 */
public final class ProcessRunner {

    private static final Logger log = LoggerFactory.getLogger(ProcessRunner.class);

    private ProcessRunner() {}

    /**
     * Run a command and wait up to {@code timeoutSeconds} for it to finish.
     *
     * @param command         full command as a list of strings
     * @param timeoutSeconds  maximum wait time; the process is forcibly killed on timeout
     * @return {@link ProcessResult} with exit code, stdout and stderr
     * @throws IOException if the process cannot be started or streams cannot be read
     */
    public static ProcessResult run(List<String> command, int timeoutSeconds) throws IOException {
        log.info("FFmpeg: {}", String.join(" ", command));

        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectErrorStream(false);

        Process process = pb.start();

        StreamDrainer outDrainer = new StreamDrainer(process.getInputStream());
        StreamDrainer errDrainer = new StreamDrainer(process.getErrorStream());

        Thread outThread = new Thread(outDrainer, "ffmpeg-stdout");
        Thread errThread = new Thread(errDrainer, "ffmpeg-stderr");
        outThread.start();
        errThread.start();

        boolean finished;
        try {
            finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
            throw new IOException("Process interrupted: " + command.get(0), e);
        }

        if (!finished) {
            process.destroyForcibly();
            throw new IOException("Process timed out after " + timeoutSeconds + "s: " + command.get(0));
        }

        try {
            outThread.join(2000);
            errThread.join(2000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        int exitCode = process.exitValue();
        String stdout = outDrainer.getContent();
        String stderr = errDrainer.getContent();

        if (!stdout.isBlank()) log.debug("FFmpeg stdout:\n{}", stdout.stripTrailing());
        if (!stderr.isBlank()) log.debug("FFmpeg stderr:\n{}", stderr.stripTrailing());
        if (exitCode != 0) {
            log.warn("FFmpeg exited with code {}", exitCode);
        }

        return new ProcessResult(exitCode, stdout, stderr);
    }

    private static final class StreamDrainer implements Runnable {
        private final InputStream stream;
        private String content = "";

        StreamDrainer(InputStream stream) {
            this.stream = stream;
        }

        @Override
        public void run() {
            try {
                content = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            } catch (IOException e) {
                content = "";
            }
        }

        String getContent() {
            return content;
        }
    }
}
