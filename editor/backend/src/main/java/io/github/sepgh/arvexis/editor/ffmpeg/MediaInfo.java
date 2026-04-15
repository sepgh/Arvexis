package io.github.sepgh.arvexis.editor.ffmpeg;

public class MediaInfo {

    private String filePath;
    private String mediaType;
    private String codec;
    private Integer width;
    private Integer height;
    private Double frameRate;
    private Double duration;
    private boolean hasAudio;
    private boolean hasAlpha;
    private Long fileSize;
    private String pixelFormat;
    private Integer audioSampleRate;
    private Integer audioChannels;

    public MediaInfo() {}

    public String getResolution() {
        if (width != null && height != null) {
            return width + "x" + height;
        }
        return null;
    }

    public boolean isVideo() {
        return "video".equals(mediaType);
    }

    public boolean isAudio() {
        return "audio".equals(mediaType);
    }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public String getMediaType() { return mediaType; }
    public void setMediaType(String mediaType) { this.mediaType = mediaType; }

    public String getCodec() { return codec; }
    public void setCodec(String codec) { this.codec = codec; }

    public Integer getWidth() { return width; }
    public void setWidth(Integer width) { this.width = width; }

    public Integer getHeight() { return height; }
    public void setHeight(Integer height) { this.height = height; }

    public Double getFrameRate() { return frameRate; }
    public void setFrameRate(Double frameRate) { this.frameRate = frameRate; }

    public Double getDuration() { return duration; }
    public void setDuration(Double duration) { this.duration = duration; }

    public boolean isHasAudio() { return hasAudio; }
    public void setHasAudio(boolean hasAudio) { this.hasAudio = hasAudio; }

    public boolean isHasAlpha() { return hasAlpha; }
    public void setHasAlpha(boolean hasAlpha) { this.hasAlpha = hasAlpha; }

    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }

    public String getPixelFormat() { return pixelFormat; }
    public void setPixelFormat(String pixelFormat) { this.pixelFormat = pixelFormat; }

    public Integer getAudioSampleRate() { return audioSampleRate; }
    public void setAudioSampleRate(Integer audioSampleRate) { this.audioSampleRate = audioSampleRate; }

    public Integer getAudioChannels() { return audioChannels; }
    public void setAudioChannels(Integer audioChannels) { this.audioChannels = audioChannels; }

    @Override
    public String toString() {
        return "MediaInfo{filePath='" + filePath + "', mediaType='" + mediaType +
               "', codec='" + codec + "', resolution=" + getResolution() +
               ", duration=" + duration + ", hasAudio=" + hasAudio +
               ", hasAlpha=" + hasAlpha + '}';
    }
}
