package com.engine.runtime;

import com.engine.runtime.game.*;
import com.engine.runtime.http.RequestHelper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.URLConnection;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.Executors;

/**
 * Lightweight HTTP server for the compiled runtime.
 *
 * Routes:
 *   GET  /                    → index.html (from classpath)
 *   GET  /game.js             → game.js (from classpath)
 *   GET  /hls/{path}          → HLS segments from outputDir
 *   GET  /api/game/state      → current game state + decisions + preload hints
 *   POST /api/game/decide     → body: {"decisionKey":"..."} → traversal result
 *   POST /api/game/restart    → reset to root
 */
public class RuntimeServer {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final int    port;
    private final Path   manifestFile;
    private final Path   outputDir;
    private final Path   projectDir;

    private Manifest    manifest;
    private GameEngine  engine;
    private StateStore  stateStore;
    private GameState   state;

    private final Object stateLock = new Object();

    public RuntimeServer(int port, Path manifestFile, Path outputDir) {
        this.port         = port;
        this.manifestFile = manifestFile;
        this.outputDir    = outputDir;
        this.projectDir   = manifestFile.getParent();
    }

    public void start() throws Exception {
        // Load manifest
        manifest   = MAPPER.readValue(manifestFile.toFile(), Manifest.class);
        engine     = new GameEngine(manifest);
        stateStore = new StateStore(projectDir);

        // Load or initialize state
        GameState loaded = stateStore.load();
        if (loaded != null && engine.nodeById(loaded.currentSceneId) != null) {
            state = loaded;
            System.out.println("  Resumed  : scene " + state.currentSceneId);
        } else {
            state = new GameState(manifest.rootNodeId);
            stateStore.save(state);
            System.out.println("  New game : root = " + manifest.rootNodeId);
        }

        // Start HTTP server
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());

        server.createContext("/api/game/state",   this::handleState);
        server.createContext("/api/game/decide",  this::handleDecide);
        server.createContext("/api/game/restart", this::handleRestart);
        server.createContext("/hls/",             this::handleHls);
        server.createContext("/",                 this::handleStatic);

