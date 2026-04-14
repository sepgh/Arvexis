package com.engine.embeddedruntime.spring;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "embedded.runtime")
public class EmbeddedRuntimeProperties {
    private String basePath = "/api/runtime";

    public String getBasePath() {
        return normalize(basePath);
    }

    public void setBasePath(String basePath) {
        this.basePath = normalize(basePath);
    }

    public String getPlayerAssetsPath() {
        return getBasePath() + "/player";
    }

    private String normalize(String path) {
        if (path == null || path.isBlank()) {
            return "/api/runtime";
        }
        String normalized = path.startsWith("/") ? path : "/" + path;
        if (normalized.length() > 1 && normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }
}
