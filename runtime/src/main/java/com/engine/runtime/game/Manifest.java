package com.engine.runtime.game;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/** Deserializes manifest.json written by ManifestService. */
@JsonIgnoreProperties(ignoreUnknown = true)
public class Manifest {

    @JsonProperty("rootNodeId")   public String rootNodeId;
    @JsonProperty("project")      public ProjectConfig project;
    @JsonProperty("nodes")        public List<NodeData> nodes;
    @JsonProperty("edges")        public List<EdgeData> edges;
    @JsonProperty("localization") public LocalizationData localization;

    // ── Project config ─────────────────────────────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ProjectConfig {
        @JsonProperty("fps")                  public int    fps;
        @JsonProperty("decisionTimeoutSecs")  public double decisionTimeoutSecs = 5.0;
        @JsonProperty("defaultLocaleCode")    public String defaultLocaleCode;
    }

    // ── Node ──────────────────────────────────────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class NodeData {
        @JsonProperty("id")                       public String  id;
        @JsonProperty("name")                     public String  name;
        @JsonProperty("type")                     public String  type;  // scene | state | condition
        @JsonProperty("isRoot")                   public boolean isRoot;
        @JsonProperty("isEnd")                    public boolean isEnd;
        @JsonProperty("computedDuration")         public Double  computedDuration;
        @JsonProperty("decisions")                public List<DecisionEntry>  decisions;
        @JsonProperty("assignments")              public List<AssignmentEntry> assignments;
        @JsonProperty("conditions")               public List<ConditionEntry>  conditions;
        @JsonProperty("decisionAppearanceConfig") public String decisionAppearanceConfig; // raw JSON string
        @JsonProperty("autoContinue")             public boolean autoContinue;
        @JsonProperty("musicAssetId")             public String musicAssetId;
        @JsonProperty("musicAssetRelPath")        public String musicAssetRelPath;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DecisionEntry {
        @JsonProperty("decisionKey")   public String  decisionKey;
        @JsonProperty("isDefault")     public boolean isDefault;
        @JsonProperty("decisionOrder") public int     decisionOrder;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AssignmentEntry {
        @JsonProperty("order")      public int    order;
        @JsonProperty("expression") public String expression;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ConditionEntry {
        @JsonProperty("order")      public int     order;
        @JsonProperty("expression") public String  expression;
        @JsonProperty("isElse")     public boolean isElse;
    }

    // ── Edge ──────────────────────────────────────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class EdgeData {
        @JsonProperty("id")                   public String         id;
        @JsonProperty("sourceNodeId")         public String         sourceNodeId;
        @JsonProperty("targetNodeId")         public String         targetNodeId;
        @JsonProperty("sourceDecisionKey")    public String         sourceDecisionKey;
        @JsonProperty("sourceConditionOrder") public Integer        sourceConditionOrder;
        @JsonProperty("transition")           public TransitionData transition;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TransitionData {
        @JsonProperty("type")     public String type;
        @JsonProperty("duration") public double duration;
    }

    // ── Localization ──────────────────────────────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LocalizationData {
        @JsonProperty("locales")              public List<LocaleEntry>              locales;
        @JsonProperty("subtitles")            public List<SubtitleEntry>            subtitles;
        @JsonProperty("decisionTranslations") public List<DecisionTranslationEntry> decisionTranslations;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LocaleEntry {
        @JsonProperty("code") public String code;
        @JsonProperty("name") public String name;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SubtitleEntry {
        @JsonProperty("id")         public String id;
        @JsonProperty("sceneId")    public String sceneId;
        @JsonProperty("localeCode") public String localeCode;
        @JsonProperty("startTime")  public double startTime;
        @JsonProperty("endTime")    public double endTime;
        @JsonProperty("text")       public String text;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DecisionTranslationEntry {
        @JsonProperty("id")          public String id;
        @JsonProperty("decisionKey") public String decisionKey;
        @JsonProperty("sceneId")     public String sceneId;
        @JsonProperty("localeCode")  public String localeCode;
        @JsonProperty("label")       public String label;
    }
}
