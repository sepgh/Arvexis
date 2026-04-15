package io.github.sepgh.arvexis.editor.controller;

import io.github.sepgh.arvexis.editor.preview.PreviewJob;
import io.github.sepgh.arvexis.editor.preview.PreviewJobStore;
import io.github.sepgh.arvexis.editor.service.ScenePreviewService;
import io.github.sepgh.arvexis.editor.service.TransitionPreviewService;
import io.github.sepgh.arvexis.editor.service.ProjectService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.util.Map;

@RestController
@RequestMapping("/api/preview")
public class PreviewController {

    private final ScenePreviewService      scenePreviewService;
    private final TransitionPreviewService transitionPreviewService;
    private final PreviewJobStore          jobStore;
    private final ProjectService           projectService;

    public PreviewController(ScenePreviewService scenePreviewService,
                             TransitionPreviewService transitionPreviewService,
                             PreviewJobStore jobStore,
                             ProjectService projectService) {
        this.scenePreviewService      = scenePreviewService;
        this.transitionPreviewService = transitionPreviewService;
        this.jobStore                 = jobStore;
        this.projectService           = projectService;
    }

    @PostMapping("/scene/{nodeId}")
    public ResponseEntity<Map<String, Object>> startScenePreview(@PathVariable String nodeId) {
        PreviewJob job = scenePreviewService.startPreview(nodeId);
        return ResponseEntity.accepted().body(jobResponse(job));
    }

    @PostMapping("/transition/{edgeId}")
    public ResponseEntity<Map<String, Object>> startTransitionPreview(@PathVariable String edgeId) {
        PreviewJob job = transitionPreviewService.startPreview(edgeId);
        return ResponseEntity.accepted().body(jobResponse(job));
    }

    @GetMapping("/status/{jobId}")
    public ResponseEntity<Map<String, Object>> getStatus(@PathVariable String jobId) {
        PreviewJob job = jobStore.require(jobId);
        return ResponseEntity.ok(jobResponse(job));
    }

    @PostMapping("/cancel/{jobId}")
    public ResponseEntity<Map<String, Object>> cancelJob(@PathVariable String jobId) {
        PreviewJob job = jobStore.require(jobId);
        if (job.getStatus() == PreviewJob.Status.PENDING ||
            job.getStatus() == PreviewJob.Status.RUNNING) {
            job.requestCancel();
        }
        return ResponseEntity.ok(jobResponse(job));
    }

    @GetMapping("/file/{jobId}")
    public ResponseEntity<Resource> getFile(@PathVariable String jobId) {
        PreviewJob job = jobStore.require(jobId);
        if (job.getStatus() != PreviewJob.Status.DONE)
            return ResponseEntity.notFound().build();

        Path projectDir = projectService.getCurrentProjectPath();
        Path file = projectDir.resolve(job.getOutputRelPath());
        if (!file.toFile().exists()) return ResponseEntity.notFound().build();

        Resource resource = new FileSystemResource(file);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,
                    "inline; filename=\"" + file.getFileName() + "\"")
            .contentType(MediaType.parseMediaType("video/mp4"))
            .body(resource);
    }

    private Map<String, Object> jobResponse(PreviewJob job) {
        return Map.of(
            "jobId",      job.getId(),
            "type",       job.getType(),
            "status",     job.getStatus().name().toLowerCase(),
            "progress",   job.getProgress(),
            "statusText", job.getStatusText() != null ? job.getStatusText() : "",
            "error",      job.getErrorMessage() != null ? job.getErrorMessage() : "",
            "fileUrl",    job.getStatus() == PreviewJob.Status.DONE
                              ? "/api/preview/file/" + job.getId() : ""
        );
    }
}
