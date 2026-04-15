package io.github.sepgh.arvexis.embeddedruntime.core.game;

import org.springframework.expression.EvaluationContext;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.SimpleEvaluationContext;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class GameEngine {
    private static final int MAX_TRAVERSAL_STEPS = 100;
    private static final Pattern ASSIGNMENT_RE = Pattern.compile("^\\s*#(\\w+)\\s*=(.+)$", Pattern.DOTALL);
    private static final Pattern STATE_MAP_ACCESS_RE = Pattern.compile("#state\\[(?:'([^']+)'|\"([^\"]+)\")\\]");

    private final Manifest manifest;
    private final Map<String, Manifest.NodeData> nodeById = new HashMap<>();
    private final Map<String, List<Manifest.EdgeData>> edgesBySource = new HashMap<>();
    private final Map<String, Manifest.AmbientZoneData> ambientZoneById = new HashMap<>();
    private final ExpressionParser parser = new SpelExpressionParser();

    public GameEngine(Manifest manifest) {
        this.manifest = manifest;
        if (manifest.ambientZones != null) {
            for (Manifest.AmbientZoneData zone : manifest.ambientZones) {
                if (zone != null && zone.id != null) {
                    ambientZoneById.put(zone.id, zone);
                }
            }
        }
        for (Manifest.NodeData n : manifest.nodes) {
            nodeById.put(n.id, n);
        }
        for (Manifest.EdgeData e : manifest.edges) {
            edgesBySource.computeIfAbsent(e.sourceNodeId, key -> new ArrayList<>()).add(e);
        }
    }

    public Manifest.NodeData rootNode() {
        return nodeById.get(manifest.rootNodeId);
    }

    public Manifest.NodeData nodeById(String id) {
        return nodeById.get(id);
    }

    public Manifest.AmbientZoneData ambientZoneById(String id) {
        return ambientZoneById.get(id);
    }

    public double decisionTimeoutSecs() {
        return manifest.project != null ? manifest.project.decisionTimeoutSecs : 5.0;
    }

    public boolean hideDecisionButtons(String sceneId) {
        Manifest.NodeData scene = nodeById(sceneId);
        if (scene != null && scene.hideDecisionButtons != null) {
            return scene.hideDecisionButtons;
        }
        return manifest.project != null && manifest.project.hideDecisionButtons;
    }

    public boolean showDecisionInputIndicator(String sceneId) {
        Manifest.NodeData scene = nodeById(sceneId);
        if (scene != null && scene.showDecisionInputIndicator != null) {
            return scene.showDecisionInputIndicator;
        }
        return manifest.project != null && manifest.project.showDecisionInputIndicator;
    }

    public record TraversalResult(Manifest.NodeData nextScene, Manifest.EdgeData transEdge, Manifest.EdgeData sceneEdge) {
    }

    public record DecisionInfo(String key, boolean isDefault, String keyboardKey) {
    }

    public TraversalResult decide(GameState state, String decisionKey) {
        Manifest.NodeData currentScene = nodeById(state.currentSceneId);
        if (currentScene == null) {
            throw new IllegalArgumentException("Unknown current scene: " + state.currentSceneId);
        }
        if (!isDecisionAvailable(state, state.currentSceneId, decisionKey)) {
            throw new IllegalArgumentException("Decision '" + decisionKey + "' is not currently available from scene " + state.currentSceneId);
        }
        Manifest.EdgeData startEdge = findDecisionEdge(state.currentSceneId, decisionKey);
        if (startEdge == null) {
            throw new IllegalArgumentException("No edge for decision '" + decisionKey + "' from scene " + state.currentSceneId);
        }
        Manifest.EdgeData transEdge = null;
        Manifest.EdgeData currentEdge = startEdge;
        int steps = 0;
        while (steps++ < MAX_TRAVERSAL_STEPS) {
            String targetId = currentEdge.targetNodeId;
            Manifest.NodeData target = nodeById(targetId);
            if (target == null) {
                throw new IllegalArgumentException("Node not found: " + targetId);
            }
            switch (target.type) {
                case "scene" -> {
                    transEdge = currentEdge.transition != null ? currentEdge : null;
                    state.currentSceneId = targetId;
                    state.gameOver = target.isEnd;
                    return new TraversalResult(target, transEdge, currentEdge);
                }
                case "state" -> {
                    executeAssignments(target, state);
                    List<Manifest.EdgeData> outs = edgesBySource.getOrDefault(targetId, List.of());
                    if (outs.isEmpty()) {
                        throw new IllegalArgumentException("State node has no outgoing edge: " + targetId);
                    }
                    currentEdge = outs.get(0);
                }
                case "condition" -> {
                    Manifest.EdgeData matched = evaluateConditions(target, state);
                    if (matched == null) {
                        throw new IllegalArgumentException("No matching condition in condition node: " + targetId);
                    }
                    currentEdge = matched;
                }
                default -> throw new IllegalArgumentException("Unknown node type: " + target.type);
            }
        }
        throw new IllegalArgumentException("Graph traversal exceeded " + MAX_TRAVERSAL_STEPS + " steps (cycle?)");
    }

    public List<DecisionInfo> availableDecisions(GameState state, String sceneId) {
        Manifest.NodeData scene = nodeById(sceneId);
        if (scene == null || scene.decisions == null || scene.decisions.isEmpty()) {
            return hasSyntheticContinue(sceneId) ? List.of(new DecisionInfo("CONTINUE", true, null)) : List.of();
        }
        return scene.decisions.stream()
            .sorted(Comparator.comparingInt(d -> d.decisionOrder))
            .filter(d -> isDecisionAvailable(d, state))
            .map(d -> new DecisionInfo(d.decisionKey, d.isDefault, d.keyboardKey))
            .toList();
    }

    public boolean sceneHasExplicitDecisions(String sceneId) {
        Manifest.NodeData scene = nodeById(sceneId);
        return scene != null && scene.decisions != null && !scene.decisions.isEmpty();
    }

    public boolean sceneAutoContinues(String sceneId) {
        Manifest.NodeData scene = nodeById(sceneId);
        if (scene == null) {
            return false;
        }
        boolean hasExplicitDecisions = sceneHasExplicitDecisions(sceneId);
        return !hasExplicitDecisions && scene.autoContinue && hasSyntheticContinue(sceneId);
    }

    public TraversalResult peek(GameState state, String decisionKey) {
        GameState copy = new GameState(state.currentSceneId);
        copy.variables.putAll(state.variables);
        copy.gameOver = state.gameOver;
        try {
            return decide(copy, decisionKey);
        } catch (Exception ignored) {
            return null;
        }
    }

    public List<String> preloadUrlsForScene(String sceneId) {
        return edgesBySource.getOrDefault(sceneId, List.of()).stream()
            .filter(e -> e.transition != null && !"none".equals(e.transition.type))
            .map(e -> "/hls/trans_" + e.id + "/master.m3u8")
            .toList();
    }

    public List<String> preloadSceneUrlsForScene(GameState state, String sceneId) {
        if (sceneId == null) {
            return List.of();
        }
        Set<String> urls = new LinkedHashSet<>();
        for (DecisionInfo decision : availableDecisions(state, sceneId)) {
            TraversalResult traversal = peek(state, decision.key());
            if (traversal == null || traversal.nextScene() == null || traversal.nextScene().id == null) {
                continue;
            }
            if (sceneId.equals(traversal.nextScene().id)) {
                continue;
            }
            urls.add("/hls/" + traversal.nextScene().id + "/master.m3u8");
        }
        return List.copyOf(urls);
    }

    public String defaultLocaleCode() {
        return manifest.project != null ? manifest.project.defaultLocaleCode : null;
    }

    public List<Manifest.LocaleEntry> availableLocales() {
        if (manifest.localization == null || manifest.localization.locales == null) {
            return List.of();
        }
        return manifest.localization.locales;
    }

    public List<Manifest.SubtitleEntry> getSubtitlesForScene(String sceneId, String localeCode) {
        if (manifest.localization == null || manifest.localization.subtitles == null || sceneId == null || localeCode == null) {
            return List.of();
        }
        return manifest.localization.subtitles.stream()
            .filter(s -> sceneId.equals(s.sceneId) && localeCode.equals(s.localeCode))
            .sorted(Comparator.comparingDouble(s -> s.startTime))
            .toList();
    }

    public List<Manifest.DecisionTranslationEntry> getDecisionTranslationsForScene(String sceneId, String localeCode) {
        if (manifest.localization == null || manifest.localization.decisionTranslations == null || sceneId == null || localeCode == null) {
            return List.of();
        }
        return manifest.localization.decisionTranslations.stream()
            .filter(dt -> sceneId.equals(dt.sceneId) && localeCode.equals(dt.localeCode))
            .toList();
    }

    private void executeAssignments(Manifest.NodeData stateNode, GameState gameState) {
        if (stateNode.assignments == null) {
            return;
        }
        stateNode.assignments.stream()
            .sorted(Comparator.comparingInt(a -> a.order))
            .forEach(a -> executeAssignment(a.expression, gameState));
    }

    private void executeAssignment(String expression, GameState gameState) {
        if (expression == null || expression.isBlank()) {
            return;
        }
        Matcher matcher = ASSIGNMENT_RE.matcher(expression);
        if (!matcher.matches()) {
            return;
        }
        String varName = matcher.group(1);
        String rhs = matcher.group(2).trim();
        gameState.variables.putIfAbsent(varName, 0);
        seedMissingVars(rhs, gameState);
        EvaluationContext ctx = buildContext(gameState);
        try {
            Expression expr = parser.parseExpression(rhs);
            Object result = expr.getValue(ctx);
            gameState.variables.put(varName, result);
        } catch (Exception ignored) {
        }
    }

    private Manifest.EdgeData evaluateConditions(Manifest.NodeData decisionNode, GameState gameState) {
        List<Manifest.EdgeData> outEdges = edgesBySource.getOrDefault(decisionNode.id, List.of());
        if (outEdges.isEmpty()) {
            return null;
        }
        if (decisionNode.conditions == null || decisionNode.conditions.isEmpty()) {
            return outEdges.get(0);
        }
        Manifest.ConditionEntry elseCondition = null;
        List<Manifest.ConditionEntry> ordered = decisionNode.conditions.stream()
            .sorted(Comparator.comparingInt(c -> c.order))
            .toList();
        for (Manifest.ConditionEntry cond : ordered) {
            if (!cond.isElse && cond.expression != null) {
                seedMissingVars(cond.expression, gameState);
            }
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
            } catch (Exception ignored) {
            }
        }
        if (elseCondition != null) {
            return edgeForConditionOrder(outEdges, elseCondition.order);
        }
        return outEdges.get(0);
    }

    private Manifest.EdgeData edgeForConditionOrder(List<Manifest.EdgeData> edges, int order) {
        return edges.stream()
            .filter(e -> e.sourceConditionOrder != null && e.sourceConditionOrder == order)
            .findFirst()
            .orElse(edges.isEmpty() ? null : edges.get(0));
    }

    private Manifest.EdgeData findDecisionEdge(String sceneId, String decisionKey) {
        List<Manifest.EdgeData> outs = edgesBySource.getOrDefault(sceneId, List.of());
        if ("CONTINUE".equals(decisionKey) && outs.size() == 1) {
            return outs.get(0);
        }
        return outs.stream().filter(e -> decisionKey.equals(e.sourceDecisionKey)).findFirst().orElse(null);
    }

    private boolean hasSyntheticContinue(String sceneId) {
        return edgesBySource.getOrDefault(sceneId, List.of()).size() == 1;
    }

    private EvaluationContext buildContext(GameState state) {
        SimpleEvaluationContext ctx = SimpleEvaluationContext.forReadWriteDataBinding().build();
        state.variables.forEach(ctx::setVariable);
        ctx.setVariable("state", stateView(state));
        return ctx;
    }

    private void seedMissingVars(String expression, GameState state) {
        Matcher matcher = Pattern.compile("#(\\w+)").matcher(expression);
        while (matcher.find()) {
            String varName = matcher.group(1);
            if ("state".equals(varName)) {
                continue;
            }
            state.variables.putIfAbsent(varName, 0);
        }
        Matcher stateAccess = STATE_MAP_ACCESS_RE.matcher(expression);
        while (stateAccess.find()) {
            String key = stateAccess.group(1) != null ? stateAccess.group(1) : stateAccess.group(2);
            if (key != null && !key.isBlank()) {
                state.variables.putIfAbsent(key, 0);
            }
        }
    }

    private boolean isDecisionAvailable(GameState state, String sceneId, String decisionKey) {
        Manifest.NodeData scene = nodeById(sceneId);
        if (scene == null || scene.decisions == null || scene.decisions.isEmpty()) {
            return "CONTINUE".equals(decisionKey) && hasSyntheticContinue(sceneId);
        }
        return scene.decisions.stream()
            .filter(d -> decisionKey.equals(d.decisionKey))
            .findFirst()
            .map(d -> isDecisionAvailable(d, state))
            .orElse(false);
    }

    private boolean isDecisionAvailable(Manifest.DecisionEntry decision, GameState gameState) {
        if (decision == null || decision.conditionExpression == null || decision.conditionExpression.isBlank()) {
            return true;
        }
        seedMissingVars(decision.conditionExpression, gameState);
        EvaluationContext ctx = buildContext(gameState);
        try {
            Boolean result = parser.parseExpression(decision.conditionExpression).getValue(ctx, Boolean.class);
            return Boolean.TRUE.equals(result);
        } catch (Exception ignored) {
            return false;
        }
    }

    private Map<String, Object> stateView(GameState state) {
        return new HashMap<>(state.variables) {
            @Override
            public Object get(Object key) {
                return containsKey(key) ? super.get(key) : 0;
            }
        };
    }
}
