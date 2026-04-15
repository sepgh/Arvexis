package io.github.sepgh.arvexis.editor.controller.dto;

import java.util.List;

public record CompatibilityCheckResponse(boolean valid, List<String> errors, List<String> warnings) {}
