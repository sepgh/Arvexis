package com.engine.editor.preview;

import com.engine.editor.exception.ProjectException;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

@Component
public class PreviewJobStore {

    private final ConcurrentHashMap<String, PreviewJob> jobs = new ConcurrentHashMap<>();

    public void put(PreviewJob job) {
        jobs.put(job.getId(), job);
    }

    public PreviewJob require(String jobId) {
        PreviewJob job = jobs.get(jobId);
        if (job == null) throw new ProjectException("Preview job not found: " + jobId);
        return job;
    }
}
