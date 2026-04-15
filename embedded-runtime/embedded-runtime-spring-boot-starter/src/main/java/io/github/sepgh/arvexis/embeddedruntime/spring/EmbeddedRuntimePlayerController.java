package io.github.sepgh.arvexis.embeddedruntime.spring;

import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameKey;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.GameDefinitionProvider;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("${embedded.runtime.base-path:/api/runtime}")
public class EmbeddedRuntimePlayerController {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final EmbeddedRuntimeProperties properties;
    private final GameDefinitionProvider gameDefinitionProvider;

    public EmbeddedRuntimePlayerController(EmbeddedRuntimeProperties properties, GameDefinitionProvider gameDefinitionProvider) {
        this.properties = properties;
        this.gameDefinitionProvider = gameDefinitionProvider;
    }

    @GetMapping(value = "/play/{gameKey}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> player(@PathVariable("gameKey") String gameKey, @RequestParam(name = "sessionId", required = false) String sessionId) throws IOException {
        gameDefinitionProvider.requireGame(new GameKey(gameKey));
        String html = new ClassPathResource("player/index.html").getContentAsString(StandardCharsets.UTF_8);
        String encodedGameKey = UriUtils.encodePathSegment(gameKey, StandardCharsets.UTF_8);
        String gameBasePath = properties.getBasePath() + "/games/" + encodedGameKey;
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("gameKey", gameKey);
        config.put("apiBasePath", gameBasePath);
        config.put("playerAssetsPath", properties.getPlayerAssetsPath());
        config.put("sessionId", sessionId);
        config.put("playerPagePath", properties.getBasePath() + "/play/" + encodedGameKey);
        String rendered = html
            .replace("__ARVEXIS_RUNTIME_CONFIG__", toJson(config))
            .replace("__ARVEXIS_PLAYER_ASSETS_PATH__", properties.getPlayerAssetsPath())
            .replace("__ARVEXIS_GAME_BASE_PATH__", gameBasePath);
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(rendered);
    }

    private String toJson(Map<String, Object> value) {
        try {
            return MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to render player config", e);
        }
    }
}