        server.start();
    }

    // ── GET /api/game/state ────────────────────────────────────────────────────

    private void handleState(HttpExchange ex) throws IOException {
        if ("OPTIONS".equals(ex.getRequestMethod())) { RequestHelper.handleOptions(ex); return; }
        if (!"GET".equals(ex.getRequestMethod())) { RequestHelper.sendError(ex, 405, "Method not allowed"); return; }

        synchronized (stateLock) {
            RequestHelper.sendJson(ex, 200, buildStateResponse(state));
        }
    }

    // ── POST /api/game/decide ─────────────────────────────────────────────────

    private void handleDecide(HttpExchange ex) throws IOException {
        if ("OPTIONS".equals(ex.getRequestMethod())) { RequestHelper.handleOptions(ex); return; }
        if (!"POST".equals(ex.getRequestMethod())) { RequestHelper.sendError(ex, 405, "Method not allowed"); return; }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> body = RequestHelper.readJson(ex, Map.class);
            String decisionKey = (String) body.get("decisionKey");
            if (decisionKey == null || decisionKey.isBlank()) {
                RequestHelper.sendError(ex, 400, "decisionKey is required"); return;
            }

            synchronized (stateLock) {
                if (state.gameOver) {
                    RequestHelper.sendError(ex, 409, "Game is over. Call /api/game/restart to play again."); return;
                }
                GameEngine.TraversalResult result = engine.decide(state, decisionKey);
                stateStore.save(state);

                Map<String, Object> resp = new LinkedHashMap<>();
                if (result.transEdge() != null) {
                    Map<String, Object> trans = new LinkedHashMap<>();
                    trans.put("edgeId",           result.transEdge().id);
                    trans.put("type",             result.transEdge().transition.type);
                    trans.put("duration",         result.transEdge().transition.duration);
                    trans.put("transitionHlsUrl", "/hls/trans_" + result.transEdge().id + "/master.m3u8");
                    resp.put("transition", trans);
                } else {
                    resp.put("transition", null);
                }
                resp.put("nextState", buildStateResponse(state));
                RequestHelper.sendJson(ex, 200, resp);
            }

        } catch (IllegalArgumentException e) {
            RequestHelper.sendError(ex, 400, e.getMessage());
        } catch (Exception e) {
            System.err.println("[decide] " + e.getMessage());
            RequestHelper.sendError(ex, 500, "Internal error: " + e.getMessage());
        }
    }

    // ── POST /api/game/restart ────────────────────────────────────────────────

    private void handleRestart(HttpExchange ex) throws IOException {
        if ("OPTIONS".equals(ex.getRequestMethod())) { RequestHelper.handleOptions(ex); return; }
        if (!"POST".equals(ex.getRequestMethod())) { RequestHelper.sendError(ex, 405, "Method not allowed"); return; }

        synchronized (stateLock) {
            state = new GameState(manifest.rootNodeId);
            stateStore.save(state);
            RequestHelper.sendJson(ex, 200, buildStateResponse(state));
        }
    }

    // ── GET /hls/{path} — serve HLS files from outputDir ─────────────────────

    private void handleHls(HttpExchange ex) throws IOException {
        if (!"GET".equals(ex.getRequestMethod())) { RequestHelper.sendError(ex, 405, "Method not allowed"); return; }

        String uriPath   = ex.getRequestURI().getPath(); // e.g. /hls/sceneId/720p/playlist.m3u8
        String filePart  = uriPath.substring("/hls/".length());
        Path   target    = outputDir.resolve(filePart).normalize();

        // Security: must stay within outputDir
        if (!target.startsWith(outputDir)) { RequestHelper.sendError(ex, 403, "Forbidden"); return; }
        if (!Files.exists(target))         { RequestHelper.sendError(ex, 404, "Not found: " + filePart); return; }

        String mime = mimeFor(target.getFileName().toString());
        byte[] bytes = Files.readAllBytes(target);
        RequestHelper.sendBytes(ex, 200, mime, bytes);
    }

    // ── Static client files (/, /game.js, etc.) ───────────────────────────────

    private void handleStatic(HttpExchange ex) throws IOException {
        if (!"GET".equals(ex.getRequestMethod())) { RequestHelper.sendError(ex, 405, "Method not allowed"); return; }

        String path = ex.getRequestURI().getPath();
        if ("/".equals(path) || path.isBlank()) path = "/index.html";

        String resource = "/client" + path;
        try (InputStream in = getClass().getResourceAsStream(resource)) {
            if (in == null) { RequestHelper.sendError(ex, 404, "Not found"); return; }
            byte[] bytes = in.readAllBytes();
            RequestHelper.sendBytes(ex, 200, mimeFor(path), bytes);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> buildStateResponse(GameState s) {
        Manifest.NodeData scene = engine.nodeById(s.currentSceneId);
        List<GameEngine.DecisionInfo> decisions = engine.availableDecisions(s.currentSceneId);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("currentSceneId",    s.currentSceneId);
        resp.put("currentSceneName",  scene != null ? scene.name : s.currentSceneId);
        resp.put("sceneHlsUrl",       "/hls/" + s.currentSceneId + "/master.m3u8");
        resp.put("isEnd",             s.gameOver);
        resp.put("duration",          scene != null ? scene.computedDuration : null);
        resp.put("decisionAppearanceConfig", scene != null ? scene.decisionAppearanceConfig : null);
        resp.put("decisionTimeoutSecs", engine.decisionTimeoutSecs());
        resp.put("decisions",         decisions.stream().map(d -> {
            Map<String, Object> dm = new LinkedHashMap<>();
            dm.put("key",       d.key());
            dm.put("isDefault", d.isDefault());
            return dm;
        }).toList());
        resp.put("preloadUrls",       engine.preloadUrlsForScene(s.currentSceneId));
        // Scene-level auto-continue: only active when there are no explicit decisions
        boolean autoContinues = engine.sceneAutoContinues(s.currentSceneId);
        resp.put("autoContinue", autoContinues);
        if (autoContinues) {
            try {
                GameEngine.TraversalResult tr = engine.peek(s, "CONTINUE");
                if (tr != null && tr.nextScene() != null) {
                    resp.put("autoContinueNextSceneUrl", "/hls/" + tr.nextScene().id + "/master.m3u8");
                }
            } catch (Exception ignored) {}
        }
        resp.put("variables",         Map.copyOf(s.variables));
        return resp;
    }

    private static String mimeFor(String filename) {
        if (filename.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
        if (filename.endsWith(".ts"))   return "video/MP2T";
        if (filename.endsWith(".mp4"))  return "video/mp4";
        if (filename.endsWith(".html")) return "text/html; charset=UTF-8";
        if (filename.endsWith(".js"))   return "application/javascript; charset=UTF-8";
        if (filename.endsWith(".css"))  return "text/css; charset=UTF-8";
        String guessed = URLConnection.guessContentTypeFromName(filename);
        return guessed != null ? guessed : "application/octet-stream";
    }
}
