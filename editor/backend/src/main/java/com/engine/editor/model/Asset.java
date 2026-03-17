package com.engine.editor.model;

import java.util.List;

public class Asset {

    private String id;
    private String filePath;
    private String fileName;
    private String directory;
    private String mediaType;
    private boolean hasAlpha;
    private String codec;
    private String resolution;
    private Double frameRate;
    private Double duration;
    private Long fileSize;
    private List<String> tags;

    public Asset() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getDirectory() { return directory; }
    public void setDirectory(String directory) { this.directory = directory; }

    public String getMediaType() { return mediaType; }
    public void setMediaType(String mediaType) { this.mediaType = mediaType; }

    public boolean isHasAlpha() { return hasAlpha; }
    public void setHasAlpha(boolean hasAlpha) { this.hasAlpha = hasAlpha; }

    public String getCodec() { return codec; }
    public void setCodec(String codec) { this.codec = codec; }

    public String getResolution() { return resolution; }
    public void setResolution(String resolution) { this.resolution = resolution; }

    public Double getFrameRate() { return frameRate; }
    public void setFrameRate(Double frameRate) { this.frameRate = frameRate; }

    public Double getDuration() { return duration; }
    public void setDuration(Double duration) { this.duration = duration; }

    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }

    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
}
