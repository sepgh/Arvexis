package com.engine.embeddedruntime.spring;

import com.engine.embeddedruntime.core.GameRuntimeFacade;
import com.engine.embeddedruntime.core.RuntimeSpis.AuthorizationResolver;
import com.engine.embeddedruntime.core.RuntimeSpis.GameAccessPolicy;
import com.engine.embeddedruntime.core.RuntimeSpis.GameDefinitionProvider;
import com.engine.embeddedruntime.core.RuntimeSpis.PlayerResolver;
import com.engine.embeddedruntime.core.RuntimeTypes.GameDefinition;
import com.engine.embeddedruntime.core.RuntimeTypes.GameKey;
import com.engine.embeddedruntime.core.RuntimeTypes.GameSessionId;
import com.engine.embeddedruntime.core.RuntimeTypes.PlayerProfile;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("${embedded.runtime.base-path:/api/runtime}/games/{gameKey}")
public class EmbeddedRuntimeController {
    private final GameRuntimeFacade facade;
    private final GameDefinitionProvider gameDefinitionProvider;
    private final GameAccessPolicy gameAccessPolicy;
    private final AuthorizationResolver authorizationResolver;
    private final PlayerResolver playerResolver;

    public EmbeddedRuntimeController(
        GameRuntimeFacade facade,
        GameDefinitionProvider gameDefinitionProvider,
        GameAccessPolicy gameAccessPolicy,
        AuthorizationResolver authorizationResolver,
        PlayerResolver playerResolver
    ) {
        this.facade = Objects.requireNonNull(facade, "facade");
        this.gameDefinitionProvider = Objects.requireNonNull(gameDefinitionProvider, "gameDefinitionProvider");
        this.gameAccessPolicy = Objects.requireNonNull(gameAccessPolicy, "gameAccessPolicy");
        this.authorizationResolver = Objects.requireNonNull(authorizationResolver, "authorizationResolver");
        this.playerResolver = Objects.requireNonNull(playerResolver, "playerResolver");
    }

    @GetMapping("/api/game/info")
    public GameRuntimeFacade.GameInfoResponse info(@PathVariable("gameKey") String gameKey) {
        return facade.getGameInfo(currentPlayer(), new GameKey(gameKey));
    }

    @GetMapping("/api/game/state")
    public GameRuntimeFacade.GameStateResponse state(
        @PathVariable("gameKey") String gameKey,
        @RequestParam(name = "sessionId", required = false) String sessionId,
        @RequestParam(name = "locale", required = false) String locale
    ) {
        return facade.getGameState(currentPlayer(), new GameKey(gameKey), toSessionId(sessionId), locale);
    }

    @PostMapping("/api/game/decide")
    public GameRuntimeFacade.DecisionResponse decide(
        @PathVariable("gameKey") String gameKey,
        @RequestParam(name = "sessionId", required = false) String sessionId,
        @RequestParam(name = "locale", required = false) String locale,
        @RequestBody Map<String, Object> body
    ) {
        String decisionKey = body.get("decisionKey") instanceof String value ? value : null;
        if (decisionKey == null || decisionKey.isBlank()) {
            throw new IllegalArgumentException("decisionKey is required");
        }
        return facade.decide(currentPlayer(), new GameKey(gameKey), toSessionId(sessionId), decisionKey, locale);
    }

    @PostMapping("/api/game/restart")
    public GameRuntimeFacade.GameStateResponse restart(
        @PathVariable("gameKey") String gameKey,
        @RequestParam(name = "sessionId", required = false) String sessionId,
        @RequestParam(name = "locale", required = false) String locale
    ) {
        return facade.restart(currentPlayer(), new GameKey(gameKey), toSessionId(sessionId), locale);
    }

    @GetMapping("/api/game/has-save")
    public GameRuntimeFacade.HasSaveResponse hasSave(@PathVariable("gameKey") String gameKey) {
        return facade.hasSave(currentPlayer(), new GameKey(gameKey));
    }

    @GetMapping("/api/game/locales")
    public GameRuntimeFacade.LocalesResponse locales(@PathVariable("gameKey") String gameKey) {
        return facade.getLocales(currentPlayer(), new GameKey(gameKey));
    }

