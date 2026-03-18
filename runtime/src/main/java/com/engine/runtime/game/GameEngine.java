package com.engine.runtime.game;

import org.springframework.expression.EvaluationContext;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.SimpleEvaluationContext;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Core graph traversal and SpEL evaluation engine.
 * Thread-safe: state mutations are caller-synchronized.
 */
public class GameEngine {

    private static final int MAX_TRAVERSAL_STEPS = 100;
    private static final Pattern ASSIGNMENT_RE = Pattern.compile("^\\s*#(\\w+)\\s*=(.+)$", Pattern.DOTALL);

    private final Manifest manifest;
    private final Map<String, Manifest.NodeData>   nodeById         = new HashMap<>();
    private final Map<String, List<Manifest.EdgeData>> edgesBySource = new HashMap<>();
    private final ExpressionParser parser = new SpelExpressionParser();

    public GameEngine(Manifest manifest) {
        this.manifest = manifest;
        for (Manifest.NodeData n : manifest.nodes) {
            nodeById.put(n.id, n);
        }
        for (Manifest.EdgeData e : manifest.edges) {
            edgesBySource.computeIfAbsent(e.sourceNodeId, k -> new ArrayList<>()).add(e);
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public Manifest.NodeData rootNode() {
        return nodeById.get(manifest.rootNodeId);
    }

    public Manifest.NodeData nodeById(String id) {
        return nodeById.get(id);
    }

    public double decisionTimeoutSecs() {
        return manifest.project != null ? manifest.project.decisionTimeoutSecs : 5.0;
    }

    /**
     * Result of a decision traversal.
     *
     * @param nextScene   the scene node reached after traversal
     * @param transEdge   the edge whose transition applies (only the edge directly into the
     *                    first-encountered scene node), or null for instant jump
     */
    public record TraversalResult(
        Manifest.NodeData     nextScene,
        Manifest.EdgeData     transEdge
    ) {}

    /**
     * From the current scene, apply a decision, traverse through state/decision nodes,
     * mutate the GameState in-place, and return the next scene + optional transition edge.
     *
     * @throws IllegalArgumentException if decision key is unknown or graph is inconsistent
     */
    public TraversalResult decide(GameState state, String decisionKey) {
        Manifest.NodeData currentScene = nodeById(state.currentSceneId);
        if (currentScene == null)
            throw new IllegalArgumentException("Unknown current scene: " + state.currentSceneId);

        // Find the outgoing edge matching the decisionKey from the current scene
        Manifest.EdgeData startEdge = findDecisionEdge(state.currentSceneId, decisionKey);
        if (startEdge == null)
            throw new IllegalArgumentException(
                "No edge for decision '" + decisionKey + "' from scene " + state.currentSceneId);

        // Walk the graph until we hit a scene node
        Manifest.EdgeData transEdge  = null;
        Manifest.EdgeData currentEdge = startEdge;
        int steps = 0;

        while (steps++ < MAX_TRAVERSAL_STEPS) {
            String targetId = currentEdge.targetNodeId;
            Manifest.NodeData target = nodeById(targetId);
            if (target == null) throw new IllegalArgumentException("Node not found: " + targetId);

            switch (target.type) {
                case "scene" -> {
                    // Transition applies only on the edge that directly leads to a scene
                    transEdge = currentEdge.transition != null ? currentEdge : null;
                    state.currentSceneId = targetId;
                    state.gameOver = target.isEnd;
                    return new TraversalResult(target, transEdge);
                }
                case "state" -> {
                    executeAssignments(target, state);
                    List<Manifest.EdgeData> outs = edgesBySource.getOrDefault(targetId, List.of());
                    if (outs.isEmpty())
                        throw new IllegalArgumentException("State node has no outgoing edge: " + targetId);
                    currentEdge = outs.get(0);
                }
                case "condition" -> {
                    Manifest.EdgeData matched = evaluateConditions(target, state);
                    if (matched == null)
                        throw new IllegalArgumentException("No matching condition in condition node: " + targetId);
                    currentEdge = matched;
                }
                default -> throw new IllegalArgumentException("Unknown node type: " + target.type);
            }
        }
        throw new IllegalArgumentException("Graph traversal exceeded " + MAX_TRAVERSAL_STEPS + " steps (cycle?)");
    }

    /**
     * Returns the decisions available from the given scene, with their keys.
     * If the scene has no explicit decisions, returns a synthetic CONTINUE.
     */
    public List<DecisionInfo> availableDecisions(String sceneId) {
        Manifest.NodeData scene = nodeById(sceneId);
        if (scene == null || scene.decisions == null || scene.decisions.isEmpty()) {
            return List.of(new DecisionInfo("CONTINUE", true));
        }
        return scene.decisions.stream()
            .sorted(Comparator.comparingInt(d -> d.decisionOrder))
            .map(d -> new DecisionInfo(d.decisionKey, d.isDefault))
            .toList();
    }

    public record DecisionInfo(String key, boolean isDefault) {}

    /**
     * Returns preload URLs (HLS paths) for all transition edges leaving the given scene.
     * These are relative URL paths under /hls/.
     */
    public List<String> preloadUrlsForScene(String sceneId) {
        return edgesBySource.getOrDefault(sceneId, List.of()).stream()
            .filter(e -> e.transition != null && !"none".equals(e.transition.type))
            .map(e -> "/hls/trans_" + e.id + "/master.m3u8")
            .toList();
    }

    // ── SpEL: state-node assignments ──────────────────────────────────────────

    private void executeAssignments(Manifest.NodeData stateNode, GameState gameState) {
        if (stateNode.assignments == null) return;
        stateNode.assignments.stream()
            .sorted(Comparator.comparingInt(a -> a.order))
            .forEach(a -> executeAssignment(a.expression, gameState));
    }

    private void executeAssignment(String expression, GameState gameState) {
        if (expression == null || expression.isBlank()) return;

        Matcher m = ASSIGNMENT_RE.matcher(expression);
        if (!m.matches()) {
            System.err.println("[GameEngine] Unrecognized assignment expression: " + expression);
            return;
        }
        String varName = m.group(1);
        String rhs     = m.group(2).trim();

        // Spec: variable defaults are 0 — seed before evaluation so #var + 1 works on first use
        gameState.variables.putIfAbsent(varName, 0);
        seedMissingVars(rhs, gameState);

        EvaluationContext ctx = buildContext(gameState);
        try {
            Expression expr   = parser.parseExpression(rhs);
            Object     result = expr.getValue(ctx);
            gameState.variables.put(varName, result);
        } catch (Exception e) {
            System.err.println("[GameEngine] Assignment error '" + expression + "': " + e.getMessage());
        }
    }

    // ── SpEL: decision-node conditions ────────────────────────────────────────

    private Manifest.EdgeData evaluateConditions(Manifest.NodeData decisionNode, GameState gameState) {
        List<Manifest.EdgeData> outEdges = edgesBySource.getOrDefault(decisionNode.id, List.of());
        if (outEdges.isEmpty()) return null;

        // No conditions defined → take first edge (degenerate decision node)
        if (decisionNode.conditions == null || decisionNode.conditions.isEmpty()) {
            return outEdges.get(0);
        }

        Manifest.ConditionEntry elseCondition = null;
        List<Manifest.ConditionEntry> ordered = decisionNode.conditions.stream()
            .sorted(Comparator.comparingInt(c -> c.order))
            .toList();

        // Seed any #var references with default 0 before evaluation
        for (Manifest.ConditionEntry cond : ordered) {
            if (!cond.isElse && cond.expression != null) seedMissingVars(cond.expression, gameState);
        }
        EvaluationContext ctx = buildContext(gameState);

        for (Manifest.ConditionEntry cond : ordered) {
            if (cond.isElse) {
                elseCondition = cond;
                continue;
            }
            try {
                Boolean result = parser.parseExpression(cond.expression).getValue(ctx, Boolean.class);
                if (Boolean.TRUE.equals(result)) {
                    return edgeForConditionOrder(outEdges, cond.order);
                }
            } catch (Exception e) {
                System.err.println("[GameEngine] Condition error '" + cond.expression + "': " + e.getMessage());
            }
        }

        // Fall through to else / first edge
        if (elseCondition != null) {
            return edgeForConditionOrder(outEdges, elseCondition.order);
        }
        return outEdges.get(0); // ultimate fallback
    }

    private Manifest.EdgeData edgeForConditionOrder(List<Manifest.EdgeData> edges, int order) {
        return edges.stream()
            .filter(e -> e.sourceConditionOrder != null && e.sourceConditionOrder == order)
            .findFirst()
            .orElse(edges.isEmpty() ? null : edges.get(0)); // fallback to first
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Manifest.EdgeData findDecisionEdge(String sceneId, String decisionKey) {
        List<Manifest.EdgeData> outs = edgesBySource.getOrDefault(sceneId, List.of());
        if ("CONTINUE".equals(decisionKey) && outs.size() == 1) return outs.get(0);
        return outs.stream()
            .filter(e -> decisionKey.equals(e.sourceDecisionKey))
            .findFirst()
            .orElse(null);
    }

    private EvaluationContext buildContext(GameState state) {
        SimpleEvaluationContext ctx = SimpleEvaluationContext.forReadWriteDataBinding().build();
        state.variables.forEach(ctx::setVariable);
        return ctx;
    }

    /** Seed any #varName references in the expression with 0 if not yet in state. */
    private void seedMissingVars(String expression, GameState state) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("#(\\w+)").matcher(expression);
        while (m.find()) {
            state.variables.putIfAbsent(m.group(1), 0);
        }
    }
}
