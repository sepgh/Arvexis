package com.engine.editor.service;

import com.engine.editor.controller.dto.CreateEdgeRequest;
import com.engine.editor.controller.dto.CreateNodeRequest;
import com.engine.editor.controller.dto.UpdateEdgeRequest;
import com.engine.editor.controller.dto.UpdateNodeRequest;
import com.engine.editor.exception.ProjectException;
import com.engine.editor.model.EdgeTransitionData;
import com.engine.editor.model.GraphEdge;
import com.engine.editor.model.GraphNode;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * CRUD operations for graph nodes and edges.
 * All data access goes through {@link ProjectService#requireJdbc()}.
 */
@Service
public class GraphService {

    private static final Set<String> VALID_NODE_TYPES  = Set.of("scene", "state", "decision");
    private static final Set<String> VALID_TRANSITIONS = Set.of(
        "none", "fade_in", "fade_out", "crossfade",
        "slide_left", "slide_right", "wipe", "dissolve", "cut", "video"
    );
    private static final double MAX_TRANSITION_SECS = 5.0;

    private final ProjectService projectService;

    public GraphService(ProjectService projectService) {
        this.projectService = projectService;
    }

    // ── Nodes ─────────────────────────────────────────────────────────────────

    public GraphNode createNode(CreateNodeRequest req) {
        if (req.name() == null || req.name().isBlank())
            throw new ProjectException("Node name must not be blank");
        if (!VALID_NODE_TYPES.contains(req.type()))
            throw new ProjectException("Invalid node type: " + req.type());

        JdbcTemplate jdbc = projectService.requireJdbc();
        String id = UUID.randomUUID().toString();
        double x = req.posX() != null ? req.posX() : 0.0;
        double y = req.posY() != null ? req.posY() : 0.0;

        jdbc.update("""
            INSERT INTO nodes (id, name, type, is_root, is_end, pos_x, pos_y)
            VALUES (?, ?, ?, 0, 0, ?, ?)
            """, id, req.name().trim(), req.type(), x, y);

        return getNode(id);
    }

    public List<GraphNode> listNodes() {
        return projectService.requireJdbc().query(
            "SELECT * FROM nodes ORDER BY pos_y, pos_x", this::mapNode);
    }

    public GraphNode getNode(String id) {
        List<GraphNode> rows = projectService.requireJdbc().query(
            "SELECT * FROM nodes WHERE id = ?", this::mapNode, id);
        if (rows.isEmpty()) throw new ProjectException("Node not found: " + id);
        return rows.get(0);
    }

    public GraphNode updateNode(String id, UpdateNodeRequest req) {
        GraphNode existing = getNode(id);
        JdbcTemplate jdbc = projectService.requireJdbc();

        String name     = req.name()     != null ? req.name().trim() : existing.getName();
        boolean isEnd   = req.isEnd()    != null ? req.isEnd()       : existing.isEnd();
        String bgColor  = req.backgroundColor() != null ? req.backgroundColor() : existing.getBackgroundColor();
        String dac      = req.decisionAppearanceConfig() != null
                          ? req.decisionAppearanceConfig()
                          : existing.getDecisionAppearanceConfig();
        double posX     = req.posX() != null ? req.posX() : existing.getPosX();
        double posY     = req.posY() != null ? req.posY() : existing.getPosY();

        if (name.isBlank()) throw new ProjectException("Node name must not be blank");

        jdbc.update("""
            UPDATE nodes SET name=?, is_end=?, background_color=?,
                decision_appearance_config=?, pos_x=?, pos_y=?
            WHERE id=?
            """, name, isEnd ? 1 : 0, bgColor, dac, posX, posY, id);

        return getNode(id);
    }

    public void deleteNode(String id) {
        getNode(id); // throws if not found
        projectService.requireJdbc().update("DELETE FROM nodes WHERE id = ?", id);
    }

    public GraphNode setRoot(String id) {
        getNode(id); // throws if not found
        JdbcTemplate jdbc = projectService.requireJdbc();
        jdbc.update("UPDATE nodes SET is_root = 0");
        jdbc.update("UPDATE nodes SET is_root = 1 WHERE id = ?", id);
        return getNode(id);
    }

    // ── Edges ─────────────────────────────────────────────────────────────────

    public GraphEdge createEdge(CreateEdgeRequest req) {
        if (req.sourceNodeId() == null || req.targetNodeId() == null)
            throw new ProjectException("sourceNodeId and targetNodeId are required");

        JdbcTemplate jdbc = projectService.requireJdbc();

        // Validate both nodes exist
        requireNodeExists(jdbc, req.sourceNodeId());
        requireNodeExists(jdbc, req.targetNodeId());

        // Prevent duplicate edges between the same source/target/decision-key
        Integer dup = jdbc.queryForObject("""
            SELECT COUNT(*) FROM edges
            WHERE source_node_id=? AND target_node_id=?
              AND (source_decision_key IS ? OR source_decision_key=?)
            """, Integer.class,
            req.sourceNodeId(), req.targetNodeId(),
            req.sourceDecisionKey(), req.sourceDecisionKey());
        if (dup != null && dup > 0)
            throw new ProjectException("An identical edge already exists between these nodes");

        String id = UUID.randomUUID().toString();
        jdbc.update("""
            INSERT INTO edges (id, source_node_id, target_node_id,
                               source_decision_key, source_condition_order)
            VALUES (?, ?, ?, ?, ?)
            """, id, req.sourceNodeId(), req.targetNodeId(),
                req.sourceDecisionKey(), req.sourceConditionOrder());

        return getEdge(id);
    }

    public List<GraphEdge> listEdges() {
        JdbcTemplate jdbc = projectService.requireJdbc();
        List<GraphEdge> edges = jdbc.query("SELECT * FROM edges", this::mapEdge);
        edges.forEach(e -> e.setTransition(loadTransition(jdbc, e.getId())));
        return edges;
    }

    public GraphEdge getEdge(String id) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        List<GraphEdge> rows = jdbc.query("SELECT * FROM edges WHERE id=?", this::mapEdge, id);
        if (rows.isEmpty()) throw new ProjectException("Edge not found: " + id);
        GraphEdge edge = rows.get(0);
        edge.setTransition(loadTransition(jdbc, id));
        return edge;
    }

    public GraphEdge updateEdge(String id, UpdateEdgeRequest req) {
        getEdge(id); // throws if not found
        JdbcTemplate jdbc = projectService.requireJdbc();

        if (req.transitionType() != null) {
            if (!VALID_TRANSITIONS.contains(req.transitionType()))
                throw new ProjectException("Invalid transition type: " + req.transitionType());
            if (req.transitionDuration() != null && req.transitionDuration() > MAX_TRANSITION_SECS)
                throw new ProjectException(
                    "Transition duration cannot exceed " + MAX_TRANSITION_SECS + " seconds");

            jdbc.update("DELETE FROM edge_transitions WHERE edge_id = ?", id);
            if (!"none".equals(req.transitionType())) {
                jdbc.update("""
                    INSERT INTO edge_transitions (edge_id, type, duration, config)
                    VALUES (?, ?, ?, ?)
                    """, id, req.transitionType(), req.transitionDuration(), req.transitionConfig());
            }
        }
        return getEdge(id);
    }

    public void deleteEdge(String id) {
        getEdge(id); // throws if not found
        projectService.requireJdbc().update("DELETE FROM edges WHERE id = ?", id);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private GraphNode mapNode(ResultSet rs, int row) throws SQLException {
        GraphNode n = new GraphNode();
        n.setId(rs.getString("id"));
        n.setName(rs.getString("name"));
        n.setType(rs.getString("type"));
        n.setRoot(rs.getInt("is_root") == 1);
        n.setEnd(rs.getInt("is_end") == 1);
        n.setBackgroundColor(rs.getString("background_color"));
        n.setDecisionAppearanceConfig(rs.getString("decision_appearance_config"));
        n.setPosX(rs.getDouble("pos_x"));
        n.setPosY(rs.getDouble("pos_y"));
        return n;
    }

    private GraphEdge mapEdge(ResultSet rs, int row) throws SQLException {
        GraphEdge e = new GraphEdge();
        e.setId(rs.getString("id"));
        e.setSourceNodeId(rs.getString("source_node_id"));
        e.setSourceDecisionKey(rs.getString("source_decision_key"));
        int condOrder = rs.getInt("source_condition_order");
        e.setSourceConditionOrder(rs.wasNull() ? null : condOrder);
        e.setTargetNodeId(rs.getString("target_node_id"));
        return e;
    }

    private EdgeTransitionData loadTransition(JdbcTemplate jdbc, String edgeId) {
        List<EdgeTransitionData> rows = jdbc.query(
            "SELECT * FROM edge_transitions WHERE edge_id = ?",
            (rs, row) -> {
                EdgeTransitionData t = new EdgeTransitionData();
                t.setType(rs.getString("type"));
                double dur = rs.getDouble("duration");
                t.setDuration(rs.wasNull() ? null : dur);
                t.setConfig(rs.getString("config"));
                return t;
            }, edgeId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private void requireNodeExists(JdbcTemplate jdbc, String nodeId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM nodes WHERE id=?", Integer.class, nodeId);
        if (count == null || count == 0)
            throw new ProjectException("Node not found: " + nodeId);
    }
}
