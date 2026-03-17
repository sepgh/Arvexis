package com.engine.editor.controller;

import com.engine.editor.controller.dto.CreateProjectRequest;
import com.engine.editor.controller.dto.OpenProjectRequest;
import com.engine.editor.controller.dto.ProjectStatusResponse;
import com.engine.editor.controller.dto.UpdateProjectConfigRequest;
import com.engine.editor.model.ProjectConfigData;
import com.engine.editor.service.ProjectService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/project")
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @PostMapping("/create")
    public ResponseEntity<ProjectConfigData> create(@RequestBody CreateProjectRequest req) {
        ProjectConfigData config = projectService.createProject(req);
        return ResponseEntity.ok(config);
    }

    @PostMapping("/open")
    public ResponseEntity<ProjectConfigData> open(@RequestBody OpenProjectRequest req) {
        ProjectConfigData config = projectService.openProject(req.directoryPath());
        return ResponseEntity.ok(config);
    }

    @GetMapping("/status")
    public ResponseEntity<ProjectStatusResponse> status() {
        boolean open = projectService.isOpen();
        String path  = open ? projectService.getCurrentProjectPath().toString() : null;
        String name  = open ? projectService.getConfig().getName() : null;
        return ResponseEntity.ok(new ProjectStatusResponse(open, path, name));
    }

    @GetMapping("/config")
    public ResponseEntity<ProjectConfigData> getConfig() {
        return ResponseEntity.ok(projectService.getConfig());
    }

    @PutMapping("/config")
    public ResponseEntity<ProjectConfigData> updateConfig(@RequestBody UpdateProjectConfigRequest req) {
        return ResponseEntity.ok(projectService.updateConfig(req));
    }
}