    @GetMapping(value = {"/custom.css", "/buttons.css", "/subtitles.css"}, produces = "text/css;charset=UTF-8")
    public ResponseEntity<ByteArrayResource> css(@PathVariable("gameKey") String gameKey, org.springframework.web.context.request.NativeWebRequest request) throws IOException {
        GameDefinition definition = accessibleGameDefinition(currentPlayer(), new GameKey(gameKey));
        String requestPath = request.getNativeRequest(jakarta.servlet.http.HttpServletRequest.class).getRequestURI();
        String fileName = requestPath.substring(requestPath.lastIndexOf('/') + 1);
        Path cssFile = definition.projectDir().resolve(fileName).normalize();
        if (!cssFile.startsWith(definition.projectDir().normalize()) || !Files.exists(cssFile)) {
            return ResponseEntity.ok().contentType(MediaType.valueOf("text/css;charset=UTF-8")).body(new ByteArrayResource(new byte[0]));
        }
        return fileResponse(cssFile, "text/css; charset=UTF-8");
    }

    @GetMapping("/hls/{*path}")
    public ResponseEntity<ByteArrayResource> hls(@PathVariable("gameKey") String gameKey, @PathVariable("path") String path) throws IOException {
        GameDefinition definition = accessibleGameDefinition(currentPlayer(), new GameKey(gameKey));
        Path target = definition.outputDir().resolve(normalizePath(path)).normalize();
        if (!target.startsWith(definition.outputDir()) || !Files.exists(target)) {
            throw new java.util.NoSuchElementException("Not found: " + path);
        }
        return fileResponse(target, contentType(target.getFileName().toString()));
    }

    @GetMapping("/assets/{*path}")
    public ResponseEntity<ByteArrayResource> assets(@PathVariable("gameKey") String gameKey, @PathVariable("path") String path) throws IOException {
        GameDefinition definition = accessibleGameDefinition(currentPlayer(), new GameKey(gameKey));
        Path assetsBase = definition.projectDir().resolve("assets").normalize();
        Path target = assetsBase.resolve(normalizePath(path)).normalize();
        if (!target.startsWith(assetsBase) || !Files.exists(target)) {
            throw new java.util.NoSuchElementException("Not found: " + path);
        }
        return fileResponse(target, contentType(target.getFileName().toString()));
    }

    private PlayerProfile currentPlayer() {
        return playerResolver.resolvePlayer(authorizationResolver.resolveAuthorizationContext());
    }

    private GameSessionId toSessionId(String sessionId) {
        return sessionId == null || sessionId.isBlank() ? null : new GameSessionId(sessionId);
    }

    private GameDefinition accessibleGameDefinition(PlayerProfile player, GameKey gameKey) {
        GameDefinition definition = gameDefinitionProvider.requireGame(gameKey);
        if (!gameAccessPolicy.canAccess(player, definition)) {
            throw new SecurityException("Player is not allowed to access game " + gameKey.value());
        }
        return definition;
    }

    private String normalizePath(String path) {
        if (path == null) {
            return "";
        }
        return path.startsWith("/") ? path.substring(1) : path;
    }

    private ResponseEntity<ByteArrayResource> fileResponse(Path path, String contentType) throws IOException {
        byte[] bytes = Files.readAllBytes(path);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_TYPE, contentType)
            .body(new ByteArrayResource(bytes));
    }

    private String contentType(String filename) {
        if (filename.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
        if (filename.endsWith(".ts")) return "video/MP2T";
        if (filename.endsWith(".mp4")) return "video/mp4";
        if (filename.endsWith(".html")) return "text/html; charset=UTF-8";
        if (filename.endsWith(".js")) return "application/javascript; charset=UTF-8";
        if (filename.endsWith(".css")) return "text/css; charset=UTF-8";
        if (filename.endsWith(".mp3")) return "audio/mpeg";
        if (filename.endsWith(".ogg")) return "audio/ogg";
        if (filename.endsWith(".wav")) return "audio/wav";
        if (filename.endsWith(".aac")) return "audio/aac";
        if (filename.endsWith(".flac")) return "audio/flac";
        String guessed = URLConnection.guessContentTypeFromName(filename);
        return guessed != null ? guessed : MediaType.APPLICATION_OCTET_STREAM_VALUE;
    }
}
