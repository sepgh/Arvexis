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

        server.createContext("/api/game/info",     this::handleInfo);
        server.createContext("/api/game/state",    this::handleState);
        server.createContext("/api/game/decide",   this::handleDecide);
        server.createContext("/api/game/restart",  this::handleRestart);
        server.createContext("/api/game/has-save", this::handleHasSave);
        server.createContext("/api/game/locales",  this::handleLocales);
        server.createContext("/hls/",              this::handleHls);
        server.createContext("/assets/",           this::handleAssets);
        server.createContext("/",                  this::handleStatic);

        server.start();
    }

    // ── GET /api/game/info ─────────────────────────────────────────────────────

    private void handleInfo(HttpExchange ex) throws IOException {
        if ("OPTIONS".equals(ex.getRequestMethod())) { RequestHelper.handleOptions(ex); return; }
        if (!"GET".equals(ex.getRequestMethod())) { RequestHelper.sendError(ex, 405, "Method not allowed"); return; }

        Map<String, Object> info = new LinkedHashMap<>();
        String name = (manifest.project != null && manifest.project.name != null)
            ? manifest.project.name : "Arvexis";
        info.put("projectName", name);
        RequestHelper.sendJson(ex, 200, info);
    }

    // ── GET /api/game/state ────────────────────────────────────────────────────

    private void handleState(HttpExchange ex) throws IOException {
        if ("OPTIONS".equals(ex.getRequestMethod())) { RequestHelper.handleOptions(ex); return; }
        if (!"GET".equals(ex.getRequestMethod())) { RequestHelper.sendError(ex, 405, "Method not allowed"); return; }

        String locale = queryParam(ex, "locale");
        synchronized (stateLock) {
            RequestHelper.sendJson(ex, 200, buildStateResponse(state, locale));
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

            String locale = queryParam(ex, "locale");
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
                resp.put("nextState", buildStateResponse(state, locale));
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

        String locale = queryParam(ex, "locale");
        synchronized (stateLock) {
            state = new GameState(manifest.rootNodeId);
            stateStore.save(state);
            RequestHelper.sendJson(ex, 200, buildStateResponse(state, locale));
        }
    }

    // ── GET /api/game/has-save ────────────────────────────────────────────────

    private void handleHasSave(HttpExchange ex) throws IOException {
        if ("OPTIONS".equals(ex.getRequestMethod())) { RequestHelper.handleOptions(ex); return; }
        if (!"GET".equals(ex.getRequestMethod())) { RequestHelper.sendError(ex, 405, "Method not allowed"); return; }

        GameState loaded = stateStore.load();
        boolean hasSave = loaded != null && engine.nodeById(loaded.currentSceneId) != null;
        RequestHelper.sendJson(ex, 200, Map.of("hasSave", hasSave));
    }

    // ── GET /api/game/locales ─────────────────────────────────────────────────

    private void handleLocales(HttpExchange ex) throws IOException {
        if ("OPTIONS".equals(ex.getRequestMethod())) { RequestHelper.handleOptions(ex); return; }
        if (!"GET".equals(ex.getRequestMethod())) { RequestHelper.sendError(ex, 405, "Method not allowed"); return; }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("defaultLocaleCode", engine.defaultLocaleCode());
        resp.put("locales", engine.availableLocales().stream().map(l -> {
            Map<String, Object> lm = new LinkedHashMap<>();
            lm.put("code", l.code);
            lm.put("name", l.name);
            return lm;
        }).toList());
        RequestHelper.sendJson(ex, 200, resp);
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

    // ── GET /assets/{path} — serve music/audio assets from assets dir ────────

    private void handleAssets(HttpExchange ex) throws IOException {
        if (!"GET".equals(ex.getRequestMethod())) { RequestHelper.sendError(ex, 405, "Method not allowed"); return; }

        String uriPath  = ex.getRequestURI().getPath();
        String filePart = uriPath.substring("/assets/".length());

        Path assetsBase = projectDir.resolve("assets").normalize();
        Path target = assetsBase.resolve(filePart).normalize();

        if (!target.startsWith(assetsBase)) { RequestHelper.sendError(ex, 403, "Forbidden"); return; }
        if (!Files.exists(target))           { RequestHelper.sendError(ex, 404, "Not found: " + filePart); return; }

        String mime = mimeFor(target.getFileName().toString());
        byte[] bytes = Files.readAllBytes(target);
        RequestHelper.sendBytes(ex, 200, mime, bytes);
    }

    // ── Static client files (/, /game.js, /custom.css, etc.) ─────────────────

    private void handleStatic(HttpExchange ex) throws IOException {
        if (!"GET".equals(ex.getRequestMethod())) { RequestHelper.sendError(ex, 405, "Method not allowed"); return; }

        String path = ex.getRequestURI().getPath();
        if ("/".equals(path) || path.isBlank()) path = "/index.html";

        // Serve user-editable CSS files from project dir (custom.css, buttons.css, subtitles.css)
        if ("/custom.css".equals(path) || "/buttons.css".equals(path) || "/subtitles.css".equals(path)) {
            Path cssFile = projectDir.resolve(path.substring(1));
            if (Files.exists(cssFile)) {
                byte[] bytes = Files.readAllBytes(cssFile);
                RequestHelper.sendBytes(ex, 200, "text/css; charset=UTF-8", bytes);
            } else {
                // Return empty CSS if no file exists
                RequestHelper.sendBytes(ex, 200, "text/css; charset=UTF-8", new byte[0]);
            }
            return;
        }

        String resource = "/client" + path;
        try (InputStream in = getClass().getResourceAsStream(resource)) {
            if (in == null) { RequestHelper.sendError(ex, 404, "Not found"); return; }
            byte[] bytes = in.readAllBytes();
            RequestHelper.sendBytes(ex, 200, mimeFor(path), bytes);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> buildStateResponse(GameState s, String locale) {
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
        // Background music URL (if scene defines one)
        if (scene != null && scene.musicAssetRelPath != null) {
            resp.put("musicUrl", "/assets/" + scene.musicAssetRelPath);
        } else {
            resp.put("musicUrl", null);  // null = keep current music playing
        }

        resp.put("variables",         Map.copyOf(s.variables));

        // Localization: subtitles + decision translations for the current scene
        if (locale != null && !locale.isBlank()) {
            resp.put("subtitles", engine.getSubtitlesForScene(s.currentSceneId, locale).stream().map(sub -> {
                Map<String, Object> sm = new LinkedHashMap<>();
                sm.put("startTime", sub.startTime);
                sm.put("endTime",   sub.endTime);
                sm.put("text",      sub.text);
                return sm;
            }).toList());

            Map<String, String> dtMap = new LinkedHashMap<>();
            for (Manifest.DecisionTranslationEntry dt : engine.getDecisionTranslationsForScene(s.currentSceneId, locale)) {
                dtMap.put(dt.decisionKey, dt.label);
            }
            resp.put("decisionTranslations", dtMap);
        }

        return resp;
    }

    private String queryParam(HttpExchange ex, String name) {
        String query = ex.getRequestURI().getQuery();
        if (query == null) return null;
        for (String pair : query.split("&")) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2 && name.equals(kv[0])) {
                return java.net.URLDecoder.decode(kv[1], java.nio.charset.StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    private static String mimeFor(String filename) {
        if (filename.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
        if (filename.endsWith(".ts"))   return "video/MP2T";
        if (filename.endsWith(".mp4"))  return "video/mp4";
        if (filename.endsWith(".html")) return "text/html; charset=UTF-8";
        if (filename.endsWith(".js"))   return "application/javascript; charset=UTF-8";
        if (filename.endsWith(".css"))  return "text/css; charset=UTF-8";
        if (filename.endsWith(".mp3"))  return "audio/mpeg";
        if (filename.endsWith(".ogg"))  return "audio/ogg";
        if (filename.endsWith(".wav"))  return "audio/wav";
        if (filename.endsWith(".aac"))  return "audio/aac";
        if (filename.endsWith(".flac")) return "audio/flac";
        String guessed = URLConnection.guessContentTypeFromName(filename);
        return guessed != null ? guessed : "application/octet-stream";
    }
}
