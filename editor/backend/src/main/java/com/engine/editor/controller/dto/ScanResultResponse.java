package com.engine.editor.controller.dto;

public record ScanResultResponse(int added, int updated, int removed, int skipped, int total) {}
