package io.github.sepgh.arvexis.editor.service;

import io.github.sepgh.arvexis.editor.exception.ProjectException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ValidationService {

    private final ProjectService projectService;

    public ValidationService(ProjectService projectService) {
        this.projectService = projectService;
    }

    public record ValidationIssue(
        String severity,   // "error" | "warning"
        String code,
        String message,
        String nodeId,
        String edgeId
    ) {}

    public record ValidationReport(
        List<ValidationIssue> errors,
        List<ValidationIssue> warnings
    ) {}

    public ValidationReport validate() {
        JdbcTemplate jdbc = projectService.requireJdbc();

        List<ValidationIssue> errors   = new ArrayList<>();
        List<ValidationIssue> warnings = new ArrayList<>();

        // Snapshot data needed across rules
        List<Map<String, Object>> nodes = jdbc.queryForList("SELECT id, name, type, is_root, is_end FROM nodes");
        List<Map<String, Object>> edges = jdbc.queryForList(
            "SELECT id, source_node_id, target_node_id FROM edges");

        if (nodes.isEmpty()) {
            // Nothing to validate
            return new ValidationReport(errors, warnings);
        }

        Map<String, Map<String, Object>> nodeMap = new HashMap<>();
        for (Map<String, Object> n : nodes) nodeMap.put((String) n.get("id"), n);

        // ── Error: no root node ────────────────────────────────────────────────
        boolean hasRoot = nodes.stream()
            .anyMatch(n -> ((Number) n.get("is_root")).intValue() == 1);
        if (!hasRoot) {
            errors.add(new ValidationIssue("error", "NO_ROOT",
                "No root node is set. Exactly one node must be marked as root.", null, null));
        }

        // ── Error: scene with decisions but no default ─────────────────────────
        List<Map<String, Object>> scenesWithDecisions = jdbc.queryForList("""
            SELECT DISTINCT node_id FROM scene_decisions
            """);
        for (Map<String, Object> row : scenesWithDecisions) {
            String sceneId = (String) row.get("node_id");
            Integer defaultCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scene_decisions WHERE node_id=? AND is_default=1",
                Integer.class, sceneId);
            if (defaultCount == null || defaultCount == 0) {
                String name = nodeMap.containsKey(sceneId)
                    ? (String) nodeMap.get(sceneId).get("name") : sceneId;
                errors.add(new ValidationIssue("error", "NO_DEFAULT_DECISION",
                    "Scene '" + name + "' has decisions but none is marked as default.",
                    sceneId, null));
            }
        }

        // ── Error: explicit scene decision without matching outgoing edge ───────
        List<Map<String, Object>> sceneDecisions = jdbc.queryForList("""
            SELECT sd.node_id, sd.decision_key, n.name AS node_name
            FROM scene_decisions sd
            JOIN nodes n ON n.id = sd.node_id
            ORDER BY sd.node_id, sd.decision_order
            """);
        for (Map<String, Object> row : sceneDecisions) {
            String sceneId = (String) row.get("node_id");
            String decisionKey = (String) row.get("decision_key");
            Integer edgeCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM edges WHERE source_node_id=? AND source_decision_key=?",
                Integer.class, sceneId, decisionKey);
            if (edgeCount == null || edgeCount == 0) {
                errors.add(new ValidationIssue("error", "DECISION_MISSING_EDGE",
                    "Scene '" + row.get("node_name") + "' has decision '" + decisionKey +
                        "' but no outgoing edge is connected to it.",
                    sceneId, null));
            }
        }

        // ── Error: state node with != 1 outgoing edge ──────────────────────────
        for (Map<String, Object> n : nodes) {
            if (!"state".equals(n.get("type"))) continue;
            String nId = (String) n.get("id");
            Integer outCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM edges WHERE source_node_id=?", Integer.class, nId);
            if (outCount == null || outCount != 1) {
                errors.add(new ValidationIssue("error", "STATE_EDGE_COUNT",
                    "State node '" + n.get("name") + "' must have exactly 1 outgoing edge (has " +
                        (outCount == null ? 0 : outCount) + ").",
                    nId, null));
            }
        }

        // ── Error: condition node with no else condition ────────────────────────
        for (Map<String, Object> n : nodes) {
            if (!"condition".equals(n.get("type"))) continue;
            String nId = (String) n.get("id");
            Integer elseCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM node_decision_conditions WHERE node_id=? AND is_else=1",
                Integer.class, nId);
            if (elseCount == null || elseCount == 0) {
                errors.add(new ValidationIssue("error", "NO_ELSE_CONDITION",
                    "Condition node '" + n.get("name") + "' has no else condition.",
                    nId, null));
            }
        }

        // ── Error: transition on edge not targeting scene ──────────────────────
        // Only check transitions on edges that actually exist (filter out orphaned transition records)
        List<Map<String, Object>> transEdges = jdbc.queryForList("""
            SELECT et.edge_id FROM edge_transitions et
            JOIN edges e ON e.id = et.edge_id
            """);
        for (Map<String, Object> row : transEdges) {
            String eId = (String) row.get("edge_id");
            Integer c = jdbc.queryForObject("""
                SELECT COUNT(*) FROM edges e
                JOIN nodes n ON n.id=e.target_node_id
                WHERE e.id=? AND n.type='scene'
                """, Integer.class, eId);
            if (c == null || c == 0) {
                errors.add(new ValidationIssue("error", "TRANSITION_INVALID_TARGET",
                    "Edge has a transition but its target is not a scene node.", null, eId));
            }
        }

        // ── Warning: no end node ───────────────────────────────────────────────
        boolean hasEnd = nodes.stream()
            .anyMatch(n -> "scene".equals(n.get("type")) && ((Number) n.get("is_end")).intValue() == 1);
        if (!hasEnd) {
            warnings.add(new ValidationIssue("warning", "NO_END_NODE",
                "No scene node is marked as an end node. The game will have no defined ending.",
                null, null));
        }

        // ── Warning: scene with no outgoing edges and no end flag ──────────────
        for (Map<String, Object> n : nodes) {
            if (!"scene".equals(n.get("type"))) continue;
            String nId = (String) n.get("id");
            if (((Number) n.get("is_end")).intValue() == 1) continue;
            Integer outCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM edges WHERE source_node_id=?", Integer.class, nId);
            if (outCount == null || outCount == 0) {
                warnings.add(new ValidationIssue("warning", "SCENE_NO_EXIT",
                    "Scene '" + n.get("name") + "' has no outgoing edges and is not an end node.",
                    nId, null));
            }
        }

        // ── Warning: unreachable nodes (BFS from root) ─────────────────────────
        String rootId = nodes.stream()
            .filter(n -> ((Number) n.get("is_root")).intValue() == 1)
            .map(n -> (String) n.get("id"))
            .findFirst().orElse(null);

        if (rootId != null) {
            // Build adjacency list
            Map<String, List<String>> adj = new HashMap<>();
            for (Map<String, Object> n : nodes) adj.put((String) n.get("id"), new ArrayList<>());
            for (Map<String, Object> e : edges) {
                String src = (String) e.get("source_node_id");
                String tgt = (String) e.get("target_node_id");
                adj.computeIfAbsent(src, k -> new ArrayList<>()).add(tgt);
            }

            Set<String> visited = new HashSet<>();
            Queue<String> queue = new ArrayDeque<>();
            queue.add(rootId);
            visited.add(rootId);
            while (!queue.isEmpty()) {
                String cur = queue.poll();
                for (String next : adj.getOrDefault(cur, List.of())) {
                    if (visited.add(next)) queue.add(next);
                }
            }

            for (Map<String, Object> n : nodes) {
                String nId = (String) n.get("id");
                if (!visited.contains(nId)) {
                    warnings.add(new ValidationIssue("warning", "UNREACHABLE_NODE",
                        "Node '" + n.get("name") + "' is unreachable from the root node.",
                        nId, null));
                }
            }
        }

        return new ValidationReport(errors, warnings);
    }
}
