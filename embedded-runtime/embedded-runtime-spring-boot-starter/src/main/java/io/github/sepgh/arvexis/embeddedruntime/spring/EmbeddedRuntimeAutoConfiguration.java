package io.github.sepgh.arvexis.embeddedruntime.spring;

import io.github.sepgh.arvexis.embeddedruntime.core.DefaultGameRuntimeFacade;
import io.github.sepgh.arvexis.embeddedruntime.core.DefaultGameSessionService;
import io.github.sepgh.arvexis.embeddedruntime.core.GameRuntimeFacade;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.AuthorizationResolver;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.GameAccessPolicy;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.GameDefinitionProvider;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.GameSessionRepository;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.GameSessionService;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.PlayerResolver;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.RuntimeResourceLocator;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.PlayerId;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.PlayerProfile;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.security.Principal;
import java.util.Map;

@AutoConfiguration
@EnableConfigurationProperties(EmbeddedRuntimeProperties.class)
public class EmbeddedRuntimeAutoConfiguration implements WebMvcConfigurer {
    private final EmbeddedRuntimeProperties properties;

    public EmbeddedRuntimeAutoConfiguration(EmbeddedRuntimeProperties properties) {
        this.properties = properties;
    }

    @Bean
    @ConditionalOnMissingBean
    public RuntimeResourceLocator runtimeResourceLocator() {
        return new SpringRuntimeResourceLocator(properties);
    }

    @Bean
    @ConditionalOnMissingBean
    public AuthorizationResolver authorizationResolver() {
        return () -> {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            return attributes != null ? attributes.getRequest() : null;
        };
    }

    @Bean
    @ConditionalOnMissingBean
    public PlayerResolver playerResolver() {
        return authorizationContext -> {
            if (authorizationContext instanceof HttpServletRequest request) {
                Principal principal = request.getUserPrincipal();
                String name = principal != null && principal.getName() != null && !principal.getName().isBlank()
                    ? principal.getName()
                    : request.getRemoteUser();
                if (name == null || name.isBlank()) {
                    name = request.getRemoteAddr() != null && !request.getRemoteAddr().isBlank() ? request.getRemoteAddr() : "anonymous";
                }
                return new PlayerProfile(new PlayerId(name), name, name, Map.of(), name);
            }
            if (authorizationContext instanceof Principal principal) {
                String name = principal.getName();
                return new PlayerProfile(new PlayerId(name), name, name, Map.of(), name);
            }
            String name = authorizationContext != null ? authorizationContext.toString() : "anonymous";
            return new PlayerProfile(new PlayerId(name), name, name, Map.of(), name);
        };
    }

    @Bean
    @ConditionalOnMissingBean
    public GameAccessPolicy gameAccessPolicy() {
        return (player, gameDefinition) -> true;
    }

    @Bean
    @ConditionalOnMissingBean
    public GameSessionService gameSessionService(GameSessionRepository repository) {
        return new DefaultGameSessionService(repository);
    }

    @Bean
    @ConditionalOnMissingBean
    public GameRuntimeFacade gameRuntimeFacade(
        GameDefinitionProvider gameDefinitionProvider,
        GameAccessPolicy gameAccessPolicy,
        GameSessionService gameSessionService,
        RuntimeResourceLocator runtimeResourceLocator
    ) {
        return new DefaultGameRuntimeFacade(gameDefinitionProvider, gameAccessPolicy, gameSessionService, runtimeResourceLocator);
    }

    @Bean
    @ConditionalOnMissingBean
    public EmbeddedRuntimeController embeddedRuntimeController(
        GameRuntimeFacade facade,
        GameDefinitionProvider gameDefinitionProvider,
        GameAccessPolicy gameAccessPolicy,
        AuthorizationResolver authorizationResolver,
        PlayerResolver playerResolver
    ) {
        return new EmbeddedRuntimeController(facade, gameDefinitionProvider, gameAccessPolicy, authorizationResolver, playerResolver);
    }

    @Bean
    @ConditionalOnMissingBean
    public EmbeddedRuntimePlayerController embeddedRuntimePlayerController(
        EmbeddedRuntimeProperties properties,
        GameDefinitionProvider gameDefinitionProvider
    ) {
        return new EmbeddedRuntimePlayerController(properties, gameDefinitionProvider);
    }

    @Bean
    @ConditionalOnMissingBean
    public EmbeddedRuntimeExceptionHandler embeddedRuntimeExceptionHandler() {
        return new EmbeddedRuntimeExceptionHandler();
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler(properties.getPlayerAssetsPath() + "/**")
            .addResourceLocations("classpath:/player/");
    }
}
