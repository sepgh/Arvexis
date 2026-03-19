package com.engine.editor.model;

import java.util.List;

public class ProjectConfigData {

    private String name;
    private String assetsDirectory;
    private String outputDirectory;
    private String previewResolution;
    private List<String> compileResolutions;
    private int fps;
    private int audioSampleRate;
    private int audioBitRate;
    private double decisionTimeoutSecs;
    private String defaultLocaleCode;
    private String defaultBackgroundColor;
    private Integer ffmpegThreads;   // null = Auto (let FFmpeg decide)

    public ProjectConfigData() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAssetsDirectory() { return assetsDirectory; }
    public void setAssetsDirectory(String assetsDirectory) { this.assetsDirectory = assetsDirectory; }

    public String getOutputDirectory() { return outputDirectory; }
    public void setOutputDirectory(String outputDirectory) { this.outputDirectory = outputDirectory; }

    public String getPreviewResolution() { return previewResolution; }
    public void setPreviewResolution(String previewResolution) { this.previewResolution = previewResolution; }

    public List<String> getCompileResolutions() { return compileResolutions; }
    public void setCompileResolutions(List<String> compileResolutions) { this.compileResolutions = compileResolutions; }

    public int getFps() { return fps; }
    public void setFps(int fps) { this.fps = fps; }

    public int getAudioSampleRate() { return audioSampleRate; }
    public void setAudioSampleRate(int audioSampleRate) { this.audioSampleRate = audioSampleRate; }

    public int getAudioBitRate() { return audioBitRate; }
    public void setAudioBitRate(int audioBitRate) { this.audioBitRate = audioBitRate; }

    public double getDecisionTimeoutSecs() { return decisionTimeoutSecs; }
    public void setDecisionTimeoutSecs(double decisionTimeoutSecs) { this.decisionTimeoutSecs = decisionTimeoutSecs; }

    public String getDefaultLocaleCode() { return defaultLocaleCode; }
    public void setDefaultLocaleCode(String defaultLocaleCode) { this.defaultLocaleCode = defaultLocaleCode; }

    public String getDefaultBackgroundColor() { return defaultBackgroundColor; }
    public void setDefaultBackgroundColor(String defaultBackgroundColor) { this.defaultBackgroundColor = defaultBackgroundColor; }

    public Integer getFfmpegThreads() { return ffmpegThreads; }
    public void setFfmpegThreads(Integer ffmpegThreads) { this.ffmpegThreads = ffmpegThreads; }
}
