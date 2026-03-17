package com.engine.editor.ffmpeg;

public class ProcessResult {

    private final int exitCode;
    private final String stdout;
    private final String stderr;

    public ProcessResult(int exitCode, String stdout, String stderr) {
        this.exitCode = exitCode;
        this.stdout = stdout;
        this.stderr = stderr;
    }

    public boolean isSuccess() {
        return exitCode == 0;
    }

    public int getExitCode() { return exitCode; }
    public String getStdout() { return stdout; }
    public String getStderr() { return stderr; }

    @Override
    public String toString() {
        return "ProcessResult{exitCode=" + exitCode +
               ", stderr='" + (stderr.length() > 200 ? stderr.substring(0, 200) + "..." : stderr) + "'}";
    }
}
