package io.github.sepgh.arvexis.editor.preview;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

public class PreviewJob {

    public enum Status { PENDING, RUNNING, DONE, FAILED, CANCELLED }

    private final String id;
    private final String subjectId;
    private final String type;             // "scene" | "transition" | "compile"
    private final Instant createdAt = Instant.now();

    private final AtomicReference<Status> status     = new AtomicReference<>(Status.PENDING);
    private final AtomicInteger           progress   = new AtomicInteger(0);  // 0-100
    private final AtomicBoolean           cancelFlag = new AtomicBoolean(false);
    private volatile String errorMessage;
    private volatile String outputRelPath;
    private volatile String statusText = "Waiting…";
    private volatile Process attachedProcess;

    public PreviewJob(String id, String subjectId, String type) {
        this.id = id;
        this.subjectId = subjectId;
        this.type = type;
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    public String getId()            { return id; }
    public String getSubjectId()     { return subjectId; }
    public String getType()          { return type; }
    public Instant getCreatedAt()    { return createdAt; }
    public Status getStatus()        { return status.get(); }
    public int getProgress()         { return progress.get(); }
    public String getStatusText()    { return statusText; }
    public String getErrorMessage()  { return errorMessage; }
    public String getOutputRelPath() { return outputRelPath; }
    public boolean isCancelRequested(){ return cancelFlag.get(); }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    public void markRunning(String text) {
        statusText = text;
        status.set(Status.RUNNING);
    }

    public void setProgress(int pct, String text) {
        progress.set(Math.min(100, Math.max(0, pct)));
        statusText = text;
    }

    public void markDone(String relPath) {
        this.outputRelPath = relPath;
        progress.set(100);
        statusText = "Done";
        status.set(Status.DONE);
    }

    public void markFailed(String msg) {
        this.errorMessage = msg;
        statusText = "Failed";
        status.set(Status.FAILED);
    }

    /** Signals the job to cancel. The running thread must honour this flag. */
    public void requestCancel() {
        cancelFlag.set(true);
        Process p = attachedProcess;
        if (p != null) p.destroyForcibly();
    }

    public void markCancelled() {
        statusText = "Cancelled";
        status.set(Status.CANCELLED);
    }

    /** Called by the service to register the current FFmpeg process for cancellation. */
    public void attachProcess(Process p) { this.attachedProcess = p; }
    public void detachProcess()          { this.attachedProcess = null; }
}
