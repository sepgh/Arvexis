package com.engine.editor.controller;

import com.engine.editor.controller.dto.CreateEdgeRequest;
import com.engine.editor.controller.dto.CreateNodeRequest;
import com.engine.editor.controller.dto.UpdateEdgeRequest;
import com.engine.editor.controller.dto.UpdateNodeRequest;
import com.engine.editor.model.GraphEdge;
import com.engine.editor.model.GraphNode;
import com.engine.editor.service.GraphService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class GraphController {

    private final GraphService graphService;

    public GraphController(GraphService graphService) {
        this.graphService = graphService;
    }

    // ── Nodes ─────────────────────────────────────────────────────────────────

    @PostMapping("/nodes")
    public ResponseEntity<GraphNode> createNode(@RequestBody CreateNodeRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(graphService.createNode(req));
    }

    @GetMapping("/nodes")
    public ResponseEntity<List<GraphNode>> listNodes() {
        return ResponseEntity.ok(graphService.listNodes());
    }

    @GetMapping("/nodes/{id}")
    public ResponseEntity<GraphNode> getNode(@PathVariable String id) {
        return ResponseEntity.ok(graphService.getNode(id));
    }

    @PutMapping("/nodes/{id}")
    public ResponseEntity<GraphNode> updateNode(
        @PathVariable String id,
        @RequestBody UpdateNodeRequest req
    ) {
        return ResponseEntity.ok(graphService.updateNode(id, req));
    }

    @DeleteMapping("/nodes/{id}")
    public ResponseEntity<Void> deleteNode(@PathVariable String id) {
        graphService.deleteNode(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/nodes/{id}/root")
    public ResponseEntity<GraphNode> setRoot(@PathVariable String id) {
        return ResponseEntity.ok(graphService.setRoot(id));
    }

    // ── Edges ─────────────────────────────────────────────────────────────────

    @PostMapping("/edges")
    public ResponseEntity<GraphEdge> createEdge(@RequestBody CreateEdgeRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(graphService.createEdge(req));
    }

    @GetMapping("/edges")
    public ResponseEntity<List<GraphEdge>> listEdges() {
        return ResponseEntity.ok(graphService.listEdges());
    }

    @GetMapping("/edges/{id}")
    public ResponseEntity<GraphEdge> getEdge(@PathVariable String id) {
        return ResponseEntity.ok(graphService.getEdge(id));
    }

    @PutMapping("/edges/{id}")
    public ResponseEntity<GraphEdge> updateEdge(
        @PathVariable String id,
        @RequestBody UpdateEdgeRequest req
    ) {
        return ResponseEntity.ok(graphService.updateEdge(id, req));
    }

    @DeleteMapping("/edges/{id}")
    public ResponseEntity<Void> deleteEdge(@PathVariable String id) {
        graphService.deleteEdge(id);
        return ResponseEntity.noContent().build();
    }
}
